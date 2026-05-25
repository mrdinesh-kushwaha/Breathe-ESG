import uuid
from django.db import models
from tenants.models import Tenant, User
from ingestion.models import RawRecord, UploadBatch


class NormalizedRecord(models.Model):
    """
    The canonical emissions record derived from a RawRecord.
    Once approved, this record becomes immutable.

    Scope classification:
      Scope 1 — Direct combustion (SAP fuel)
      Scope 2 — Purchased electricity (utility)
      Scope 3 — Business travel, supply chain (travel)
    """
    SCOPE_1 = "scope_1"
    SCOPE_2 = "scope_2"
    SCOPE_3 = "scope_3"
    SCOPE_CHOICES = [
        (SCOPE_1, "Scope 1 — Direct"),
        (SCOPE_2, "Scope 2 — Electricity"),
        (SCOPE_3, "Scope 3 — Value Chain"),
    ]

    REVIEW_PENDING = "pending"
    REVIEW_APPROVED = "approved"
    REVIEW_REJECTED = "rejected"
    REVIEW_CHOICES = [
        (REVIEW_PENDING, "Pending Review"),
        (REVIEW_APPROVED, "Approved"),
        (REVIEW_REJECTED, "Rejected"),
    ]

    SOURCE_SAP = "sap_export"
    SOURCE_UTILITY = "utility_portal"
    SOURCE_TRAVEL = "travel_api"
    SOURCE_CHOICES = [
        (SOURCE_SAP, "SAP Export"),
        (SOURCE_UTILITY, "Utility Portal"),
        (SOURCE_TRAVEL, "Travel API"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="normalized_records")
    batch = models.ForeignKey(UploadBatch, on_delete=models.CASCADE, related_name="normalized_records")
    raw_record = models.OneToOneField(RawRecord, on_delete=models.CASCADE, related_name="normalized")

    # Lineage
    source_type = models.CharField(max_length=30, choices=SOURCE_CHOICES)
    source_row_id = models.CharField(max_length=100, blank=True)  # SAP doc num, meter ID, booking ref

    # Classification
    activity_type = models.CharField(max_length=100)  # e.g. "diesel_combustion", "flight_economy"
    scope_category = models.CharField(max_length=10, choices=SCOPE_CHOICES)

    # Values as-received
    original_unit = models.CharField(max_length=50)
    original_value = models.FloatField()

    # Normalised values (always to kg CO2e)
    normalized_unit = models.CharField(max_length=50, default="kg")
    normalized_value = models.FloatField()

    # Emissions calculation
    emission_factor = models.FloatField()   # kg CO2e per normalized unit
    estimated_emissions = models.FloatField()  # kg CO2e

    # Data quality
    suspicious_flag = models.BooleanField(default=False)
    suspicious_reason = models.TextField(blank=True)

    # Review lifecycle
    review_status = models.CharField(max_length=20, choices=REVIEW_CHOICES, default=REVIEW_PENDING)
    approved_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name="approved_records"
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    # Metadata period for the record (billing/reporting month)
    period_start = models.DateField(null=True, blank=True)
    period_end = models.DateField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.activity_type} | {self.estimated_emissions:.2f} kg CO2e ({self.review_status})"

    @property
    def is_immutable(self):
        return self.review_status == self.REVIEW_APPROVED

    def save(self, *args, **kwargs):
        # Enforce immutability after approval at the model layer.
        # We check if the instance already exists and is approved.
        if self.pk:
            try:
                existing = NormalizedRecord.objects.get(pk=self.pk)
                if existing.review_status == self.REVIEW_APPROVED:
                    raise ValueError(
                        f"Record {self.pk} is approved and immutable. "
                        "Create a corrected record instead."
                    )
            except NormalizedRecord.DoesNotExist:
                pass
        super().save(*args, **kwargs)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["tenant", "review_status"]),
            models.Index(fields=["tenant", "suspicious_flag"]),
            models.Index(fields=["tenant", "scope_category"]),
        ]
