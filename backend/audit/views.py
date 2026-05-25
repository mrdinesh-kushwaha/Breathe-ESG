from rest_framework import generics
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.contenttypes.models import ContentType

from .models import AuditLog
from .serializers import AuditLogSerializer


class AuditLogListView(generics.ListAPIView):
    serializer_class = AuditLogSerializer

    def get_queryset(self):
        return AuditLog.objects.filter(
            actor__tenant=self.request.user.tenant
        ).select_related("actor", "content_type").order_by("-timestamp")[:200]


class RecordAuditView(APIView):
    """Return audit trail for a specific NormalizedRecord."""

    def get(self, request, pk):
        from emissions.models import NormalizedRecord
        ct = ContentType.objects.get_for_model(NormalizedRecord)
        logs = AuditLog.objects.filter(
            content_type=ct,
            object_id=str(pk),
        ).select_related("actor").order_by("-timestamp")

        serializer = AuditLogSerializer(logs, many=True)
        return Response(serializer.data)
