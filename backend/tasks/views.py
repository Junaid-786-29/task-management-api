from django.db.models import Q
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from .models import Task
from .pagination import TaskPagination
from .permissions import IsTaskOwnerOrReadOnly, IsTaskTeamMember
from .serializers import TaskSerializer

VALID_ORDER_FIELDS = {
    "created_at": "created_at",
    "-created_at": "-created_at",
    "updated_at": "updated_at",
    "-updated_at": "-updated_at",
    "deadline": "deadline",
    "-deadline": "-deadline",
    "priority": "priority",
    "-priority": "-priority",
    "title": "title",
    "-title": "-title",
}


class TaskListCreateView(generics.ListCreateAPIView):
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = TaskPagination

    def get_queryset(self):
        user = self.request.user

        queryset = Task.objects.filter(
            Q(team__members=user) | Q(created_by=user) | Q(assigned_to=user)
        ).distinct()

        status = self.request.query_params.get("status")
        priority = self.request.query_params.get("priority")
        team = self.request.query_params.get("team")
        assigned_to = self.request.query_params.get("assigned_to")
        search = self.request.query_params.get("search")
        ordering = self.request.query_params.get("ordering", "-created_at")

        if status:
            queryset = queryset.filter(status=status)

        if priority:
            queryset = queryset.filter(priority=priority)

        if team:
            queryset = queryset.filter(team_id=team)

        if assigned_to:
            queryset = queryset.filter(assigned_to_id=assigned_to)

        if search:
            queryset = queryset.filter(
                Q(title__icontains=search)
                | Q(description__icontains=search)
            )

        # Safe ordering — only accept whitelisted values
        order_field = VALID_ORDER_FIELDS.get(ordering, "-created_at")
        return queryset.order_by(order_field)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class TaskDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated, IsTaskTeamMember, IsTaskOwnerOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        return Task.objects.filter(
            Q(team__members=user) | Q(created_by=user) | Q(assigned_to=user)
        ).distinct()