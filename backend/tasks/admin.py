from django.contrib import admin
from .models import Task


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "status", "priority", "created_by", "assigned_to", "team", "created_at")
    list_filter = ("status", "priority", "team")
    search_fields = ("title", "description", "created_by__username", "assigned_to__username")
