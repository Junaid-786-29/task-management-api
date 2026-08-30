from django.db.models import Count, Q
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Task


class TaskStatisticsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        tasks = Task.objects.filter(
            Q(team__members=request.user)
            | Q(created_by=request.user)
            | Q(assigned_to=request.user)
        ).distinct()

        statistics = tasks.aggregate(
            total=Count("id"),
            todo=Count("id", filter=Q(status="todo")),
            in_progress=Count("id", filter=Q(status="in_progress")),
            completed=Count("id", filter=Q(status="completed")),
        )

        return Response(statistics)