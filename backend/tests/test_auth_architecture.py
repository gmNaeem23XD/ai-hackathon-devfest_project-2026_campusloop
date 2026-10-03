import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.ai import Cand
from app.demo import DEMO_COURSE, DEMO_PASSWORD, DEMO_USERS
from app.main import app, hits
from app.models import Course, Department, Enrollment, TeacherProfile, User
from app.security import hash_pw
from app.settings import load_settings, settings


class AuthenticationArchitectureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(cls.engine)
        cls.Session = sessionmaker(bind=cls.engine, autoflush=False)

    @classmethod
    def tearDownClass(cls):
        cls.engine.dispose()

    def setUp(self):
        Base.metadata.drop_all(self.engine)
        Base.metadata.create_all(self.engine)
        hits.clear()

        def override_db():
            db = self.Session()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_db
        self.client = TestClient(app)
        self.admin_email = "admin-test@local.invalid"
        with self.Session() as db:
            db.add(User(name="Test Administrator", email=self.admin_email,
                        password_hash=hash_pw("test-admin-password-123"), role="ADMIN", is_active=True, is_approved=True))
            demo_users = {}
            for fixture in DEMO_USERS:
                user = User(**fixture, password_hash=hash_pw(DEMO_PASSWORD), is_active=True, is_approved=True)
                db.add(user)
                demo_users[fixture["email"]] = user
            db.flush()
            course = Course(**DEMO_COURSE, teacher_id=demo_users[DEMO_USERS[0]["email"]].id)
            db.add(course)
            db.flush()
            for fixture in DEMO_USERS[1:]:
                db.add(Enrollment(course_id=course.id, student_id=demo_users[fixture["email"]].id))
            db.commit()

    def tearDown(self):
        app.dependency_overrides.clear()

    def register(self, email, role="STUDENT"):
        return self.client.post("/auth/register", json={
            "name": "Test Account",
            "email": email,
            "password": "test-user-password-123",
            "role": role,
        })

    def admin_headers(self):
        response = self.client.post("/auth/admin/login", json={
            "email": self.admin_email,
            "password": "test-admin-password-123",
        })
        self.assertEqual(response.status_code, 200)
        return {"Authorization": f"Bearer {response.json()['access_token']}"}

    def test_allowed_student_registration_is_hashed_and_can_sign_in(self):
        domain = settings.allowed_registration_domains[0]
        response = self.register(f"student@{domain}")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["role"], "STUDENT")
        self.assertFalse(response.json()["approval_required"])

        with self.Session() as db:
            user = db.query(User).filter_by(email=f"student@{domain}").one()
            self.assertTrue(user.password_hash.startswith("$argon2"))
            self.assertNotEqual(user.password_hash, "test-user-password-123")

        login = self.client.post("/auth/login", json={
            "email": f"STUDENT@{domain}",
            "password": "test-user-password-123",
        })
        self.assertEqual(login.status_code, 200)
        profile = self.client.get("/me", headers={"Authorization": f"Bearer {login.json()['access_token']}"})
        self.assertEqual(profile.status_code, 200)
        self.assertEqual(profile.json()["role"], "STUDENT")

    def test_registration_rejects_disallowed_domain_and_duplicate_email(self):
        invalid = self.register("blocked@not-allowed.invalid")
        self.assertEqual(invalid.status_code, 422)
        domain = settings.allowed_registration_domains[0]
        self.assertEqual(self.register(f"duplicate@{domain}").status_code, 201)
        duplicate = self.register(f"DUPLICATE@{domain.upper()}")
        self.assertEqual(duplicate.status_code, 409)

    def test_teacher_waits_for_admin_approval(self):
        domain = settings.allowed_registration_domains[0]
        created = self.register(f"teacher@{domain}", role="TEACHER")
        self.assertEqual(created.status_code, 201)
        self.assertTrue(created.json()["approval_required"])
        pending_login = self.client.post("/auth/login", json={
            "email": f"teacher@{domain}",
            "password": "test-user-password-123",
        })
        self.assertEqual(pending_login.status_code, 403)

        with self.Session() as db:
            teacher_id = db.query(User).filter_by(email=f"teacher@{domain}").one().id
        approved = self.client.post(f"/admin/teachers/{teacher_id}/approve", headers=self.admin_headers())
        self.assertEqual(approved.status_code, 200)
        teacher_login = self.client.post("/auth/login", json={
            "email": f"teacher@{domain}",
            "password": "test-user-password-123",
        })
        self.assertEqual(teacher_login.status_code, 200)
        self.assertEqual(teacher_login.json()["role"], "TEACHER")

    def test_admin_has_separate_login_and_protected_api(self):
        regular_login = self.client.post("/auth/login", json={
            "email": self.admin_email,
            "password": "test-admin-password-123",
        })
        self.assertEqual(regular_login.status_code, 403)

        headers = self.admin_headers()
        self.assertEqual(self.client.get("/admin/summary", headers=headers).status_code, 200)
        self.assertEqual(self.client.get("/admin/users", headers=headers).status_code, 200)
        self.assertEqual(self.client.get("/admin/summary").status_code, 401)

        domain = settings.allowed_registration_domains[0]
        student = self.register(f"ordinary@{domain}")
        token = self.client.post("/auth/login", json={
            "email": f"ordinary@{domain}",
            "password": "test-user-password-123",
        }).json()["access_token"]
        forbidden = self.client.get("/admin/summary", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(forbidden.status_code, 403)
        self.assertEqual(self.client.get("/teacher/courses", headers={"Authorization": f"Bearer {token}"}).status_code, 403)
        self.assertEqual(self.client.get("/admin/users?role=STUDENT", headers={"Authorization": f"Bearer {token}"}).status_code, 403)
        self.assertEqual(student.status_code, 201)

    def test_admin_user_search_role_filter_and_pagination(self):
        headers = self.admin_headers()
        first_page = self.client.get("/admin/users?role=STUDENT&sort=name&direction=asc&limit=2&offset=0", headers=headers)
        self.assertEqual(first_page.status_code, 200)
        self.assertEqual(first_page.json()["total"], 3)
        self.assertEqual(len(first_page.json()["items"]), 2)
        self.assertLessEqual(first_page.json()["items"][0]["name"], first_page.json()["items"][1]["name"])

        search = self.client.get("/admin/users?role=STUDENT&q=rahim&status=active", headers=headers)
        self.assertEqual(search.json()["total"], 1)
        self.assertEqual(search.json()["items"][0]["email"], "rahim@uni.edu")
        teachers = self.client.get("/admin/users?role=TEACHER&limit=10&offset=0", headers=headers)
        self.assertEqual(teachers.json()["total"], 1)

    def test_admin_edits_only_profile_fields_and_rejects_duplicate_values(self):
        headers = self.admin_headers()
        with self.Session() as db:
            student = db.query(User).filter_by(email="rahim@uni.edu").one()
            student_id = student.id
            original_hash = student.password_hash

        detail = self.client.get(f"/admin/users/{student_id}", headers=headers)
        self.assertEqual(detail.status_code, 200)
        self.assertNotIn("password_hash", detail.json())
        changed = self.client.patch(f"/admin/users/{student_id}", headers=headers, json={
            "name": "Rahim Updated",
            "email": "rahim.updated@gmail.com",
            "university_id": "S-UPDATED",
            "role": "ADMIN",
            "password": "not-allowed-to-change-here",
        })
        self.assertEqual(changed.status_code, 200)
        self.assertEqual(changed.json()["role"], "STUDENT")
        self.assertEqual(changed.json()["name"], "Rahim Updated")
        self.assertEqual(changed.json()["university_id"], "S-UPDATED")
        duplicate = self.client.patch(f"/admin/users/{student_id}", headers=headers, json={"email": "anika@uni.edu"})
        self.assertEqual(duplicate.status_code, 409)
        with self.Session() as db:
            updated = db.get(User, student_id)
            self.assertEqual(updated.password_hash, original_hash)
            self.assertEqual(updated.role, "STUDENT")

    def test_deactivation_blocks_current_token_and_reactivation_restores_login(self):
        headers = self.admin_headers()
        login = self.client.post("/auth/login", json={"email": "rahim@uni.edu", "password": DEMO_PASSWORD})
        student_token = login.json()["access_token"]
        with self.Session() as db:
            student_id = db.query(User).filter_by(email="rahim@uni.edu").one().id

        deactivated = self.client.patch(f"/admin/users/{student_id}/active", headers=headers, json={"is_active": False})
        self.assertEqual(deactivated.status_code, 200)
        self.assertEqual(self.client.post("/auth/login", json={"email": "rahim@uni.edu", "password": DEMO_PASSWORD}).status_code, 401)
        self.assertEqual(self.client.get("/me", headers={"Authorization": f"Bearer {student_token}"}).status_code, 401)
        self.assertEqual(self.client.get("/admin/users?role=STUDENT&status=inactive", headers=headers).json()["total"], 1)

        activated = self.client.patch(f"/admin/users/{student_id}/active", headers=headers, json={"is_active": True})
        self.assertEqual(activated.status_code, 200)
        restored_login = self.client.post("/auth/login", json={"email": "rahim@uni.edu", "password": DEMO_PASSWORD})
        self.assertEqual(restored_login.status_code, 200)

    def test_delete_soft_deletes_blocks_auth_and_preserves_enrollments(self):
        headers = self.admin_headers()
        with self.Session() as db:
            student = db.query(User).filter_by(email="rahim@uni.edu").one()
            student_id = student.id
            enrollment_count = db.query(Enrollment).filter_by(student_id=student_id).count()
            self.assertGreater(enrollment_count, 0)

        deleted = self.client.delete(f"/admin/users/{student_id}", headers=headers)
        self.assertEqual(deleted.status_code, 200)
        self.assertEqual(self.client.post("/auth/login", json={"email": "rahim@uni.edu", "password": DEMO_PASSWORD}).status_code, 401)
        deleted_list = self.client.get("/admin/users?role=STUDENT&status=deleted", headers=headers)
        self.assertEqual(deleted_list.json()["total"], 1)
        self.assertTrue(deleted_list.json()["items"][0]["is_deleted"])
        self.assertEqual(self.client.patch(f"/admin/users/{student_id}/active", headers=headers, json={"is_active": True}).status_code, 409)

        with self.Session() as db:
            retained = db.get(User, student_id)
            self.assertTrue(retained.is_deleted)
            self.assertFalse(retained.is_active)
            self.assertIsNotNone(retained.deleted_at)
            self.assertEqual(db.query(Enrollment).filter_by(student_id=student_id).count(), enrollment_count)

    def test_admin_bootstrap_is_hashed_and_idempotent(self):
        from dataclasses import replace
        from app import main as main_module
        from app.security import verify_pw

        old_settings = main_module.settings
        old_session_factory = main_module.SessionLocal
        main_module.settings = replace(settings, admin_email="bootstrap@diu.edu.bd", admin_password="bootstrap-admin-pass-123")
        main_module.SessionLocal = self.Session
        try:
            main_module.provision_configured_admin()
            main_module.provision_configured_admin()
            with self.Session() as db:
                accounts = db.query(User).filter_by(email="bootstrap@diu.edu.bd").all()
                self.assertEqual(len(accounts), 1)
                self.assertEqual(accounts[0].role, "ADMIN")
                self.assertTrue(verify_pw(accounts[0].password_hash, "bootstrap-admin-pass-123"))
        finally:
            main_module.settings = old_settings
            main_module.SessionLocal = old_session_factory

    def test_public_config_and_demo_login_remain_available(self):
        public = self.client.get("/public/config")
        self.assertEqual(public.status_code, 200)
        self.assertEqual(public.json()["allowed_registration_domains"], list(settings.allowed_registration_domains))

        demo_teacher = DEMO_USERS[0]
        login = self.client.post("/auth/login", json={"email": demo_teacher["email"], "password": DEMO_PASSWORD})
        self.assertEqual(login.status_code, 200)
        self.assertEqual(login.json()["role"], "TEACHER")

    def test_student_can_update_own_personal_profile_only(self):
        login = self.client.post("/auth/login", json={"email": "rahim@uni.edu", "password": DEMO_PASSWORD})
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
        initial = self.client.get("/profile", headers=headers)
        self.assertEqual(initial.status_code, 200)
        self.assertEqual(initial.json()["student_id"], "S001")
        self.assertEqual(initial.json()["role"], "STUDENT")

        updated = self.client.patch("/profile", headers=headers, json={
            "name": "Rahim Updated",
            "phone_number": "+880 1712-345678",
            "gender": "Prefer not to say",
            "email": "attacker@diu.edu.bd",
            "student_id": "CHANGED-ID",
            "role": "ADMIN",
            "is_active": False,
        })
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json()["name"], "Rahim Updated")
        self.assertEqual(updated.json()["phone_number"], "+880 1712-345678")
        self.assertEqual(updated.json()["gender"], "Prefer not to say")
        self.assertEqual(updated.json()["email"], "rahim@uni.edu")
        self.assertEqual(updated.json()["student_id"], "S001")
        self.assertEqual(updated.json()["role"], "STUDENT")
        self.assertEqual(updated.json()["account_status"], "Active")

        with self.Session() as db:
            stored = db.query(User).filter_by(email="rahim@uni.edu").one()
            stored_id = stored.id
            self.assertEqual(stored.name, "Rahim Updated")
            self.assertEqual(stored.phone_number, "+880 1712-345678")
        fresh_login = self.client.post("/auth/login", json={"email": "rahim@uni.edu", "password": DEMO_PASSWORD})
        self.assertEqual(fresh_login.status_code, 200)
        other_login = self.client.post("/auth/login", json={"email": "anika@uni.edu", "password": DEMO_PASSWORD})
        other_headers = {"Authorization": f"Bearer {other_login.json()['access_token']}"}
        self.assertNotEqual(self.client.get("/profile", headers=other_headers).json()["id"], stored_id)
        self.assertEqual(self.client.patch("/profile", headers=other_headers, json={"name": "Changed student"}).status_code, 200)
        with self.Session() as db:
            self.assertEqual(db.get(User, stored_id).name, "Rahim Updated")

    def test_teacher_profile_includes_department_designation_and_assigned_course(self):
        with self.Session() as db:
            teacher = db.query(User).filter_by(email="teacher@uni.edu").one()
            department = Department(code="CSE", name="Department of Computer Science and Engineering")
            db.add(department)
            db.flush()
            db.add(TeacherProfile(user_id=teacher.id, department_id=department.id,
                                  designation="Assistant Professor", professional_info="AI and software systems"))
            course = db.query(Course).filter_by(course_code="CSE-101").one()
            course.department_id = department.id
            course.semester = "Fall"
            course.section = "A"
            course.academic_year = "2026"
            db.commit()

        teacher_login = self.client.post("/auth/login", json={"email": "teacher@uni.edu", "password": DEMO_PASSWORD})
        teacher_headers = {"Authorization": f"Bearer {teacher_login.json()['access_token']}"}
        teacher_profile = self.client.get("/profile", headers=teacher_headers)
        self.assertEqual(teacher_profile.status_code, 200)
        academic = teacher_profile.json()["teacher"]
        self.assertEqual(academic["department_name"], "Department of Computer Science and Engineering")
        self.assertEqual(academic["designation"], "Assistant Professor")
        self.assertEqual(academic["assigned_courses"][0]["course_code"], "CSE-101")
        self.assertEqual(academic["assigned_courses"][0]["semester"], "Fall")

        student_login = self.client.post("/auth/login", json={"email": "rahim@uni.edu", "password": DEMO_PASSWORD})
        student_headers = {"Authorization": f"Bearer {student_login.json()['access_token']}"}
        student_profile = self.client.get("/profile", headers=student_headers)
        self.assertEqual(student_profile.status_code, 200)
        self.assertNotIn("teacher", student_profile.json())
        self.assertEqual(self.client.get("/teacher/courses", headers=student_headers).status_code, 403)

        teacher_patch = self.client.patch("/profile", headers=teacher_headers, json={
            "name": "Teacher Changed Name",
            "department_id": academic["department_id"],
            "designation": "Professor",
            "assigned_courses": [],
        })
        self.assertEqual(teacher_patch.status_code, 200)
        self.assertEqual(teacher_patch.json()["name"], "Teacher Changed Name")
        self.assertEqual(teacher_patch.json()["teacher"]["designation"], "Assistant Professor")

    def test_profile_picture_type_size_and_remove_validation(self):
        login = self.client.post("/auth/login", json={"email": "rahim@uni.edu", "password": DEMO_PASSWORD})
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
        wrong_type = self.client.put("/profile/picture", headers=headers, files={"image": ("profile.txt", b"text", "text/plain")})
        self.assertEqual(wrong_type.status_code, 415)
        oversized = self.client.put("/profile/picture", headers=headers, files={
            "image": ("large.png", b"\x89PNG\r\n\x1a\n" + b"x" * (5 * 1024 * 1024), "image/png"),
        })
        self.assertEqual(oversized.status_code, 413)
        mismatched_type = self.client.put("/profile/picture", headers=headers, files={"image": ("fake.png", b"not a png", "image/png")})
        self.assertEqual(mismatched_type.status_code, 415)

        png_signature = b"\x89PNG\r\n\x1a\n" + b"test-image-data"
        uploaded = self.client.put("/profile/picture", headers=headers, files={"image": ("valid.png", png_signature, "image/png")})
        self.assertEqual(uploaded.status_code, 200)
        picture_url = uploaded.json()["profile_picture_url"]
        stored_image = self.client.get(picture_url, headers=headers)
        self.assertEqual(stored_image.status_code, 200)
        self.assertEqual(stored_image.content, png_signature)
        removed = self.client.delete("/profile/picture", headers=headers)
        self.assertEqual(removed.status_code, 200)
        self.assertIsNone(self.client.get("/profile", headers=headers).json()["profile_picture_url"])

    def test_admin_teacher_profile_fields_and_departments_are_protected(self):
        headers = self.admin_headers()
        created = self.client.post("/admin/departments", headers=headers, json={"code": "SWE", "name": "Department of Software Engineering"})
        self.assertEqual(created.status_code, 201)
        teacher_login = self.client.post("/auth/login", json={"email": "teacher@uni.edu", "password": DEMO_PASSWORD})
        with self.Session() as db:
            teacher_id = db.query(User).filter_by(email="teacher@uni.edu").one().id
        denied = self.client.patch(f"/admin/users/{teacher_id}", headers={"Authorization": f"Bearer {teacher_login.json()['access_token']}"}, json={"designation": "Lecturer"})
        self.assertEqual(denied.status_code, 403)
        saved = self.client.patch(f"/admin/users/{teacher_id}", headers=headers, json={
            "department_id": created.json()["id"],
            "designation": "Assistant Professor",
            "professional_info": "Distributed systems",
        })
        self.assertEqual(saved.status_code, 200)
        self.assertEqual(saved.json()["department_name"], "Department of Software Engineering")
        self.assertEqual(saved.json()["designation"], "Assistant Professor")
        self.assertEqual(saved.json()["university_id"], "T001")
        self.assertEqual(saved.json()["assigned_courses"][0]["course_code"], "CSE-101")
        renamed = self.client.patch(f"/admin/departments/{created.json()['id']}", headers=headers, json={"name": "Software Engineering Department"})
        self.assertEqual(renamed.status_code, 200)
        refreshed = self.client.get(f"/admin/users/{teacher_id}", headers=headers)
        self.assertEqual(refreshed.json()["department_name"], "Software Engineering Department")
        invalid_designation = self.client.patch(f"/admin/users/{teacher_id}", headers=headers, json={"designation": "Unconfigured title"})
        self.assertEqual(invalid_designation.status_code, 422)

    def test_registration_domains_are_environment_configurable(self):
        with patch.dict("os.environ", {"ALLOWED_REGISTRATION_DOMAINS": "example.edu,diu.edu.bd"}):
            configured = load_settings()
        self.assertEqual(configured.allowed_registration_domains, ("example.edu", "diu.edu.bd"))

    def test_original_teacher_meeting_and_student_task_flow(self):
        teacher_login = self.client.post("/auth/login", json={"email": "teacher@uni.edu", "password": DEMO_PASSWORD})
        teacher_headers = {"Authorization": f"Bearer {teacher_login.json()['access_token']}"}
        courses = self.client.get("/teacher/courses", headers=teacher_headers)
        self.assertEqual(courses.status_code, 200)
        course_id = courses.json()[0]["id"]
        students = self.client.get(f"/courses/{course_id}/students", headers=teacher_headers).json()
        rahim_id = next(student["id"] for student in students if student["name"] == "Rahim Ahmed")

        meeting = self.client.post("/teacher/meetings", data={
            "course_id": course_id,
            "title": "Weekly planning",
            "transcript": "Rahim will submit the AI project tomorrow.",
        }, headers=teacher_headers)
        self.assertEqual(meeting.status_code, 200)
        with patch("app.main.ai.extract_tasks", return_value=([Cand(
            assignee_name="Rahim Ahmed", task_title="Submit the AI project",
            description="Submit the AI project", confidence=0.9,
        )], "heuristic")):
            processed = self.client.post(f"/teacher/meetings/{meeting.json()['id']}/process", headers=teacher_headers)
        self.assertEqual(processed.status_code, 200)
        candidates = self.client.get(f"/teacher/meetings/{meeting.json()['id']}/ai-tasks", headers=teacher_headers)
        self.assertEqual(len(candidates.json()), 1)
        approved = self.client.post("/teacher/tasks/approve", json={
            "task_id": candidates.json()[0]["id"],
            "assigned_to": rahim_id,
        }, headers=teacher_headers)
        self.assertEqual(approved.status_code, 200)

        student_login = self.client.post("/auth/login", json={"email": "rahim@uni.edu", "password": DEMO_PASSWORD})
        student_headers = {"Authorization": f"Bearer {student_login.json()['access_token']}"}
        tasks = self.client.get("/student/tasks", headers=student_headers)
        self.assertEqual(tasks.status_code, 200)
        self.assertEqual(len(tasks.json()), 1)
        updated = self.client.patch(f"/student/tasks/{tasks.json()[0]['id']}", json={"status": "IN_PROGRESS"}, headers=student_headers)
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json()["status"], "IN_PROGRESS")


if __name__ == "__main__":
    unittest.main()
