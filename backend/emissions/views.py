from rest_framework import generics, filters
from rest_framework.views import APIView
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Sum, Count, Q

from .models import NormalizedRecord
from .serializers import NormalizedRecordSerializer


class NormalizedRecordListView(generics.ListAPIView):
    serializer_class = NormalizedRecordSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["review_status", "scope_category", "source_type", "suspicious_flag", "batch"]
    search_fields = ["activity_type", "source_row_id"]
    ordering_fields = ["created_at", "estimated_emissions", "original_value"]
    ordering = ["-created_at"]

    def get_queryset(self):
        return NormalizedRecord.objects.filter(
            tenant=self.request.user.tenant
        ).select_related("approved_by", "raw_record", "batch")


class NormalizedRecordDetailView(generics.RetrieveAPIView):
    serializer_class = NormalizedRecordSerializer

    def get_queryset(self):
        return NormalizedRecord.objects.filter(
            tenant=self.request.user.tenant
        ).select_related("approved_by", "raw_record", "batch")


class DashboardStatsView(APIView):
    """Aggregated stats for the analyst dashboard widgets."""

    def get(self, request):
        tenant = request.user.tenant
        qs = NormalizedRecord.objects.filter(tenant=tenant)

        total = qs.count()
        pending = qs.filter(review_status="pending").count()
        approved = qs.filter(review_status="approved").count()
        rejected = qs.filter(review_status="rejected").count()
        suspicious = qs.filter(suspicious_flag=True).count()

        by_scope = (
            qs.filter(review_status="approved")
            .values("scope_category")
            .annotate(total_emissions=Sum("estimated_emissions"), count=Count("id"))
        )

        from ingestion.models import UploadBatch
        batch_qs = UploadBatch.objects.filter(tenant=tenant)
        total_batches = batch_qs.count()
        recent_batches = batch_qs.order_by("-uploaded_at")[:5].values(
            "id", "original_filename", "status", "total_rows", "uploaded_at",
            "data_source__source_type"
        )

        return Response({
            "records": {
                "total": total,
                "pending": pending,
                "approved": approved,
                "rejected": rejected,
                "suspicious": suspicious,
            },
            "batches": {
                "total": total_batches,
                "recent": list(recent_batches),
            },
            "emissions_by_scope": list(by_scope),
        })
