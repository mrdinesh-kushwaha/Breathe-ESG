from rest_framework import serializers, generics, filters
from django_filters.rest_framework import DjangoFilterBackend
from .models import NormalizedRecord
from ingestion.serializers import RawRecordSerializer


class NormalizedRecordSerializer(serializers.ModelSerializer):
    scope_category_display = serializers.CharField(source="get_scope_category_display", read_only=True)
    review_status_display = serializers.CharField(source="get_review_status_display", read_only=True)
    source_type_display = serializers.CharField(source="get_source_type_display", read_only=True)
    approved_by_name = serializers.CharField(source="approved_by.full_name", read_only=True)
    raw_record = RawRecordSerializer(read_only=True)

    class Meta:
        model = NormalizedRecord
        fields = [
            "id", "tenant", "batch",
            "source_type", "source_type_display", "source_row_id",
            "activity_type",
            "scope_category", "scope_category_display",
            "original_unit", "original_value",
            "normalized_unit", "normalized_value",
            "emission_factor", "estimated_emissions",
            "suspicious_flag", "suspicious_reason",
            "review_status", "review_status_display",
            "approved_by", "approved_by_name", "approved_at",
            "period_start", "period_end",
            "created_at", "updated_at",
            "raw_record",
        ]
        read_only_fields = fields
