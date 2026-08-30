from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Team


User = get_user_model()


class TeamMemberDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name"]


class TeamSerializer(serializers.ModelSerializer):
    created_by = serializers.ReadOnlyField(source="created_by.username")
    members = serializers.PrimaryKeyRelatedField(
        many=True,
        read_only=True,
    )
    members_detail = TeamMemberDetailSerializer(
        source="members",
        many=True,
        read_only=True,
    )
    task_count = serializers.SerializerMethodField()

    class Meta:
        model = Team
        fields = [
            "id",
            "name",
            "description",
            "created_by",
            "members",
            "members_detail",
            "task_count",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "created_by",
            "members",
            "members_detail",
            "task_count",
            "created_at",
        ]

    def get_task_count(self, obj):
        return obj.tasks.count()


class TeamMemberSerializer(serializers.Serializer):
    user_id = serializers.IntegerField(required=False)
    username = serializers.CharField(required=False)
    email = serializers.EmailField(required=False)