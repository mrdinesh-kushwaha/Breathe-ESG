import uuid
from django.db import models
from tenants.models import Tenant, User


class DataSource(models.Model):
    """
    Represents a configured data feed for a tenant — e.g. "SAP ECC Production"
    or "UK Electricity Portal". Source config lives here so multiple batches
    can reference the same source without duplicating metadata.
    """
    SOURCE_SAP = "sap_export"
    SOURCE_UTILITY = "utility_portal"
    SOURCE_TRAVEL = "travel_api"
    SOURCE_CHOICES = [
        (SOURCE_SAP, "SAP Export"),
        (SOURCE_UTILITY, "Utility Portal"),
        (SOURCE_TRAVEL, "Travel API (Concur/Navan)"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="data_sources")
    name = models.CharField(max_length=255)
    source_type = models.CharField(max_length=30, choices=SOURCE_CHOICES)
    description = models.TextField(blank=True)
    # Column mapping overrides for SAP: store as JSON {"Menge": "quantity", ...}
    column_mapping = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.get_source_type_display()})"

    class Meta:
        ordering = ["tenant", "name"]


class UploadBatch(models.Model):
    """
    A single upload event — one CSV file or one API pull.
    Tracks lifecycle from ingestion to completion.
    """
    STATUS_PENDING = "pending"
    STATUS_PROCESSING = "processing"
    STATUS_COMPLETE = "complete"
    STATUS_FAILED = "failed"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_PROCESSING, "Processing"),
        (STATUS_COMPLETE, "Complete"),
        (STATUS_FAILED, "Failed"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="upload_batches")
    data_source = models.ForeignKey(DataSource, on_delete=models.PROTECT, related_name="batches")
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="uploads")
    original_filename = models.CharField(max_length=500, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    total_rows = models.IntegerField(default=0)
    processed_rows = models.IntegerField(default=0)
    flagged_rows = models.IntegerField(default=0)
    error_log = models.TextField(blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Batch {self.id} — {self.data_source.name} ({self.status})"

    class Meta:
        ordering = ["-uploaded_at"]


class RawRecord(models.Model):
    """
    Immutable copy of an inbound row exactly as received.
    We never modify raw records — they are the source of truth.
    If re-ingestion is needed, a new batch is created.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    batch = models.ForeignKey(UploadBatch, on_delete=models.CASCADE, related_name="raw_records")
    row_index = models.IntegerField()  # Original row number in the source file
    raw_data = models.JSONField()      # Exact key-value dict from parsed CSV/JSON
    parse_error = models.TextField(blank=True)  # Non-fatal parse issues noted here
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["batch", "row_index"]
        unique_together = [["batch", "row_index"]]
