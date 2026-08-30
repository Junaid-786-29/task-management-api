import os
import sys
import logging

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import django
django.setup()

# Silence standard DRF 403/404 server request loggers during test
logging.getLogger("django.request").setLevel(logging.CRITICAL)

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from tasks.models import Task
from teams.models import Team

User = get_user_model()

def run_full_suite():
    print("=" * 60)
    print("RUNNING COMPREHENSIVE PRODUCTION TEST SUITE (PHASE 1-12)")
    print("=" * 60)

    # 1. User Setup
    User.objects.filter(username__startswith="suite_").delete()
    Team.objects.filter(name__startswith="Suite Team").delete()

    client = APIClient()

    # 2. Registration
    print("\n[AUTH 1] Testing user registration (POST /api/auth/register/)...")
    res = client.post("/api/auth/register/", {
        "username": "suite_user1",
        "email": "suite_user1@example.com",
        "password": "Password123!",
        "first_name": "Suite",
        "last_name": "One"
    }, format="json")
    assert res.status_code == 201, f"Registration failed: {res.data}"
    user1_id = res.data["id"]
    print("-> Registered suite_user1 successfully.")

    res_user2 = client.post("/api/auth/register/", {
        "username": "suite_user2",
        "email": "suite_user2@example.com",
        "password": "Password123!",
        "first_name": "Suite",
        "last_name": "Two"
    }, format="json")
    assert res_user2.status_code == 201
    user2_id = res_user2.data["id"]
    print("-> Registered suite_user2 successfully.")

    # 3. Login with Email
    print("\n[AUTH 2] Testing login with Email (POST /api/auth/login/)...")
    res = client.post("/api/auth/login/", {
        "email": "suite_user1@example.com",
        "password": "Password123!"
    }, format="json")
    assert res.status_code == 200, f"Email login failed: {res.data}"
    assert "access" in res.data and "refresh" in res.data
    token1 = res.data["access"]
    refresh1 = res.data["refresh"]
    print("-> Email login returned valid JWT access + refresh tokens.")

    # 4. Login with Username
    print("\n[AUTH 3] Testing login with Username (POST /api/auth/login/)...")
    res = client.post("/api/auth/login/", {
        "username": "suite_user2",
        "password": "Password123!"
    }, format="json")
    assert res.status_code == 200, f"Username login failed: {res.data}"
    token2 = res.data["access"]
    print("-> Username login returned valid JWT access + refresh tokens.")

    # 5. Token Refresh
    print("\n[AUTH 4] Testing token refresh (POST /api/auth/refresh/)...")
    res = client.post("/api/auth/refresh/", {"refresh": refresh1}, format="json")
    assert res.status_code == 200, f"Token refresh failed: {res.data}"
    assert "access" in res.data
    print("-> Token refresh successful.")

    # Authenticate client 1 and client 2
    client1 = APIClient()
    client1.credentials(HTTP_AUTHORIZATION=f"Bearer {token1}")

    client2 = APIClient()
    client2.credentials(HTTP_AUTHORIZATION=f"Bearer {token2}")

    # 6. Current User Profile
    print("\n[AUTH 5] Testing GET /api/auth/me/...")
    res = client1.get("/api/auth/me/")
    assert res.status_code == 200
    assert res.data["username"] == "suite_user1"
    assert res.data["email"] == "suite_user1@example.com"
    print("-> GET /api/auth/me/ returned correct user data.")

    # 7. User List
    print("\n[AUTH 6] Testing GET /api/auth/users/...")
    res = client1.get("/api/auth/users/")
    assert res.status_code == 200
    users = res.data if isinstance(res.data, list) else res.data.get("results", [])
    assert any(u["username"] == "suite_user2" for u in users)
    print(f"-> GET /api/auth/users/ returned {len(users)} registered users.")

    # 8. Task CRUD
    print("\n[TASKS 1] Testing Task creation (POST /api/tasks/)...")
    res = client1.post("/api/tasks/", {
        "title": "Production Deployment",
        "description": "Verify all services before release",
        "status": "todo",
        "priority": "urgent",
        "deadline": "2026-12-31T23:59:59Z"
    }, format="json")
    assert res.status_code == 201, f"Task creation failed: {res.data}"
    task1_id = res.data["id"]
    print(f"-> Task created with ID: {task1_id}")

    print("\n[TASKS 2] Testing Task update (PATCH /api/tasks/<id>/)...")
    res = client1.patch(f"/api/tasks/{task1_id}/", {
        "status": "in_progress",
        "title": "Production Deployment Updated"
    }, format="json")
    assert res.status_code == 200
    assert res.data["status"] == "in_progress"
    assert res.data["title"] == "Production Deployment Updated"
    print("-> Task updated status to 'in_progress'.")

    print("\n[TASKS 3] Testing Task detail (GET /api/tasks/<id>/)...")
    res = client1.get(f"/api/tasks/{task1_id}/")
    assert res.status_code == 200
    assert res.data["created_by"] == "suite_user1"
    print("-> Task detail retrieved successfully.")

    print("\n[TASKS 4] Testing Task listing with filters, ordering & pagination...")
    res = client1.get("/api/tasks/?status=in_progress&ordering=-created_at&page=1")
    assert res.status_code == 200
    assert res.data["count"] >= 1
    print(f"-> Task list returned count={res.data['count']} with pagination metadata.")

    print("\n[TASKS 5] Testing Task statistics (GET /api/tasks/statistics/)...")
    res = client1.get("/api/tasks/statistics/")
    assert res.status_code == 200
    assert res.data["total"] >= 1
    assert res.data["in_progress"] >= 1
    print(f"-> Task statistics: total={res.data['total']}, in_progress={res.data['in_progress']}.")

    # 9. Teams CRUD & Collaboration
    print("\n[TEAMS 1] Testing Team creation (POST /api/teams/)...")
    res = client1.post("/api/teams/", {
        "name": "Suite Team DevOps",
        "description": "Infrastructure and Deployment"
    }, format="json")
    assert res.status_code == 201, f"Team creation failed: {res.data}"
    team_id = res.data["id"]
    print(f"-> Team created with ID: {team_id}")

    print("\n[TEAMS 2] Testing Add Member to Team (POST /api/teams/<id>/members/)...")
    res = client1.post(f"/api/teams/{team_id}/members/", {
        "user_id": user2_id
    }, format="json")
    assert res.status_code == 200
    print("-> Added suite_user2 to team successfully.")

    print("\n[TEAMS 3] Testing Team retrieval by member (GET /api/teams/<id>/)...")
    res = client2.get(f"/api/teams/{team_id}/")
    assert res.status_code == 200
    assert res.data["name"] == "Suite Team DevOps"
    assert res.data["created_by"] == "suite_user1"
    print("-> Member suite_user2 successfully accessed team detail.")

    print("\n[PERMISSIONS] Testing non-owner permission enforcement (403)...")
    # User 2 tries to remove User 1 (owner) or manage members
    res = client2.delete(f"/api/teams/{team_id}/members/{user1_id}/")
    assert res.status_code == 403
    print("-> Non-owner member removal correctly rejected with 403.")

    # User 2 tries to delete team
    res = client2.delete(f"/api/teams/{team_id}/")
    assert res.status_code == 403
    print("-> Non-owner team deletion correctly rejected with 403.")

    # User 2 tries to delete User 1's personal task
    res = client2.delete(f"/api/tasks/{task1_id}/")
    assert res.status_code in (403, 404)
    print("-> Unauthorized task deletion correctly rejected.")

    # 10. Assign Task to Team
    print("\n[COLLAB] Testing team task assignment...")
    res = client1.post("/api/tasks/", {
        "title": "CI/CD Pipeline Setup",
        "team": team_id,
        "assigned_to": user2_id,
        "status": "todo",
        "priority": "high"
    }, format="json")
    assert res.status_code == 201
    team_task_id = res.data["id"]
    print(f"-> Created team task #{team_task_id} assigned to suite_user2.")

    # Verify User 2 can view this team task
    res = client2.get(f"/api/tasks/{team_task_id}/")
    assert res.status_code == 200
    print("-> Assigned team member suite_user2 can view team task.")

    # Verify team task_count
    res = client1.get(f"/api/teams/{team_id}/")
    assert res.data.get("task_count") == 1
    print("-> Team task_count is 1.")

    # 11. Cleanup
    Task.objects.filter(id__in=[task1_id, team_task_id]).delete()
    Team.objects.filter(id=team_id).delete()
    User.objects.filter(username__in=["suite_user1", "suite_user2"]).delete()
    print("\n[CLEANUP] All test data cleaned up.")

    print("\n" + "=" * 60)
    print("ALL TESTS PASSED SUCCESSFULLY! (100% SUCCESS RATE)")
    print("=" * 60)
    sys.exit(0)

if __name__ == "__main__":
    run_full_suite()
