from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import generics
from datetime import datetime, timezone

from emissions.models import NormalizedRecord
from .models import ReviewDecision
from .serializers import ReviewDecisionSerializer
from audit.models import log_event, AuditLog


class ReviewDecisionListView(generics.ListAPIView):
    serializer_class = ReviewDecisionSerializer

    def get_queryset(self):
        return ReviewDecision.objects.filter(
            record__tenant=self.request.user.tenant
        ).select_related("reviewer", "record")


class ReviewActionView(APIView):
    """
    POST /api/records/{id}/review/
    Body: { "action": "approve"|"reject"|"flag", "comment": "..." }

    Approved records become immutable (enforced at model layer).
    """

    def post(self, request, pk):
        try:
            record = NormalizedRecord.objects.get(pk=pk, tenant=request.user.tenant)
        except NormalizedRecord.DoesNotExist:
            return Response({"detail": "Record not found."}, status=404)

        if record.review_status == NormalizedRecord.REVIEW_APPROVED:
            return Response(
                {"detail": "This record is already approved and immutable."},
                status=409,
            )

        action = request.data.get("action")
        comment = request.data.get("comment", "")

        if action not in [ReviewDecision.ACTION_APPROVE, ReviewDecision.ACTION_REJECT, ReviewDecision.ACTION_FLAG]:
            return Response({"detail": f"Invalid action: '{action}'."}, status=400)

        old_status = record.review_status

        # Update record status
        if action == ReviewDecision.ACTION_APPROVE:
            record.review_status = NormalizedRecord.REVIEW_APPROVED
            record.approved_by = request.user
            record.approved_at = datetime.now(tz=timezone.utc)
        elif action == ReviewDecision.ACTION_REJECT:
            record.review_status = NormalizedRecord.REVIEW_REJECTED

        # Save without triggering immutability guard (status was not yet approved)
        NormalizedRecord.objects.filter(pk=record.pk).update(
            review_status=record.review_status,
            approved_by=record.approved_by if action == ReviewDecision.ACTION_APPROVE else None,
            approved_at=record.approved_at if action == ReviewDecision.ACTION_APPROVE else None,
        )

        decision = ReviewDecision.objects.create(
            record=record,
            reviewer=request.user,
            action=action,
            comment=comment,
        )

        log_event(
            actor=request.user,
            action=AuditLog.ACTION_APPROVE if action == "approve" else AuditLog.ACTION_REJECT,
            obj=record,
            field_name="review_status",
            old_value=old_status,
            new_value=record.review_status,
            note=comment,
        )

        return Response({
            "record_id": str(record.id),
            "action": action,
            "new_status": record.review_status,
            "decision_id": str(decision.id),
        })


class BulkReviewView(APIView):
    """
    POST /api/records/bulk-review/
    Body: { "record_ids": [...], "action": "approve"|"reject", "comment": "..." }

    Convenience endpoint for batch approvals from the review queue.
    """

    def post(self, request):
        record_ids = request.data.get("record_ids", [])
        action = request.data.get("action")
        comment = request.data.get("comment", "")

        if not record_ids:
            return Response({"detail": "No record_ids provided."}, status=400)
        if action not in [ReviewDecision.ACTION_APPROVE, ReviewDecision.ACTION_REJECT]:
            return Response({"detail": f"Invalid action: '{action}'."}, status=400)

        records = NormalizedRecord.objects.filter(
            id__in=record_ids,
            tenant=request.user.tenant,
        ).exclude(review_status=NormalizedRecord.REVIEW_APPROVED)

        updated = 0
        for record in records:
            old_status = record.review_status
            new_status = (
                NormalizedRecord.REVIEW_APPROVED
                if action == "approve"
                else NormalizedRecord.REVIEW_REJECTED
            )
            update_kwargs = {"review_status": new_status}
            if action == "approve":
                update_kwargs["approved_by"] = request.user
                update_kwargs["approved_at"] = datetime.now(tz=timezone.utc)

            NormalizedRecord.objects.filter(pk=record.pk).update(**update_kwargs)

            ReviewDecision.objects.create(
                record=record,
                reviewer=request.user,
                action=action,
                comment=comment,
            )

            log_event(
                actor=request.user,
                action=AuditLog.ACTION_APPROVE if action == "approve" else AuditLog.ACTION_REJECT,
                obj=record,
                field_name="review_status",
                old_value=old_status,
                new_value=new_status,
                note=f"[Bulk] {comment}",
            )
            updated += 1

        return Response({"updated": updated, "action": action})
