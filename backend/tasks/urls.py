from django.urls import path
from .dashboard import TaskStatisticsView

from .views import TaskListCreateView, TaskDetailView

urlpatterns = [
    path("", TaskListCreateView.as_view(), name="task-list-create"),
    path("statistics/", TaskStatisticsView.as_view()),
    path("<int:pk>/", TaskDetailView.as_view(), name="task-detail"),
]

