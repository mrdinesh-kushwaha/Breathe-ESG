from rest_framework import serializers
from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source="actor.full_name", read_only=True)
    actor_email = serializers.CharField(source="actor.email", read_only=True)
    model_name = serializers.CharField(source="content_type.model", read_only=True)
    action_display = serializers.CharField(source="get_action_display", read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            "id", "actor", "actor_name", "actor_email",
            "action", "action_display",
            "model_name", "object_id",
            "field_name", "old_value", "new_value",
            "note", "timestamp",
        ]
        read_only_fields = fields
