from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Task


User = get_user_model()


class TaskSerializer(serializers.ModelSerializer):
    created_by = serializers.ReadOnlyField(source="created_by.username")
    team_name = serializers.ReadOnlyField(source="team.name")
    assigned_to_username = serializers.ReadOnlyField(source="assigned_to.username")

    class Meta:
        model = Task
        fields = [
            "id",
            "title",
            "description",
            "status",
            "priority",
            "deadline",
            "team",
            "team_name",
            "created_by",
            "assigned_to",
            "assigned_to_username",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_by",
            "team_name",
            "assigned_to_username",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        team = attrs.get("team")
        assigned_to = attrs.get("assigned_to")

        if team and assigned_to:
            if not team.members.filter(id=assigned_to.id).exists():
                raise serializers.ValidationError(
                    {
                        "assigned_to": (
                            "The assigned user must be a member of the selected team."
                        )
                    }
                )

        return attrs