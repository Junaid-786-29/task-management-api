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
from teams.models import Team
from tasks.models import Task

User = get_user_model()

def run_tests():
    print("=== STARTING PHASE 11 TEAMS & COLLABORATION VERIFICATION ===")

    # 1. Setup test users
    user_a, _ = User.objects.get_or_create(
        username="test_owner_a",
        defaults={"email": "owner_a@test.com"}
    )
    user_a.set_password("OwnerPass123!")
    user_a.save()

    user_b, _ = User.objects.get_or_create(
        username="test_member_b",
        defaults={"email": "member_b@test.com"}
    )
    user_b.set_password("MemberPass123!")
    user_b.save()

    user_c, _ = User.objects.get_or_create(
        username="test_other_c",
        defaults={"email": "other_c@test.com"}
    )
    user_c.set_password("OtherPass123!")
    user_c.save()

    # Clean up previous test teams/tasks
    Team.objects.filter(name__startswith="Test Team").delete()

    client_a = APIClient()
    client_a.force_authenticate(user=user_a)

    client_b = APIClient()
    client_b.force_authenticate(user=user_b)

    client_c = APIClient()
    client_c.force_authenticate(user=user_c)

    # 2. Test Team Creation by User A
    print("\n[TEST 1] User A creates Team...")
    res = client_a.post("/api/teams/", {"name": "Test Team Alpha", "description": "Alpha team description"}, format="json")
    assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.data}"
    team_id = res.data["id"]
    print(f"-> Team created successfully with ID: {team_id}")

    # 3. Verify Database
    print("\n[TEST 2] Database verification for Team creation...")
    team_db = Team.objects.get(id=team_id)
    assert team_db.name == "Test Team Alpha"
    assert team_db.created_by == user_a
    assert team_db.members.filter(id=user_a.id).exists()
    print("-> DB confirmed: team row exists, owner is user_a, owner is in members.")

    # 4. User A adds User B to Team
    print("\n[TEST 3] User A adds User B to Team...")
    res = client_a.post(f"/api/teams/{team_id}/members/", {"user_id": user_b.id}, format="json")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.data}"
    print(f"-> Response: {res.data['detail']}")

    # 5. Verify Database Membership
    print("\n[TEST 4] Database verification for membership...")
    assert team_db.members.filter(id=user_b.id).exists()
    print("-> DB confirmed: user_b is now in teams_team_members.")

    # 6. User B logs in and views Team
    print("\n[TEST 5] User B views Team list and detail...")
    res = client_b.get("/api/teams/")
    assert res.status_code == 200
    team_names = [t["name"] for t in (res.data if isinstance(res.data, list) else res.data.get("results", []))]
    assert "Test Team Alpha" in team_names
    print(f"-> User B can see team in list: {team_names}")

    res_detail = client_b.get(f"/api/teams/{team_id}/")
    assert res_detail.status_code == 200
    assert res_detail.data["created_by"] == "test_owner_a"
    print("-> User B successfully retrieved team detail.")

    # 7. User B attempts Owner-Only operations (Add member, Remove member, Delete team)
    print("\n[TEST 6] User B attempts Owner-Only operations (expecting 403)...")
    
    # 7a. User B tries to add User C
    res = client_b.post(f"/api/teams/{team_id}/members/", {"user_id": user_c.id}, format="json")
    assert res.status_code == 403, f"Expected 403, got {res.status_code}: {res.data}"
    print(f"-> User B add member denied with 403: {res.data.get('detail')}")

    # 7b. User B tries to remove User A
    res = client_b.delete(f"/api/teams/{team_id}/members/{user_a.id}/")
    assert res.status_code == 403, f"Expected 403, got {res.status_code}: {res.data}"
    print(f"-> User B remove member denied with 403: {res.data.get('detail')}")

    # 7c. User B tries to delete the team
    res = client_b.delete(f"/api/teams/{team_id}/")
    assert res.status_code == 403, f"Expected 403, got {res.status_code}: {res.data}"
    print(f"-> User B delete team denied with 403: {res.data.get('detail')}")

    # 8. Non-member User C attempts to access Team
    print("\n[TEST 7] Non-member User C attempts to access Team...")
    res = client_c.get(f"/api/teams/{team_id}/")
    assert res.status_code in [403, 404], f"Expected 403/404, got {res.status_code}"
    print(f"-> User C access denied as expected ({res.status_code}).")

    # 9. Create task assigned to team & check task_count
    print("\n[TEST 8] Assign task to team and check task_count...")
    task_res = client_a.post("/api/tasks/", {
        "title": "Alpha Sprint Goal",
        "description": "Team project deliverable",
        "status": "in_progress",
        "priority": "high",
        "team": team_id,
        "assigned_to": user_b.id
    }, format="json")
    assert task_res.status_code == 201, f"Expected 201, got {task_res.status_code}: {task_res.data}"
    task_id = task_res.data["id"]
    print(f"-> Task created with ID {task_id}, team={team_id}, assigned_to={user_b.id}")

    # Check team serializer has task_count == 1
    res = client_a.get(f"/api/teams/{team_id}/")
    assert res.data.get("task_count") == 1, f"Expected task_count=1, got {res.data.get('task_count')}"
    print("-> Team detail task_count correctly reflects associated tasks (1).")

    # 10. Filter tasks by team
    print("\n[TEST 9] Server-side filter tasks by team...")
    res = client_a.get(f"/api/tasks/?team={team_id}")
    assert res.status_code == 200
    results = res.data.get("results", res.data)
    assert len(results) >= 1
    assert any(t["id"] == task_id for t in results)
    print(f"-> Task filter by team returned {len(results)} task(s).")

    # 11. User A removes User B from Team
    print("\n[TEST 10] User A removes User B from Team...")
    res = client_a.delete(f"/api/teams/{team_id}/members/{user_b.id}/")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.data}"
    print(f"-> User removed: {res.data.get('detail')}")

    # Verify DB
    team_db.refresh_from_db()
    assert not team_db.members.filter(id=user_b.id).exists()
    print("-> DB confirmed: user_b is no longer in teams_team_members.")

    # 12. Cleanup
    Task.objects.filter(id=task_id).delete()
    Team.objects.filter(id=team_id).delete()
    print("\n[CLEANUP] Test records cleaned up.")
    print("\n=== ALL PHASE 11 TESTS PASSED SUCCESSFULLY! ===")
    sys.exit(0)

if __name__ == "__main__":
    run_tests()
