"""
URL configuration for config project.
"""
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from rest_framework_simplejwt.views import TokenRefreshView

from users.views import CustomTokenObtainPairView


def api_root_view(request):
    return JsonResponse({
        "message": "Task Management API is running",
        "endpoints": {
            "auth_register": "/api/auth/register/",
            "auth_login": "/api/auth/login/",
            "auth_refresh": "/api/auth/refresh/",
            "auth_me": "/api/auth/me/",
            "tasks": "/api/tasks/",
            "tasks_statistics": "/api/tasks/statistics/",
            "teams": "/api/teams/",
        }
    })


urlpatterns = [
    path('', api_root_view, name="api-root"),
    path('admin/', admin.site.urls),
    path('api/tasks/', include("tasks.urls")),

    # Register
    path('api/auth/', include("users.urls")),

    # Team Routes
    path('api/teams/', include("teams.urls")),

    # Token Login (email/username-based) & Refresh
    path('api/auth/login/', CustomTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name="token_refresh"),
]
