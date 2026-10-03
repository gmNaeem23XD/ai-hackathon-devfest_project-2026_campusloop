# Run with DEMO_MODE enabled: python -m app.seed
from sqlalchemy import func

from .database import SessionLocal, initialize_database
from . import models as m
from .security import hash_pw
from .settings import settings
from .demo import DEMO_COURSE, DEMO_COURSE_DETAILS, DEMO_PASSWORD, DEMO_TEACHER_PROFILES, DEMO_USERS


def seed_demo_data():
    if not settings.demo_mode:
        raise RuntimeError("Demo seeding is disabled. Set DEMO_MODE=true to seed demo fixtures.")
    initialize_database()
    db = SessionLocal()
    try:
        demo_users = {}
        for fixture in DEMO_USERS:
            user = db.query(m.User).filter(func.lower(m.User.email) == fixture["email"].lower()).first()
            if user and user.role != fixture["role"]:
                raise RuntimeError(f"Demo email {fixture['email']} belongs to another role; leaving existing data unchanged")
            if not user:
                user = m.User(**fixture, password_hash=hash_pw(DEMO_PASSWORD), is_active=True, is_approved=True)
                db.add(user)
                db.flush()
            demo_users[fixture["email"]] = user

        teacher = demo_users[DEMO_USERS[0]["email"]]
        course = db.query(m.Course).filter_by(course_code=DEMO_COURSE["course_code"]).first()
        if course and course.teacher_id != teacher.id:
            raise RuntimeError("The demo course code is assigned to another teacher; leaving existing data unchanged")
        if not course:
            course = m.Course(**DEMO_COURSE, teacher_id=teacher.id)
            db.add(course)
            db.flush()

        demo_department_rows = {}
        for code, name in settings.demo_departments:
            department = db.query(m.Department).filter_by(code=code).first()
            if not department:
                department = m.Department(code=code, name=name)
                db.add(department)
                db.flush()
            demo_department_rows[code] = department

        teacher_profile_fixture = DEMO_TEACHER_PROFILES.get(teacher.email)
        if teacher_profile_fixture:
            teacher_profile = db.get(m.TeacherProfile, teacher.id)
            if not teacher_profile:
                teacher_profile = m.TeacherProfile(user_id=teacher.id)
                db.add(teacher_profile)
            teacher_department = demo_department_rows.get(teacher_profile_fixture["department_code"])
            teacher_profile.department_id = teacher_department.id if teacher_department else None
            teacher_profile.designation = teacher_profile_fixture["designation"]
            teacher_profile.professional_info = teacher_profile_fixture["professional_info"]

        course_details = DEMO_COURSE_DETAILS.get(course.course_code)
        if course_details:
            course_department = demo_department_rows.get(course_details["department_code"])
            course.department_id = course_department.id if course_department else None
            course.semester = course_details["semester"]
            course.section = course_details["section"]
            course.academic_year = course_details["academic_year"]

        for fixture in DEMO_USERS[1:]:
            student = demo_users[fixture["email"]]
            enrollment = db.query(m.Enrollment).filter_by(course_id=course.id, student_id=student.id).first()
            if not enrollment:
                db.add(m.Enrollment(course_id=course.id, student_id=student.id))
        db.commit()
        return {"users": len(demo_users), "course": course.course_code}
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    result = seed_demo_data()
    print(f"Demo fixtures ready: {result['users']} users, course {result['course']}. Existing data was preserved.")
