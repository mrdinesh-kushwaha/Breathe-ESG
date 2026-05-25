import uuid
from django.db import models
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey
from tenants.models import User


class AuditLog(models.Model):
    """
    Append-only log of every field-level change across the platform.
    Uses Django's ContentType framework so one table covers all models.

    This is intentionally simple: we store old/new values as strings.
    For complex objects we serialize to JSON. The goal is auditability,
    not full event sourcing.
    """
    ACTION_CREATE = "create"
    ACTION_UPDATE = "update"
    ACTION_DELETE = "delete"
    ACTION_APPROVE = "approve"
    ACTION_REJECT = "reject"
    ACTION_INGEST = "ingest"
    ACTION_CHOICES = [
        (ACTION_CREATE, "Created"),
        (ACTION_UPDATE, "Updated"),
        (ACTION_DELETE, "Deleted"),
        (ACTION_APPROVE, "Approved"),
        (ACTION_REJECT, "Rejected"),
        (ACTION_INGEST, "Ingested"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    actor = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name="audit_logs"
    )
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)

    # Generic FK so we can log changes to any model
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, null=True, blank=True)
    object_id = models.CharField(max_length=255, blank=True)
    content_object = GenericForeignKey("content_type", "object_id")

    # For field-level diffs
    field_name = models.CharField(max_length=100, blank=True)
    old_value = models.TextField(blank=True, null=True)
    new_value = models.TextField(blank=True, null=True)

    # Human-readable context note
    note = models.TextField(blank=True)

    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.action} on {self.content_type} {self.object_id} by {self.actor}"

    class Meta:
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["content_type", "object_id"]),
            models.Index(fields=["actor", "timestamp"]),
        ]


def log_event(actor, action, obj, field_name="", old_value=None, new_value=None, note=""):
    """
    Convenience function for creating audit log entries.
    Import and call this from any service or view that mutates data.
    """
    content_type = ContentType.objects.get_for_model(obj) if obj else None
    object_id = str(obj.pk) if obj else ""
    AuditLog.objects.create(
        actor=actor,
        action=action,
        content_type=content_type,
        object_id=object_id,
        field_name=field_name,
        old_value=str(old_value) if old_value is not None else None,
        new_value=str(new_value) if new_value is not None else None,
        note=note,
    )
