import json
from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile

from .models import (
    UserProfile,
    Team,
    TeamMember,
    ProjectSubmission,
    Query,
    ChatMessage,
    ActivityNotification,
)


class IdeaAppTests(TestCase):
    def setUp(self):
        self.client = Client()

    def _create_student(self, email="jane@example.com", name="Jane Student", team_name="Byte Force"):
        payload = {
            "name": name,
            "email": email,
            "password": "Password123!",
            "role": "student",
            "post": "Team leader",
            "department": "Computer Science",
            "teamName": team_name
        }
        return self.client.post("/api/auth/signup/", data=json.dumps(payload), content_type="application/json")

    def _create_teacher(self, email="turing@university.edu", name="Prof. Alan Turing"):
        payload = {
            "name": name,
            "email": email,
            "password": "Password123!",
            "role": "teacher",
            "post": "Administrator",
            "department": "Computer Science",
            "teamName": ""
        }
        return self.client.post("/api/auth/signup/", data=json.dumps(payload), content_type="application/json")

    def test_signup_student(self):
        res = self._create_student()
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["user"]["email"], "jane@example.com")

        # Verify database
        user = User.objects.get(email="jane@example.com")
        self.assertEqual(user.profile.role, "student")
        self.assertEqual(user.profile.department, "Computer Science")

        team = Team.objects.get(name="Byte Force")
        self.assertEqual(team.created_by, user)
        self.assertEqual(team.members.count(), 1)
        self.assertTrue(team.members.first().is_leader)

    def test_signup_student_without_team_name(self):
        payload = {
            "name": "Alex River",
            "email": "alex@example.com",
            "password": "Password123!",
            "role": "student",
            "post": "Team leader",
            "department": "Mechanical Engineering"
        }
        res = self.client.post("/api/auth/signup/", data=json.dumps(payload), content_type="application/json")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()["success"])

        user = User.objects.get(email="alex@example.com")
        self.assertEqual(user.profile.team_name, "Alex River's Team")
        team = Team.objects.get(created_by=user)
        self.assertEqual(team.name, "Alex River's Team")

        res_ws = self.client.get("/api/workspace/")
        self.assertEqual(res_ws.status_code, 200)
        self.assertEqual(res_ws.json()["teamName"], "Alex River's Team")

    def test_login_and_workspace(self):
        self._create_student()

        # Session check
        res = self.client.get("/api/auth/session/")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()["authenticated"])

        # Fetch workspace
        res = self.client.get("/api/workspace/")
        self.assertEqual(res.status_code, 200)
        ws = res.json()
        self.assertEqual(ws["role"], "student")
        self.assertEqual(ws["teamName"], "Byte Force")
        self.assertEqual(len(ws["members"]), 1)

    def test_project_upload_and_attach(self):
        self._create_student()

        # Upload a project with file
        file_content = b"Sample project prototype content"
        upload_file = SimpleUploadedFile("design_spec.pdf", file_content, content_type="application/pdf")

        res = self.client.post("/api/projects/upload/", {
            "title": "Smart Campus App",
            "type": "Design & Technology",
            "note": "Here is our initial wireframe.",
            "file": upload_file
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["success"])
        project_id = data["project"]["id"]
        self.assertEqual(data["project"]["name"], "Smart Campus App")
        self.assertEqual(data["project"]["fileName"], "design_spec.pdf")
        self.assertTrue(data["project"]["fileUrl"].startswith("/media/submissions/"))

        # Re-attach / replace file
        new_file = SimpleUploadedFile("updated_spec.pdf", b"Updated spec content", content_type="application/pdf")
        res2 = self.client.post(f"/api/projects/{project_id}/attach/", {
            "file": new_file
        })
        self.assertEqual(res2.status_code, 200)
        data2 = res2.json()
        self.assertTrue(data2["success"])
        self.assertEqual(data2["project"]["fileName"], "updated_spec.pdf")

    def test_project_upload_without_file(self):
        self._create_student()

        # Upload without providing any file
        res = self.client.post("/api/projects/upload/", {
            "title": "Conceptual AI Design",
            "type": "Research documentation",
            "note": "Documenting research findings before attaching PDF."
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["project"]["name"], "Conceptual AI Design")
        self.assertEqual(data["project"]["fileName"], "")
        self.assertEqual(data["project"]["fileUrl"], "")

    def test_project_upload_with_empty_file(self):
        self._create_student()

        # 0-byte file upload
        empty_file = SimpleUploadedFile("empty.txt", b"", content_type="text/plain")
        res = self.client.post("/api/projects/upload/", {
            "title": "Wireframes draft",
            "type": "Project submission",
            "note": "Initial draft",
            "file": empty_file
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["project"]["name"], "Wireframes draft")
        self.assertEqual(data["project"]["fileName"], "")
        self.assertEqual(data["project"]["fileUrl"], "")

    def test_file_upload_supports_all_formats(self):
        self._create_student()

        # Test various extensions across code, archives, data, and binaries
        formats_to_test = [
            ("script.py", b"print('Hello world')", "text/x-python"),
            ("data.csv", b"id,val\n1,100", "text/csv"),
            ("archive.rar", b"RAR archive bytes", "application/x-rar-compressed"),
            ("model.stl", b"solid part", "application/sla"),
            ("demo.mp4", b"video binary data", "video/mp4"),
            ("build.bin", b"\x00\x01\x02\x03", "application/octet-stream"),
        ]

        for fname, content, ctype in formats_to_test:
            upload_file = SimpleUploadedFile(fname, content, content_type=ctype)
            res = self.client.post("/api/projects/upload/", {
                "title": f"Upload test {fname}",
                "type": "Project submission",
                "file": upload_file
            })
            self.assertEqual(res.status_code, 200, f"Failed for {fname}: {res.content}")
            data = res.json()
            self.assertTrue(data["success"])
            self.assertEqual(data["project"]["fileName"], fname)

    def test_add_teammate_and_query(self):
        self._create_student()

        # Add teammate
        res = self.client.post("/api/team/add-member/", data=json.dumps({
            "email": "alex.smith@example.com",
            "role": "UI / UX designer"
        }), content_type="application/json")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()["success"])
        self.assertEqual(res.json()["member"]["name"], "Alex Smith")

        # Verify chat announcement was created
        chat_msg = ChatMessage.objects.filter(thread="team").last()
        self.assertIsNotNone(chat_msg)
        self.assertIn("Alex Smith", chat_msg.text)

        # Ask question
        res_q = self.client.post("/api/queries/create/", data=json.dumps({
            "subject": "Due date question",
            "details": "Is the prototype due on Friday or Monday?"
        }), content_type="application/json")
        self.assertEqual(res_q.status_code, 200)
        self.assertTrue(res_q.json()["success"])

    def test_invite_teammate_already_registered_user(self):
        # Create student 1 (team leader)
        self._create_student("leader@example.com", "Leader Jane", "Rocket Team")

        # Create student 2
        c2 = Client()
        c2.post("/api/auth/signup/", data=json.dumps({
            "name": "Member Sam",
            "email": "sam@example.com",
            "password": "Password123!",
            "role": "student",
            "post": "Team member",
            "department": "Engineering",
            "teamName": "Rocket Team"
        }), content_type="application/json")

        # Leader invites Sam
        res_inv = self.client.post("/api/team/add-member/", data=json.dumps({
            "email": "sam@example.com",
            "role": "Frontend developer"
        }), content_type="application/json")
        self.assertEqual(res_inv.status_code, 200)
        self.assertTrue(res_inv.json()["success"])
        invite_id = res_inv.json()["member"]["id"]
        self.assertEqual(res_inv.json()["member"]["status"], "pending")

        # Sam checks workspace before accepting: should see pending invitation
        res_ws = c2.get("/api/workspace/")
        self.assertEqual(res_ws.status_code, 200)
        ws_data = res_ws.json()
        self.assertEqual(len(ws_data["pendingInvitations"]), 1)
        self.assertEqual(ws_data["pendingInvitations"][0]["teamName"], "Rocket Team")

        # Sam checks notifications: should see invitation item
        res_notif = c2.get("/api/notifications/")
        self.assertEqual(res_notif.status_code, 200)
        notif_items = res_notif.json()["notifications"]
        inv_item = next((n for n in notif_items if n.get("type") == "invitation"), None)
        self.assertIsNotNone(inv_item)

        # Sam accepts the invitation
        res_accept = c2.post(f"/api/team/invitation/{invite_id}/respond/", data=json.dumps({
            "action": "accept"
        }), content_type="application/json")
        self.assertEqual(res_accept.status_code, 200)
        self.assertTrue(res_accept.json()["success"])

        # Verify Sam is now an accepted member of Rocket Team
        res_ws_after = c2.get("/api/workspace/")
        self.assertEqual(res_ws_after.json()["teamName"], "Rocket Team")
        self.assertEqual(len(res_ws_after.json()["pendingInvitations"]), 0)

        # Verify Leader received acceptance notification
        leader_user = User.objects.get(email="leader@example.com")
        leader_notif = ActivityNotification.objects.filter(user=leader_user, title__icontains="Accepted").first()
        self.assertIsNotNone(leader_notif)
        self.assertIn("Sam", leader_notif.message)

    def test_invite_teammate_rejects_invitation(self):
        # Leader creates Team
        self._create_student("lead@example.com", "Team Lead", "Vanguard")

        # Create another student
        c_bob = Client()
        c_bob.post("/api/auth/signup/", data=json.dumps({
            "name": "Bob Rejector",
            "email": "bob@example.com",
            "password": "Password123!",
            "role": "student",
            "post": "Team member",
            "department": "IT",
            "teamName": "Solo Team"
        }), content_type="application/json")

        # Leader invites Bob
        res_inv = self.client.post("/api/team/add-member/", data=json.dumps({
            "email": "bob@example.com",
            "role": "UI / UX designer"
        }), content_type="application/json")
        self.assertEqual(res_inv.status_code, 200)
        invite_id = res_inv.json()["member"]["id"]

        # Bob rejects the invitation
        res_reject = c_bob.post(f"/api/team/invitation/{invite_id}/respond/", data=json.dumps({
            "action": "reject"
        }), content_type="application/json")
        self.assertEqual(res_reject.status_code, 200)
        self.assertEqual(res_reject.json()["action"], "rejected")

        # Verify Bob is NOT in Vanguard team
        res_bob_ws = c_bob.get("/api/workspace/")
        self.assertEqual(len(res_bob_ws.json()["pendingInvitations"]), 0)
        self.assertNotEqual(res_bob_ws.json()["teamName"], "Vanguard")

        # Verify Leader receives "Invitation Declined" notification
        leader_user = User.objects.get(email="lead@example.com")
        decline_notif = ActivityNotification.objects.filter(user=leader_user, title="Invitation Declined").first()
        self.assertIsNotNone(decline_notif)
        self.assertIn("declined", decline_notif.message)

    def test_invite_teammate_signs_up_after_invite(self):
        # Leader creates Rocket Team
        self._create_student("alpha@example.com", "Alpha Leader", "Alpha Team")

        # Leader invites user who has not registered yet
        res_inv = self.client.post("/api/team/add-member/", data=json.dumps({
            "email": "future_student@example.com",
            "role": "Research & content"
        }), content_type="application/json")
        self.assertEqual(res_inv.status_code, 200)
        self.assertTrue(res_inv.json()["success"])
        invite_id = res_inv.json()["member"]["id"]

        # Future student now signs up
        c_future = Client()
        res_signup = c_future.post("/api/auth/signup/", data=json.dumps({
            "name": "Future Student",
            "email": "future_student@example.com",
            "password": "Password123!",
            "role": "student",
            "post": "Team member",
            "department": "Design",
            "teamName": ""
        }), content_type="application/json")
        self.assertEqual(res_signup.status_code, 200)

        # Future student workspace shows pending invitation
        res_ws = c_future.get("/api/workspace/")
        self.assertEqual(res_ws.status_code, 200)
        self.assertEqual(len(res_ws.json()["pendingInvitations"]), 1)

        # Future student accepts
        res_acc = c_future.post(f"/api/team/invitation/{invite_id}/respond/", data=json.dumps({
            "action": "accept"
        }), content_type="application/json")
        self.assertEqual(res_acc.status_code, 200)

        # Workspace now shows Alpha Team
        res_final_ws = c_future.get("/api/workspace/")
        self.assertEqual(res_final_ws.json()["teamName"], "Alpha Team")

    def test_invite_validations(self):
        self._create_student("boss@example.com", "Boss", "Boss Team")

        # Self-invite should fail
        res_self = self.client.post("/api/team/add-member/", data=json.dumps({
            "email": "boss@example.com",
            "role": "Project contributor"
        }), content_type="application/json")
        self.assertEqual(res_self.status_code, 400)
        self.assertIn("already leading", res_self.json()["error"])

        # Invalid email
        res_bad = self.client.post("/api/team/add-member/", data=json.dumps({
            "email": "invalidemail",
            "role": "Project contributor"
        }), content_type="application/json")
        self.assertEqual(res_bad.status_code, 400)

        # First invite succeeds
        res_ok = self.client.post("/api/team/add-member/", data=json.dumps({
            "email": "member1@example.com",
            "role": "UI / UX designer"
        }), content_type="application/json")
        self.assertEqual(res_ok.status_code, 200)

        # Duplicate invite fails
        res_dup = self.client.post("/api/team/add-member/", data=json.dumps({
            "email": "member1@example.com",
            "role": "UI / UX designer"
        }), content_type="application/json")
        self.assertEqual(res_dup.status_code, 400)
        self.assertIn("already been sent", res_dup.json()["error"])

    def test_teacher_workflow(self):
        # Student creates account, project, teammate, and query
        self._create_student()

        upload_file = SimpleUploadedFile("prototype.pdf", b"Prototype test content", content_type="application/pdf")
        res_p = self.client.post("/api/projects/upload/", {
            "title": "Smart Campus App",
            "type": "Design & Technology",
            "note": "Final prototype for grading.",
            "file": upload_file
        })
        self.assertEqual(res_p.status_code, 200)
        sub_id = res_p.json()["project"]["id"]

        res_q = self.client.post("/api/queries/create/", data=json.dumps({
            "subject": "Due date question",
            "details": "Is the prototype due on Friday or Monday?"
        }), content_type="application/json")
        self.assertEqual(res_q.status_code, 200)

        # Logout student
        self.client.post("/api/auth/logout/")

        # Signup teacher
        res_t = self._create_teacher()
        self.assertEqual(res_t.status_code, 200)

        # Teacher workspace
        res_ws = self.client.get("/api/workspace/")
        self.assertEqual(res_ws.status_code, 200)
        ws = res_ws.json()
        self.assertEqual(ws["role"], "teacher")
        self.assertEqual(len(ws["submissions"]), 1)
        sub = ws["submissions"][0]
        self.assertEqual(sub["name"], "Smart Campus App")
        self.assertEqual(sub["teamName"], "Byte Force")

        # Verify teams in teacher workspace
        self.assertIn("teams", ws)
        self.assertEqual(len(ws["teams"]), 1)
        self.assertEqual(ws["teams"][0]["name"], "Byte Force")
        self.assertEqual(ws["teams"][0]["membersCount"], 1)
        self.assertEqual(len(ws["teams"][0]["members"]), 1)
        self.assertEqual(ws["teams"][0]["members"][0]["name"], "Jane Student")
        self.assertTrue(ws["teams"][0]["members"][0]["isLeader"])

        # Teacher reviews project
        res_rev = self.client.post(f"/api/projects/{sub['id']}/review/", data=json.dumps({
            "status": "Approved",
            "remark": "Excellent wireframes and documentation!"
        }), content_type="application/json")
        self.assertEqual(res_rev.status_code, 200)
        self.assertTrue(res_rev.json()["success"])

        # Teacher answers query
        query_id = ws["queries"][0]["id"]
        res_rep = self.client.post(f"/api/queries/{query_id}/reply/", data=json.dumps({
            "reply": "The prototype is due on Monday at 5 PM."
        }), content_type="application/json")
        self.assertEqual(res_rep.status_code, 200)
        self.assertTrue(res_rep.json()["success"])

        # Send chat message
        res_chat = self.client.post("/api/messages/send/", data=json.dumps({
            "thread": "teacher",
            "text": "Hello class! Office hours are open today."
        }), content_type="application/json")
        self.assertEqual(res_chat.status_code, 200)
        self.assertTrue(res_chat.json()["success"])

        # Test message polling
        res_msgs = self.client.get("/api/messages/?thread=teacher")
        self.assertEqual(res_msgs.status_code, 200)
        self.assertEqual(len(res_msgs.json()["messages"]), 1)

    def test_secure_download_and_deletion(self):
        # 1. Student creates submission
        res_s = self._create_student("student2@school.edu", "Bob Dylan", "MusicTech")
        upload_file = SimpleUploadedFile("track_notes.txt", b"Notes on audio synthesis", content_type="text/plain")
        res_p = self.client.post("/api/projects/upload/", {
            "title": "Audio Synthesis",
            "type": "Research documentation",
            "file": upload_file
        })
        project_id = res_p.json()["project"]["id"]

        # Student downloads their own file
        dl_res = self.client.get(f"/api/projects/{project_id}/download/")
        self.assertEqual(dl_res.status_code, 200)
        self.assertEqual(b"".join(dl_res.streaming_content), b"Notes on audio synthesis")

        # Another unauthorized student cannot download
        self.client.post("/api/auth/logout/")
        self._create_student("other@school.edu", "Eve Hacker", "OtherTeam")
        dl_unauth = self.client.get(f"/api/projects/{project_id}/download/")
        self.assertEqual(dl_unauth.status_code, 403)

        # But a teacher CAN download
        self.client.post("/api/auth/logout/")
        self._create_teacher("prof@school.edu", "Prof. Higgins")
        dl_teacher = self.client.get(f"/api/projects/{project_id}/download/")
        self.assertEqual(dl_teacher.status_code, 200)

        # Teacher approves project
        self.client.post(f"/api/projects/{project_id}/review/", data=json.dumps({"status": "Approved"}), content_type="application/json")

        # Student logs back in and tries to delete approved project (should fail)
        self.client.post("/api/auth/logout/")
        self.client.post("/api/auth/login/", {"email": "student2@school.edu", "password": "Password123!"}, content_type="application/json")
        del_fail = self.client.post(f"/api/projects/{project_id}/delete/")
        self.assertEqual(del_fail.status_code, 400)
        self.assertIn("Approved projects cannot be deleted", del_fail.json()["error"])

    def test_notifications_lifecycle(self):
        # Create teacher
        self._create_teacher("teachernotif@school.edu", "Teacher Notif")
        self.client.post("/api/auth/logout/")

        # Student creates project (this should trigger notification to teacher)
        self._create_student("studentnotif@school.edu", "Notif Student", "Notif Team")
        self.client.post("/api/projects/upload/", {
            "title": "Robotics Hand",
            "type": "Project submission"
        })

        # Switch to teacher and check notifications
        self.client.post("/api/auth/logout/")
        self.client.post("/api/auth/login/", {"email": "teachernotif@school.edu", "password": "Password123!"}, content_type="application/json")

        notif_res = self.client.get("/api/notifications/")
        self.assertEqual(notif_res.status_code, 200)
        data = notif_res.json()
        self.assertTrue(data["unreadCount"] >= 1)
        self.assertIn("New Student Submission", [n["title"] for n in data["notifications"]])

        # Mark as read
        mark_res = self.client.post("/api/notifications/read/", data=json.dumps({}), content_type="application/json")
        self.assertEqual(mark_res.status_code, 200)

        # Teacher reviews the pending project
        sub_item = next(n for n in data["notifications"] if n.get("actionType") == "review")
        self.client.post(f"/api/projects/{sub_item['rawId']}/review/", data=json.dumps({"status": "Approved"}), content_type="application/json")

        notif_res_after = self.client.get("/api/notifications/")
        self.assertEqual(notif_res_after.json()["unreadCount"], 0)

    def test_team_leader_edit_teammate(self):
        # 1. Leader signs up and creates team
        self._create_student("lead_edit@school.edu", "Alice Leader", "Alpha Team")
        team = Team.objects.get(name="Alpha Team")

        # 2. Leader invites Bob
        add_res = self.client.post(
            "/api/team/add-member/",
            data=json.dumps({"email": "bob_member@school.edu", "role": "Project contributor"}),
            content_type="application/json"
        )
        self.assertEqual(add_res.status_code, 200)
        bob_member_id = add_res.json()["member"]["id"]

        # Bob signs up as a student
        self.client.post("/api/auth/logout/")
        self._create_student("bob_member@school.edu", "Bob Contributor", "Alpha Team")
        bob_user = User.objects.get(email="bob_member@school.edu")

        # Leader logs back in
        self.client.post("/api/auth/logout/")
        self.client.post("/api/auth/login/", {"email": "lead_edit@school.edu", "password": "Password123!"}, content_type="application/json")

        bob_member = TeamMember.objects.get(id=bob_member_id)

        # Edit member details (name and role)
        edit_res = self.client.post(
            f"/api/team/member/{bob_member.id}/edit/",
            data=json.dumps({"name": "Bob Senior Dev", "role": "Full-stack developer"}),
            content_type="application/json"
        )
        self.assertEqual(edit_res.status_code, 200)
        data = edit_res.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["member"]["name"], "Bob Senior Dev")
        self.assertEqual(data["member"]["role"], "Full-stack developer")

        # Verify DB member and profile
        bob_member.refresh_from_db()
        self.assertEqual(bob_member.name, "Bob Senior Dev")
        self.assertEqual(bob_member.role, "Full-stack developer")

        bob_user.refresh_from_db()
        self.assertEqual(bob_user.first_name, "Bob")
        self.assertEqual(bob_user.last_name, "Senior Dev")
        self.assertEqual(bob_user.profile.post, "Full-stack developer")

        # Verify notification sent to Bob
        notif = ActivityNotification.objects.filter(user=bob_user).latest("created_at")
        self.assertIn("Team Role Updated", notif.title)
        self.assertIn("Full-stack developer", notif.message)

    def test_team_leader_delete_teammate(self):
        # 1. Leader signs up and creates team
        self._create_student("lead_del@school.edu", "Carol Leader", "Beta Team")
        team = Team.objects.get(name="Beta Team")

        # 2. Add teammate
        add_res = self.client.post(
            "/api/team/add-member/",
            data=json.dumps({"email": "dave@school.edu", "role": "UI / UX designer"}),
            content_type="application/json"
        )
        self.assertEqual(add_res.status_code, 200)
        dave_member_id = add_res.json()["member"]["id"]

        # Dave creates account and is initially pending (not in Beta Team yet)
        self.client.post("/api/auth/logout/")
        self._create_student("dave@school.edu", "Dave Designer", "Beta Team")
        dave_user = User.objects.get(email="dave@school.edu")
        self.assertEqual(dave_user.profile.team_name, "")

        # Dave accepts the invitation to join Beta Team
        accept_res = self.client.post(
            f"/api/team/invitation/{dave_member_id}/respond/",
            data=json.dumps({"action": "accept"}),
            content_type="application/json"
        )
        self.assertEqual(accept_res.status_code, 200)
        dave_user.profile.refresh_from_db()
        self.assertEqual(dave_user.profile.team_name, "Beta Team")

        # Leader logs back in and removes Dave
        self.client.post("/api/auth/logout/")
        self.client.post("/api/auth/login/", {"email": "lead_del@school.edu", "password": "Password123!"}, content_type="application/json")

        del_res = self.client.post(f"/api/team/member/{dave_member_id}/delete/")
        self.assertEqual(del_res.status_code, 200)
        data = del_res.json()
        self.assertTrue(data["success"])

        # Verify member removed from DB
        self.assertFalse(TeamMember.objects.filter(id=dave_member_id).exists())

        # Verify Dave's profile was cleared from team
        dave_user.profile.refresh_from_db()
        self.assertEqual(dave_user.profile.team_name, "")
        self.assertEqual(dave_user.profile.post, "Student")

        # Verify Dave got removal notification
        notif = ActivityNotification.objects.filter(user=dave_user).latest("created_at")
        self.assertEqual(notif.title, "Removed from Team")
        self.assertIn("Beta Team", notif.message)

    def test_non_leader_cannot_edit_or_delete_teammates(self):
        # Leader creates team
        self._create_student("leader_perm@school.edu", "Leader Perm", "Gamma Team")
        team = Team.objects.get(name="Gamma Team")

        # Leader invites member 1 and member 2
        self.client.post(
            "/api/team/add-member/",
            data=json.dumps({"email": "member1@school.edu", "role": "Project contributor"}),
            content_type="application/json"
        )
        add_m2 = self.client.post(
            "/api/team/add-member/",
            data=json.dumps({"email": "member2@school.edu", "role": "Project contributor"}),
            content_type="application/json"
        )
        m2_member_id = add_m2.json()["member"]["id"]

        # Member 1 signs up
        self.client.post("/api/auth/logout/")
        self._create_student("member1@school.edu", "Member One", "Gamma Team")

        # Member 1 attempts to edit Member 2
        edit_res = self.client.post(
            f"/api/team/member/{m2_member_id}/edit/",
            data=json.dumps({"name": "Hacked Name", "role": "Hacked Role"}),
            content_type="application/json"
        )
        self.assertEqual(edit_res.status_code, 403)
        self.assertIn("Only the team leader can edit team members", edit_res.json()["error"])

        # Member 1 attempts to delete Member 2
        del_res = self.client.post(f"/api/team/member/{m2_member_id}/delete/")
        self.assertEqual(del_res.status_code, 403)
        self.assertIn("Only the team leader can remove team members", del_res.json()["error"])

    def test_leader_cannot_delete_self(self):
        self._create_student("boss@school.edu", "Boss Leader", "Delta Team")
        team = Team.objects.get(name="Delta Team")
        leader_member = TeamMember.objects.get(team=team, is_leader=True)

        del_res = self.client.post(f"/api/team/member/{leader_member.id}/delete/")
        self.assertEqual(del_res.status_code, 400)
        self.assertIn("The team leader cannot be removed from the team", del_res.json()["error"])

    def test_invitation_lifecycle_pending_to_accepted(self):
        # 1. Leader Viji creates team code-alpha
        self._create_student("viji@school.edu", "viji", "code-alpha")
        team = Team.objects.get(name="code-alpha")

        # 2. Viji invites Raji
        add_res = self.client.post(
            "/api/team/add-member/",
            data=json.dumps({"email": "raji@school.edu", "role": "Project contributor"}),
            content_type="application/json"
        )
        self.assertEqual(add_res.status_code, 200)
        raji_member_id = add_res.json()["member"]["id"]
        raji_member = TeamMember.objects.get(id=raji_member_id)
        self.assertEqual(raji_member.status, "pending")

        # Leader views workspace: raji is present with status pending
        viji_ws = self.client.get("/api/workspace/").json()
        raji_in_viji_ws = next(m for m in viji_ws["members"] if m["email"] == "raji@school.edu")
        self.assertEqual(raji_in_viji_ws["status"], "pending")

        # 3. Raji registers / signs up
        self.client.post("/api/auth/logout/")
        self._create_student("raji@school.edu", "raji", "code-alpha")
        raji_user = User.objects.get(email="raji@school.edu")

        # 4. BEFORE accepting: Raji's workspace does NOT list code-alpha as active team
        raji_ws = self.client.get("/api/workspace/").json()
        self.assertEqual(raji_ws["teamName"], "")
        self.assertEqual(len(raji_ws["pendingInvitations"]), 1)
        self.assertEqual(raji_ws["pendingInvitations"][0]["teamName"], "code-alpha")

        # 5. Raji accepts the invitation
        accept_res = self.client.post(
            f"/api/team/invitation/{raji_member_id}/respond/",
            data=json.dumps({"action": "accept"}),
            content_type="application/json"
        )
        self.assertEqual(accept_res.status_code, 200)
        self.assertTrue(accept_res.json()["success"])

        # 6. AFTER accepting: Raji's workspace now reflects team code-alpha and accepted status
        raji_ws_after = self.client.get("/api/workspace/").json()
        self.assertEqual(raji_ws_after["teamName"], "code-alpha")
        self.assertEqual(len(raji_ws_after["pendingInvitations"]), 0)
        raji_in_team = next(m for m in raji_ws_after["members"] if m["email"] == "raji@school.edu")
        self.assertEqual(raji_in_team["status"], "accepted")

        # Leader views workspace: raji status is now accepted
        self.client.post("/api/auth/logout/")
        self.client.post("/api/auth/login/", {"email": "viji@school.edu", "password": "Password123!"}, content_type="application/json")
        viji_ws_after = self.client.get("/api/workspace/").json()
        raji_in_viji_ws_after = next(m for m in viji_ws_after["members"] if m["email"] == "raji@school.edu")
        self.assertEqual(raji_in_viji_ws_after["status"], "accepted")

    def test_teacher_teams_page_and_api(self):
        # 1. Unauthenticated request to /api/teams/ returns 401
        res_unauth = self.client.get("/api/teams/")
        self.assertEqual(res_unauth.status_code, 401)

        # 2. Student setup
        self._create_student("alpha.lead@school.edu", "Alice Leader", "AlphaForce")
        self.client.post("/api/team/add-member/", data=json.dumps({
            "name": "Bob Contributor",
            "email": "bob.c@school.edu",
            "role": "Researcher"
        }), content_type="application/json")

        # Student request to /api/teams/ returns 403
        res_student_teams = self.client.get("/api/teams/")
        self.assertEqual(res_student_teams.status_code, 403)

        # Create second team
        self.client.post("/api/auth/logout/")
        self._create_student("beta.lead@school.edu", "Charlie Leader", "BetaSquad")

        # 3. Teacher setup
        self.client.post("/api/auth/logout/")
        self._create_teacher("prof.einstein@school.edu", "Prof. Einstein")

        # 4. Teacher calls /api/teams/
        res_teams = self.client.get("/api/teams/")
        self.assertEqual(res_teams.status_code, 200)
        data = res_teams.json()
        self.assertTrue(data["success"])
        teams = data["teams"]
        self.assertEqual(len(teams), 2)

        team_names = [t["name"] for t in teams]
        self.assertIn("AlphaForce", team_names)
        self.assertIn("BetaSquad", team_names)

        alpha_team = next(t for t in teams if t["name"] == "AlphaForce")
        self.assertEqual(alpha_team["createdBy"], "Alice Leader")
        self.assertEqual(len(alpha_team["members"]), 2)
        member_names = [m["name"] for m in alpha_team["members"]]
        self.assertIn("Alice Leader", member_names)
        self.assertIn("Bob Contributor", member_names)

        # 5. Teacher calls /api/workspace/
        res_ws = self.client.get("/api/workspace/")
        self.assertEqual(res_ws.status_code, 200)
        ws_teams = res_ws.json()["teams"]
        self.assertEqual(len(ws_teams), 2)



