import uuid, datetime as dt
from sqlalchemy import Column, String, Float, Boolean, DateTime, ForeignKey, Text, UniqueConstraint, true, false
from .database import Base

uid = lambda: str(uuid.uuid4())
now = lambda: dt.datetime.now(dt.timezone.utc)

class User(Base):  # students, teachers, and admins share one table with role-based access
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=uid)
    university_id = Column(String, unique=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_approved = Column(Boolean, default=True, nullable=False, server_default=true())
    is_deleted = Column(Boolean, default=False, nullable=False, server_default=false())
    deleted_at = Column(DateTime, nullable=True)
    phone_number = Column(String(30), nullable=True)
    gender = Column(String(40), nullable=True)
    profile_picture_path = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=now)

class Department(Base):
    __tablename__ = "departments"
    id = Column(String, primary_key=True, default=uid)
    code = Column(String(24), unique=True, nullable=False, index=True)
    name = Column(String(160), unique=True, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False, server_default=true())
    created_at = Column(DateTime, default=now)

class TeacherProfile(Base):
    __tablename__ = "teacher_profiles"
    user_id = Column(String, ForeignKey("users.id"), primary_key=True)
    department_id = Column(String, ForeignKey("departments.id"), nullable=True, index=True)
    designation = Column(String(100), nullable=True)
    professional_info = Column(Text, nullable=True)

class Course(Base):
    __tablename__ = "courses"
    id = Column(String, primary_key=True, default=uid)
    course_code = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    teacher_id = Column(String, ForeignKey("users.id"), index=True)
    department_id = Column(String, ForeignKey("departments.id"), nullable=True, index=True)
    semester = Column(String(40), nullable=True)
    section = Column(String(40), nullable=True)
    academic_year = Column(String(24), nullable=True)

class Enrollment(Base):
    __tablename__ = "enrollments"
    __table_args__ = (UniqueConstraint("course_id", "student_id"),)
    id = Column(String, primary_key=True, default=uid)
    course_id = Column(String, ForeignKey("courses.id"), index=True)
    student_id = Column(String, ForeignKey("users.id"), index=True)

class Meeting(Base):
    __tablename__ = "meetings"
    id = Column(String, primary_key=True, default=uid)
    course_id = Column(String, ForeignKey("courses.id"), index=True)
    created_by = Column(String, ForeignKey("users.id"))
    title = Column(String, nullable=False)
    transcript = Column(Text)
    audio_path = Column(String)
    status = Column(String, default="CREATED")
    created_at = Column(DateTime, default=now)

class Task(Base):  # AI candidates have approved=False until a teacher approves them
    __tablename__ = "tasks"
    id = Column(String, primary_key=True, default=uid)
    meeting_id = Column(String, ForeignKey("meetings.id"), index=True)
    course_id = Column(String, ForeignKey("courses.id"), index=True)
    assigned_to = Column(String, ForeignKey("users.id"), index=True, nullable=True)
    title = Column(String, nullable=False)
    description = Column(Text, default="")
    deadline = Column(String(10), index=True, nullable=True)  # YYYY-MM-DD
    status = Column(String, default="PENDING", index=True)
    ai_confidence = Column(Float)
    is_explicit = Column(Boolean, default=False)
    approved = Column(Boolean, default=False)
    created_at = Column(DateTime, default=now)
