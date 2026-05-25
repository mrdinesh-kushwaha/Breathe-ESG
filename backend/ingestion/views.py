from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework import generics, filters
from django_filters.rest_framework import DjangoFilterBackend
from datetime import datetime, timezone

from .models import DataSource, UploadBatch, RawRecord
from .serializers import DataSourceSerializer, UploadBatchSerializer, RawRecordSerializer
from .sap_ingestion import ingest_sap_csv
from .other_ingestion import ingest_utility_csv, ingest_travel_json


class TenantQuerysetMixin:
    """Restrict querysets to the request user's tenant."""
    def get_queryset(self):
        return super().get_queryset().filter(tenant=self.request.user.tenant)


class DataSourceListView(TenantQuerysetMixin, generics.ListCreateAPIView):
    queryset = DataSource.objects.all()
    serializer_class = DataSourceSerializer

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant)


class UploadBatchListView(TenantQuerysetMixin, generics.ListAPIView):
    queryset = UploadBatch.objects.select_related("data_source", "uploaded_by").all()
    serializer_class = UploadBatchSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["status", "data_source__source_type"]
    ordering_fields = ["uploaded_at"]


class UploadBatchDetailView(generics.RetrieveAPIView):
    serializer_class = UploadBatchSerializer

    def get_queryset(self):
        return UploadBatch.objects.filter(tenant=self.request.user.tenant)


class SAPUploadView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        source_id = request.data.get("data_source_id")
        csv_file = request.FILES.get("file")

        if not csv_file:
            return Response({"detail": "No file provided."}, status=400)
        if not source_id:
            return Response({"detail": "data_source_id is required."}, status=400)

        try:
            data_source = DataSource.objects.get(
                id=source_id,
                tenant=request.user.tenant,
                source_type=DataSource.SOURCE_SAP,
            )
        except DataSource.DoesNotExist:
            return Response({"detail": "SAP data source not found."}, status=404)

        batch = UploadBatch.objects.create(
            tenant=request.user.tenant,
            data_source=data_source,
            uploaded_by=request.user,
            original_filename=csv_file.name,
            status=UploadBatch.STATUS_PROCESSING,
        )

        try:
            summary = ingest_sap_csv(csv_file, batch, actor=request.user)
        except Exception as e:
            batch.status = UploadBatch.STATUS_FAILED
            batch.error_log = str(e)
            batch.save()
            return Response({"detail": f"Ingestion failed: {e}"}, status=500)

        return Response({
            "batch_id": str(batch.id),
            "summary": summary,
        }, status=201)


class UtilityUploadView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        source_id = request.data.get("data_source_id")
        csv_file = request.FILES.get("file")

        if not csv_file:
            return Response({"detail": "No file provided."}, status=400)
        if not source_id:
            return Response({"detail": "data_source_id is required."}, status=400)

        try:
            data_source = DataSource.objects.get(
                id=source_id,
                tenant=request.user.tenant,
                source_type=DataSource.SOURCE_UTILITY,
            )
        except DataSource.DoesNotExist:
            return Response({"detail": "Utility data source not found."}, status=404)

        batch = UploadBatch.objects.create(
            tenant=request.user.tenant,
            data_source=data_source,
            uploaded_by=request.user,
            original_filename=csv_file.name,
            status=UploadBatch.STATUS_PROCESSING,
        )

        try:
            summary = ingest_utility_csv(csv_file, batch, actor=request.user)
        except Exception as e:
            batch.status = UploadBatch.STATUS_FAILED
            batch.error_log = str(e)
            batch.save()
            return Response({"detail": f"Ingestion failed: {e}"}, status=500)

        return Response({"batch_id": str(batch.id), "summary": summary}, status=201)


class TravelUploadView(APIView):
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def post(self, request):
        source_id = request.data.get("data_source_id")

        if not source_id:
            return Response({"detail": "data_source_id is required."}, status=400)

        try:
            data_source = DataSource.objects.get(
                id=source_id,
                tenant=request.user.tenant,
                source_type=DataSource.SOURCE_TRAVEL,
            )
        except DataSource.DoesNotExist:
            return Response({"detail": "Travel data source not found."}, status=404)

        # Accept either JSON body or file upload
        if request.FILES.get("file"):
            json_data = request.FILES["file"].read()
            filename = request.FILES["file"].name
        else:
            json_data = request.data.get("payload")
            filename = "api_payload.json"

        if not json_data:
            return Response({"detail": "No JSON payload or file provided."}, status=400)

        batch = UploadBatch.objects.create(
            tenant=request.user.tenant,
            data_source=data_source,
            uploaded_by=request.user,
            original_filename=filename,
            status=UploadBatch.STATUS_PROCESSING,
        )

        try:
            summary = ingest_travel_json(json_data, batch, actor=request.user)
        except Exception as e:
            batch.status = UploadBatch.STATUS_FAILED
            batch.error_log = str(e)
            batch.save()
            return Response({"detail": f"Ingestion failed: {e}"}, status=500)

        return Response({"batch_id": str(batch.id), "summary": summary}, status=201)
