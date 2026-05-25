from rest_framework import serializers
from .models import ReviewDecision


class ReviewDecisionSerializer(serializers.ModelSerializer):
    reviewer_name = serializers.CharField(source="reviewer.full_name", read_only=True)
    action_display = serializers.CharField(source="get_action_display", read_only=True)

    class Meta:
        model = ReviewDecision
        fields = ["id", "record", "reviewer", "reviewer_name", "action", "action_display", "comment", "decided_at"]
        read_only_fields = fields
