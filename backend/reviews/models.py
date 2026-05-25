import uuid
from django.db import models
from tenants.models import User
from emissions.models import NormalizedRecord


class ReviewDecision(models.Model):
    """
    Each analyst action on a NormalizedRecord is recorded here.
    A record can have multiple decisions if it is rejected and resubmitted
    (though the current flow keeps things simple: one active decision per record).
    """
    ACTION_APPROVE = "approve"
    ACTION_REJECT = "reject"
    ACTION_FLAG = "flag"
    ACTION_CHOICES = [
        (ACTION_APPROVE, "Approved"),
        (ACTION_REJECT, "Rejected"),
        (ACTION_FLAG, "Flagged for Follow-up"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    record = models.ForeignKey(
        NormalizedRecord, on_delete=models.CASCADE, related_name="decisions"
    )
    reviewer = models.ForeignKey(User, on_delete=models.PROTECT, related_name="decisions")
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    comment = models.TextField(blank=True)
    decided_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.action} by {self.reviewer.email} at {self.decided_at:%Y-%m-%d %H:%M}"

    class Meta:
        ordering = ["-decided_at"]
