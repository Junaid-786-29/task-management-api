from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsTeamOwner(BasePermission):
    message = "Only the team owner can manage team members."

    def has_object_permission(self, request, view, obj):
        return obj.created_by == request.user


class IsTeamOwnerOrReadOnly(BasePermission):
    message = "Only the team owner can edit or delete this team."

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        return obj.created_by == request.user