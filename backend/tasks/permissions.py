from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsTaskTeamMember(BasePermission):
    message = "You do not have permission to access this task."

    def has_object_permission(self, request, view, obj):
        # Creator and assignee always have access
        if obj.created_by == request.user or obj.assigned_to == request.user:
            return True
        # Team members have access if task is assigned to a team
        if obj.team is not None:
            return obj.team.members.filter(id=request.user.id).exists()
        return False


class IsTaskOwnerOrReadOnly(BasePermission):
    """Only the task creator can modify/delete. Others (e.g. assignees/team members) can read."""
    message = "Only the task creator can modify or delete this task."

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        return obj.created_by == request.user
