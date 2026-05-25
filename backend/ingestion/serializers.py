from rest_framework import serializers
from .models import DataSource, UploadBatch, RawRecord


class DataSourceSerializer(serializers.ModelSerializer):
    source_type_display = serializers.CharField(source="get_source_type_display", read_only=True)

    class Meta:
        model = DataSource
        fields = ["id", "name", "source_type", "source_type_display", "description", "column_mapping", "created_at"]
        read_only_fields = ["id", "created_at"]


class UploadBatchSerializer(serializers.ModelSerializer):
    data_source_name = serializers.CharField(source="data_source.name", read_only=True)
    source_type = serializers.CharField(source="data_source.source_type", read_only=True)
    uploaded_by_name = serializers.CharField(source="uploaded_by.full_name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = UploadBatch
        fields = [
            "id", "data_source", "data_source_name", "source_type",
            "uploaded_by_name", "original_filename",
            "status", "status_display",
            "total_rows", "processed_rows", "flagged_rows",
            "error_log", "uploaded_at", "completed_at",
        ]
        read_only_fields = fields


class RawRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = RawRecord
        fields = ["id", "row_index", "raw_data", "parse_error", "created_at"]
