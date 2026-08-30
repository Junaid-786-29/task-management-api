from django.urls import path

from .views import (
    TeamDetailView,
    TeamListCreateView,
    TeamMemberView,
)


urlpatterns = [
    path("", TeamListCreateView.as_view(), name="team-list-create"),
    path("<int:pk>/", TeamDetailView.as_view(), name="team-detail"),
    path(
        "<int:pk>/members/",
        TeamMemberView.as_view(),
        name="team-members",
    ),
    path(
        "<int:pk>/members/<int:user_id>/",
        TeamMemberView.as_view(),
        name="team-member-by-id",
    ),
]