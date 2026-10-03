import os, re, time, uuid, datetime as dt
from pathlib import Path
from typing import Literal, Optional
from collections import defaultdict
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from .database import SessionLocal, initialize_database, get_db
from . import models as m, ai
from .security import verify_pw, hash_pw, make_token, current_user, role_required
from .settings import settings
from .demo import DEMO_PASSWORD, DEMO_USERS

initialize_database()
app = FastAPI(title=settings.app_name)
PROFILE_IMAGE_DIR = Path("uploads") / "profile-pictures"
PROFILE_IMAGE_DIR.mkdir(parents=True, exist_ok=True)
MAX_PROFILE_IMAGE = 5 * 1024 * 1024
app.mount("/profile-media", StaticFiles(directory=str(PROFILE_IMAGE_DIR)), name="profile-media")
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000").split(","),
                   allow_methods=["*"], allow_headers=["*"])
STATUSES = {"PENDING", "IN_PROGRESS", "COMPLETED"}
AUDIO_EXT, MAX_AUDIO = {".mp3", ".wav", ".m4a", ".webm", ".ogg"}, 25 * 1024 * 1024
hits = defaultdict(list)

def provision_configured_admin():
    if not settings.admin_email or not settings.admin_password:
        return
    db = SessionLocal()
    try:
        admin = db.query(m.User).filter(func.lower(m.User.email) == settings.admin_email).first()
        if admin:
            if admin.role != "ADMIN":
                raise RuntimeError("ADMIN_EMAIL is already assigned to a non-admin account")
            return
        db.add(m.User(name="Platform Administrator", email=settings.admin_email,
                      password_hash=hash_pw(settings.admin_password), role="ADMIN", is_approved=True))
        db.commit()
    finally:
        db.close()

provision_configured_admin()

def limit(key, n=10, per=60):  # tiny in-memory rate limiter
    t = time.time(); hits[key] = [x for x in hits[key] if t - x < per]
    if len(hits[key]) >= n: raise HTTPException(429, "Too many requests - please wait a minute")
    hits[key].append(t)

def tdict(t, db):
    c = db.get(m.Course, t.course_id); u = db.get(m.User, t.assigned_to) if t.assigned_to else None
    st = t.status
    if st != "COMPLETED" and t.deadline and t.deadline < str(dt.date.today()): st = "OVERDUE"
    return dict(id=t.id, title=t.title, description=t.description, deadline=t.deadline, status=st,
                course=c.course_code if c else "", assignee_id=t.assigned_to, assignee=u.name if u else None,
                confidence=t.ai_confidence, is_explicit=t.is_explicit, approved=t.approved, meeting_id=t.meeting_id)

def own_course(db, cid, u):
    c = db.get(m.Course, cid)
    if not c or c.teacher_id != u.id: raise HTTPException(404, "Course not found")
    return c

def profile_user(u=Depends(current_user)):
    if u.role not in {"STUDENT", "TEACHER"}:
        raise HTTPException(403, "Student or teacher profile access required")
    return u

def get_task(db, tid, u):
    t = db.get(m.Task, tid)
    if not t: raise HTTPException(404, "Task not found")
    own_course(db, t.course_id, u)
    return t

# ---------- auth ----------
class Login(BaseModel): email: str; password: str
class Registration(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)
    role: Literal["STUDENT", "TEACHER"] = "STUDENT"

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value):
        value = value.strip()
        if not value: raise ValueError("Name is required")
        return value

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value):
        value = value.strip().lower()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value):
            raise ValueError("Enter a valid email address")
        return value

@app.post("/auth/register", status_code=201)
def register(b: Registration, req: Request, db: Session = Depends(get_db)):
    limit("register:" + (req.client.host if req.client else "x"), n=5)
    domain = b.email.rsplit("@", 1)[1]
    if domain not in settings.allowed_registration_domains:
        allowed = ", ".join(f"@{value}" for value in settings.allowed_registration_domains)
        raise HTTPException(422, f"Use an email from an allowed domain: {allowed}")
    existing = db.query(m.User).filter(func.lower(m.User.email) == b.email).first()
    if existing: raise HTTPException(409, "An account with this email already exists")
    user = m.User(name=b.name, email=b.email, password_hash=hash_pw(b.password), role=b.role,
                   is_approved=b.role == "STUDENT")
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "An account with this email already exists")
    return {"message": "Account created successfully", "email": user.email, "role": user.role,
            "approval_required": not user.is_approved}

@app.post("/auth/login")
def login(b: Login, req: Request, db: Session = Depends(get_db)):
    limit("login:" + (req.client.host if req.client else "x"))
    u = db.query(m.User).filter(m.User.email == b.email.lower().strip()).first()
    if not u or not u.is_active or not verify_pw(u.password_hash, b.password):
        raise HTTPException(401, "Invalid email or password")
    if u.role == "ADMIN": raise HTTPException(403, "Use the separate administrator sign-in")
    if u.role == "TEACHER" and not u.is_approved:
        raise HTTPException(403, "Your teacher account is waiting for administrator approval")
    if u.role not in {"STUDENT", "TEACHER"}: raise HTTPException(403, "This account cannot use standard sign-in")
    return {"access_token": make_token(u), "role": u.role, "name": u.name}

@app.post("/auth/admin/login")
def admin_login(b: Login, req: Request, db: Session = Depends(get_db)):
    limit("admin-login:" + (req.client.host if req.client else "x"), n=5)
    u = db.query(m.User).filter(m.User.email == b.email.lower().strip()).first()
    if not u or u.role != "ADMIN" or not u.is_active or not u.is_approved or not verify_pw(u.password_hash, b.password):
        raise HTTPException(401, "Invalid administrator credentials")
    return {"access_token": make_token(u), "role": u.role, "name": u.name}

@app.get("/public/config")
def public_config():
    return {
        "app_name": settings.app_name,
        "organization_name": settings.organization_name,
        "allowed_registration_domains": list(settings.allowed_registration_domains),
        "demo_mode": settings.demo_mode,
        "demo_accounts": [
            {"name": user["name"], "email": user["email"], "role": user["role"]}
            for user in DEMO_USERS
        ] if settings.demo_mode else [],
        "demo_password": DEMO_PASSWORD if settings.demo_mode else None,
        "teacher_designations": list(settings.teacher_designations),
        "demo_departments": [{"code": code, "name": name} for code, name in settings.demo_departments],
    }

class ActiveState(BaseModel): is_active: bool
class UserUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    email: Optional[str] = Field(default=None, min_length=3, max_length=254)
    university_id: Optional[str] = Field(default=None, max_length=80)
    department_id: Optional[str] = None
    designation: Optional[str] = Field(default=None, max_length=100)
    professional_info: Optional[str] = Field(default=None, max_length=4000)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value):
        if value is None: return value
        value = value.strip()
        if not value: raise ValueError("Name cannot be empty")
        return value

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value):
        if value is None: return value
        value = value.strip().lower()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value):
            raise ValueError("Enter a valid email address")
        return value

    @field_validator("university_id")
    @classmethod
    def normalize_university_id(cls, value):
        return value.strip() or None if value is not None else None

class ProfileUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    phone_number: Optional[str] = Field(default=None, max_length=30)
    gender: Optional[str] = Field(default=None, max_length=40)

    @field_validator("name")
    @classmethod
    def normalize_profile_name(cls, value):
        if value is None: return value
        value = value.strip()
        if not value: raise ValueError("Name cannot be empty")
        return value

    @field_validator("phone_number")
    @classmethod
    def normalize_phone_number(cls, value):
        if value is None: return value
        value = value.strip()
        if not value: return None
        if not re.fullmatch(r"\+?[0-9()\-\s]{7,24}", value):
            raise ValueError("Enter a valid phone number")
        return value

    @field_validator("gender")
    @classmethod
    def normalize_gender(cls, value):
        if value is None: return value
        value = value.strip()
        if value not in {"Female", "Male", "Non-binary", "Other", "Prefer not to say"}:
            raise ValueError("Choose a valid gender option")
        return value

class DepartmentCreate(BaseModel):
    code: str = Field(min_length=2, max_length=24)
    name: str = Field(min_length=2, max_length=160)

    @field_validator("code")
    @classmethod
    def normalize_department_code(cls, value):
        value = value.strip().upper()
        if not re.fullmatch(r"[A-Z0-9_-]{2,24}", value): raise ValueError("Use letters, numbers, hyphens, or underscores for a department code")
        return value

    @field_validator("name")
    @classmethod
    def normalize_department_name(cls, value):
        value = value.strip()
        if not value: raise ValueError("Department name is required")
        return value

class DepartmentUpdate(BaseModel):
    code: Optional[str] = Field(default=None, min_length=2, max_length=24)
    name: Optional[str] = Field(default=None, min_length=2, max_length=160)
    is_active: Optional[bool] = None

    @field_validator("code")
    @classmethod
    def normalize_update_department_code(cls, value):
        if value is None: return value
        value = value.strip().upper()
        if not re.fullmatch(r"[A-Z0-9_-]{2,24}", value): raise ValueError("Invalid department code")
        return value

    @field_validator("name")
    @classmethod
    def normalize_update_department_name(cls, value):
        if value is None: return value
        value = value.strip()
        if not value: raise ValueError("Department name cannot be empty")
        return value

def admin_managed_user(db: Session, user_id: str):
    user = db.get(m.User, user_id)
    if not user or user.role not in {"STUDENT", "TEACHER"}:
        raise HTTPException(404, "Student or teacher account not found")
    return user

def teacher_details(db: Session, user: m.User):
    if user.role != "TEACHER": return None
    profile = db.get(m.TeacherProfile, user.id)
    department = db.get(m.Department, profile.department_id) if profile and profile.department_id else None
    assigned = db.query(m.Course).filter_by(teacher_id=user.id).order_by(m.Course.course_code).all()
    return {
        "department_id": profile.department_id if profile else None,
        "department_code": department.code if department else None,
        "department_name": department.name if department else None,
        "designation": profile.designation if profile else None,
        "professional_info": profile.professional_info if profile else None,
        "assigned_courses": [{
            "id": course.id,
            "name": course.name,
            "course_code": course.course_code,
            "department_id": course.department_id,
            "department_name": (db.get(m.Department, course.department_id).name if course.department_id and db.get(m.Department, course.department_id) else None),
            "semester": course.semester,
            "section": course.section,
            "academic_year": course.academic_year,
        } for course in assigned],
    }

def admin_user_dict(user, db: Session):
    result = {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "university_id": user.university_id,
        "is_active": user.is_active,
        "is_approved": user.is_approved,
        "is_deleted": user.is_deleted,
        "deleted_at": user.deleted_at.isoformat() if user.deleted_at else None,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "phone_number": user.phone_number,
        "gender": user.gender,
        "profile_picture_url": f"/profile-media/{user.profile_picture_path}" if user.profile_picture_path else None,
        "phone_number": user.phone_number,
        "gender": user.gender,
        "profile_picture_url": f"/profile-media/{user.profile_picture_path}" if user.profile_picture_path else None,
    }
    if user.role == "TEACHER": result.update(teacher_details(db, user) or {})
    return result

def profile_dict(user: m.User, db: Session):
    status = "Deleted" if user.is_deleted else "Inactive" if not user.is_active else "Pending approval" if user.role == "TEACHER" and not user.is_approved else "Active"
    result = {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "university_id": user.university_id,
        "student_id": user.university_id if user.role == "STUDENT" else None,
        "teacher_id": user.university_id if user.role == "TEACHER" else None,
        "phone_number": user.phone_number,
        "gender": user.gender,
        "profile_picture_url": f"/profile-media/{user.profile_picture_path}" if user.profile_picture_path else None,
        "role": user.role,
        "account_status": status,
        "is_active": user.is_active,
        "is_approved": user.is_approved,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }
    if user.role == "TEACHER": result["teacher"] = teacher_details(db, user)
    return result

def delete_profile_image(filename: str | None):
    if not filename or Path(filename).name != filename: return
    path = PROFILE_IMAGE_DIR / filename
    try: path.unlink(missing_ok=True)
    except OSError: pass

@app.get("/admin/summary", dependencies=[Depends(role_required("ADMIN"))])
def admin_summary(db: Session = Depends(get_db)):
    role_counts = dict(db.query(m.User.role, func.count(m.User.id)).group_by(m.User.role).all())
    return {
        "users": sum(role_counts.values()),
        "students": role_counts.get("STUDENT", 0),
        "teachers": role_counts.get("TEACHER", 0),
        "admins": role_counts.get("ADMIN", 0),
        "pending_teachers": db.query(m.User).filter_by(role="TEACHER", is_approved=False).count(),
        "courses": db.query(m.Course).count(),
        "meetings": db.query(m.Meeting).count(),
        "departments": db.query(m.Department).count(),
    }

@app.get("/admin/users", dependencies=[Depends(role_required("ADMIN"))])
def admin_users(
    role: Optional[Literal["STUDENT", "TEACHER"]] = None,
    q: str = Query(default="", max_length=200),
    status: Literal["all", "active", "inactive", "pending", "deleted"] = "all",
    sort: Literal["name", "date"] = "date",
    direction: Literal["asc", "desc"] = "desc",
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(m.User).filter(m.User.role.in_(["STUDENT", "TEACHER"]))
    if role: query = query.filter(m.User.role == role)
    if q.strip():
        pattern = f"%{q.strip()}%"
        query = query.filter((m.User.name.ilike(pattern)) | (m.User.email.ilike(pattern)) | (m.User.university_id.ilike(pattern)))
    if status == "deleted": query = query.filter(m.User.is_deleted == True)
    elif status == "active": query = query.filter(m.User.is_deleted == False, m.User.is_active == True, m.User.is_approved == True)
    elif status == "inactive": query = query.filter(m.User.is_deleted == False, m.User.is_active == False)
    elif status == "pending": query = query.filter(m.User.is_deleted == False, m.User.role == "TEACHER", m.User.is_approved == False)

    total = query.count()
    order_column = func.lower(m.User.name) if sort == "name" else m.User.created_at
    order = order_column.asc() if direction == "asc" else order_column.desc()
    users = query.order_by(order, m.User.id.asc()).offset(offset).limit(limit).all()
    return {"items": [admin_user_dict(user, db) for user in users], "total": total, "limit": limit, "offset": offset}

@app.get("/admin/users/{user_id}", dependencies=[Depends(role_required("ADMIN"))])
def admin_user_detail(user_id: str, db: Session = Depends(get_db)):
    return admin_user_dict(admin_managed_user(db, user_id), db)

@app.patch("/admin/users/{user_id}", dependencies=[Depends(role_required("ADMIN"))])
def update_admin_user(user_id: str, body: UserUpdate, db: Session = Depends(get_db)):
    user = admin_managed_user(db, user_id)
    if user.is_deleted: raise HTTPException(409, "Deleted accounts cannot be edited")
    changes = body.model_dump(exclude_unset=True)
    if not changes: raise HTTPException(422, "Provide at least one profile field to update")
    if "email" in changes:
        duplicate = db.query(m.User).filter(func.lower(m.User.email) == changes["email"], m.User.id != user.id).first()
        if duplicate: raise HTTPException(409, "Another account already uses this email")
    if "university_id" in changes and changes["university_id"]:
        duplicate_id = db.query(m.User).filter(m.User.university_id == changes["university_id"], m.User.id != user.id).first()
        if duplicate_id: raise HTTPException(409, "Another account already uses this university ID")
    academic_fields = {"department_id", "designation", "professional_info"} & changes.keys()
    if academic_fields and user.role != "TEACHER":
        raise HTTPException(422, "Teacher academic fields can only be set on teacher accounts")
    teacher_profile = None
    if academic_fields:
        teacher_profile = db.get(m.TeacherProfile, user.id)
        if not teacher_profile:
            teacher_profile = m.TeacherProfile(user_id=user.id)
            db.add(teacher_profile)
        if "department_id" in changes and changes["department_id"]:
            department = db.get(m.Department, changes["department_id"])
            if not department or not department.is_active: raise HTTPException(422, "Choose an active department")
        if "designation" in changes and changes["designation"] and changes["designation"] not in settings.teacher_designations:
            raise HTTPException(422, "Choose a designation from the configured list")
    for field, value in changes.items(): setattr(user, field, value)
    if teacher_profile:
        for field in academic_fields: setattr(teacher_profile, field, changes[field])
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "An account already uses one of those values")
    db.refresh(user)
    return admin_user_dict(user, db)

@app.get("/admin/departments", dependencies=[Depends(role_required("ADMIN"))])
def admin_departments(db: Session = Depends(get_db)):
    departments = db.query(m.Department).order_by(m.Department.code).all()
    return [{"id": item.id, "code": item.code, "name": item.name, "is_active": item.is_active} for item in departments]

@app.post("/admin/departments", status_code=201, dependencies=[Depends(role_required("ADMIN"))])
def create_department(body: DepartmentCreate, db: Session = Depends(get_db)):
    department = m.Department(code=body.code, name=body.name)
    db.add(department)
    try: db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "A department with that code or name already exists")
    db.refresh(department)
    return {"id": department.id, "code": department.code, "name": department.name, "is_active": department.is_active}

@app.patch("/admin/departments/{department_id}", dependencies=[Depends(role_required("ADMIN"))])
def update_department(department_id: str, body: DepartmentUpdate, db: Session = Depends(get_db)):
    department = db.get(m.Department, department_id)
    if not department: raise HTTPException(404, "Department not found")
    changes = body.model_dump(exclude_unset=True)
    if not changes: raise HTTPException(422, "Provide department information to update")
    for field, value in changes.items(): setattr(department, field, value)
    try: db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "A department with that code or name already exists")
    return {"id": department.id, "code": department.code, "name": department.name, "is_active": department.is_active}

@app.post("/admin/teachers/{user_id}/approve", dependencies=[Depends(role_required("ADMIN"))])
def approve_teacher(user_id: str, db: Session = Depends(get_db)):
    teacher = db.get(m.User, user_id)
    if not teacher or teacher.role != "TEACHER": raise HTTPException(404, "Teacher not found")
    teacher.is_approved = True
    db.commit()
    return {"ok": True, "user_id": teacher.id}

@app.patch("/admin/users/{user_id}/active", dependencies=[Depends(role_required("ADMIN"))])
def set_user_active(user_id: str, body: ActiveState, db: Session = Depends(get_db)):
    user = admin_managed_user(db, user_id)
    if user.is_deleted: raise HTTPException(409, "Deleted accounts cannot be activated or deactivated")
    user.is_active = body.is_active
    db.commit()
    return {"ok": True, "user_id": user.id, "is_active": user.is_active}

@app.delete("/admin/users/{user_id}", dependencies=[Depends(role_required("ADMIN"))])
def delete_admin_user(user_id: str, db: Session = Depends(get_db)):
    user = admin_managed_user(db, user_id)
    if user.is_deleted: raise HTTPException(409, "Account is already deleted")
    user.is_active = False
    user.is_deleted = True
    user.deleted_at = dt.datetime.now(dt.timezone.utc)
    db.commit()
    return {"ok": True, "user_id": user.id, "is_deleted": True}

@app.get("/me")
def me(u=Depends(current_user)): return dict(id=u.id, name=u.name, email=u.email, role=u.role)

@app.get("/profile")
def get_profile(u=Depends(profile_user), db: Session = Depends(get_db)):
    return profile_dict(u, db)

@app.patch("/profile")
def update_profile(body: ProfileUpdate, u=Depends(profile_user), db: Session = Depends(get_db)):
    changes = body.model_dump(exclude_unset=True)
    if not changes: raise HTTPException(422, "Provide at least one profile field to update")
    for field, value in changes.items(): setattr(u, field, value)
    db.commit()
    db.refresh(u)
    return profile_dict(u, db)

@app.put("/profile/picture")
def upload_profile_picture(image: UploadFile = File(...), u=Depends(profile_user), db: Session = Depends(get_db)):
    if image.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(415, "Use a JPEG, PNG, or WebP image")
    data = image.file.read(MAX_PROFILE_IMAGE + 1)
    if len(data) > MAX_PROFILE_IMAGE: raise HTTPException(413, "Profile image must be 5 MB or smaller")
    if data.startswith(b"\x89PNG\r\n\x1a\n") and image.content_type == "image/png": extension = ".png"
    elif data.startswith(b"\xff\xd8\xff") and image.content_type == "image/jpeg": extension = ".jpg"
    elif len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP" and image.content_type == "image/webp": extension = ".webp"
    else: raise HTTPException(415, "Image content does not match its declared type")

    filename = f"{u.id}-{uuid.uuid4().hex}{extension}"
    destination = PROFILE_IMAGE_DIR / filename
    try:
        destination.write_bytes(data)
        old_picture = u.profile_picture_path
        u.profile_picture_path = filename
        db.commit()
    except Exception:
        db.rollback()
        delete_profile_image(filename)
        raise
    delete_profile_image(old_picture)
    db.refresh(u)
    return {"profile_picture_url": f"/profile-media/{filename}"}

@app.delete("/profile/picture")
def remove_profile_picture(u=Depends(profile_user), db: Session = Depends(get_db)):
    old_picture = u.profile_picture_path
    u.profile_picture_path = None
    db.commit()
    delete_profile_image(old_picture)
    return {"ok": True, "profile_picture_url": None}

# ---------- student ----------
@app.get("/student/tasks")
def student_tasks(u=Depends(role_required("STUDENT")), db: Session = Depends(get_db)):
    ts = db.query(m.Task).filter(m.Task.assigned_to == u.id, m.Task.approved == True).order_by(m.Task.deadline).all()
    return [tdict(t, db) for t in ts]

class StatusIn(BaseModel): status: str

@app.patch("/student/tasks/{tid}")
def student_update(tid: str, b: StatusIn, u=Depends(role_required("STUDENT")), db: Session = Depends(get_db)):
    if b.status not in STATUSES: raise HTTPException(422, "Invalid status")
    t = db.get(m.Task, tid)
    if not t or t.assigned_to != u.id or not t.approved: raise HTTPException(404, "Task not found")
    t.status = b.status; db.commit()
    return tdict(t, db)

class Ask(BaseModel): question: str

@app.post("/ai/student-assistant")
def assistant(b: Ask, u=Depends(role_required("STUDENT")), db: Session = Depends(get_db)):
    limit("ai:" + u.id, 20)
    q = b.question.strip()
    if not q or len(q) > 500: raise HTTPException(422, "Question must be 1-500 characters")
    ts = db.query(m.Task).filter(m.Task.assigned_to == u.id, m.Task.approved == True).all()  # only THIS student's data
    return {"answer": ai.answer(q, [tdict(t, db) for t in ts])}

# ---------- teacher ----------
@app.get("/teacher/courses")
def courses(u=Depends(role_required("TEACHER")), db: Session = Depends(get_db)):
    return [{
        "id": course.id,
        "course_code": course.course_code,
        "name": course.name,
        "department_name": db.get(m.Department, course.department_id).name if course.department_id and db.get(m.Department, course.department_id) else None,
        "semester": course.semester,
        "section": course.section,
        "academic_year": course.academic_year,
    } for course in db.query(m.Course).filter_by(teacher_id=u.id)]

@app.get("/courses/{cid}/students")
def course_students(cid: str, u=Depends(role_required("TEACHER")), db: Session = Depends(get_db)):
    own_course(db, cid, u)
    rows = db.query(m.User).join(m.Enrollment, m.Enrollment.student_id == m.User.id).filter(m.Enrollment.course_id == cid).all()
    return [dict(id=s.id, name=s.name) for s in rows]

@app.get("/courses/{cid}/tasks")
def course_tasks(cid: str, u=Depends(role_required("TEACHER")), db: Session = Depends(get_db)):
    own_course(db, cid, u)
    return [tdict(t, db) for t in db.query(m.Task).filter_by(course_id=cid, approved=True).order_by(m.Task.deadline)]

@app.post("/teacher/meetings")
def create_meeting(course_id: str = Form(...), title: str = Form(...), transcript: str = Form(""),
                   audio: Optional[UploadFile] = File(None), u=Depends(role_required("TEACHER")), db: Session = Depends(get_db)):
    own_course(db, course_id, u)
    path = None
    if audio and audio.filename:
        ext = os.path.splitext(audio.filename)[1].lower()
        if ext not in AUDIO_EXT: raise HTTPException(415, "Unsupported audio type. Use mp3, wav, m4a, webm or ogg")
        data = audio.file.read(MAX_AUDIO + 1)
        if len(data) > MAX_AUDIO: raise HTTPException(413, "Audio file too large (max 25 MB)")
        os.makedirs("uploads", exist_ok=True)
        path = f"uploads/{uuid.uuid4()}{ext}"
        open(path, "wb").write(data)
    if not title.strip() or not (transcript.strip() or path): raise HTTPException(422, "Title and a transcript or audio file are required")
    mt = m.Meeting(course_id=course_id, created_by=u.id, title=title.strip(), transcript=transcript.strip() or None, audio_path=path)
    db.add(mt); db.commit()
    return dict(id=mt.id)

@app.post("/teacher/meetings/{mid}/process")
def process(mid: str, u=Depends(role_required("TEACHER")), db: Session = Depends(get_db)):
    mt = db.get(m.Meeting, mid)
    if not mt: raise HTTPException(404, "Meeting not found")
    own_course(db, mt.course_id, u)
    if not mt.transcript and mt.audio_path:
        try: mt.transcript = ai.transcribe(mt.audio_path)
        except Exception as e:
            mt.status = "FAILED"; db.commit()
            raise HTTPException(502, f"Transcription failed ({e}). Create the meeting again with a pasted transcript.")
    roster = db.query(m.User).join(m.Enrollment, m.Enrollment.student_id == m.User.id).filter(m.Enrollment.course_id == mt.course_id).all()
    cands, src = ai.extract_tasks(mt.transcript, [s.name for s in roster])
    db.query(m.Task).filter_by(meeting_id=mid, approved=False).delete()
    for c in cands:
        who = next((s for s in roster if c.assignee_name and s.name.lower().split()[0] == c.assignee_name.lower().split()[0]), None)
        db.add(m.Task(meeting_id=mid, course_id=mt.course_id, assigned_to=who.id if who else None, title=c.task_title,
                      description=c.description, deadline=c.deadline, ai_confidence=c.confidence, is_explicit=bool(c.is_explicit and who)))
    mt.status = "PROCESSED"; db.commit()
    return dict(source=src, count=len(cands))

@app.get("/teacher/meetings/{mid}/ai-tasks")
def ai_tasks(mid: str, u=Depends(role_required("TEACHER")), db: Session = Depends(get_db)):
    mt = db.get(m.Meeting, mid)
    if not mt: raise HTTPException(404, "Meeting not found")
    own_course(db, mt.course_id, u)
    return [tdict(t, db) for t in db.query(m.Task).filter_by(meeting_id=mid, approved=False)]

class Edit(BaseModel):
    title: Optional[str] = None; assigned_to: Optional[str] = None; deadline: Optional[str] = None; status: Optional[str] = None
class Approve(Edit): task_id: str

def apply_edit(t, b, db):
    d = b.model_dump(exclude_unset=True); d.pop("task_id", None)
    if d.get("assigned_to") and not db.query(m.Enrollment).filter_by(course_id=t.course_id, student_id=d["assigned_to"]).first():
        raise HTTPException(422, "Student is not enrolled in this course")
    if d.get("deadline"):
        try: dt.date.fromisoformat(d["deadline"])
        except ValueError: raise HTTPException(422, "Deadline must be YYYY-MM-DD")
    if d.get("status") and d["status"] not in STATUSES: raise HTTPException(422, "Invalid status")
    if "title" in d and not (d["title"] or "").strip(): raise HTTPException(422, "Title cannot be empty")
    for k, v in d.items(): setattr(t, k, v)

@app.post("/teacher/tasks/approve")
def approve(b: Approve, u=Depends(role_required("TEACHER")), db: Session = Depends(get_db)):
    t = get_task(db, b.task_id, u); apply_edit(t, b, db)
    if not t.assigned_to: raise HTTPException(422, "Choose a student before approving this task")
    t.approved = True; db.commit()
    return tdict(t, db)

@app.patch("/teacher/tasks/{tid}")
def edit_task(tid: str, b: Edit, u=Depends(role_required("TEACHER")), db: Session = Depends(get_db)):
    t = get_task(db, tid, u); apply_edit(t, b, db); db.commit()
    return tdict(t, db)

@app.delete("/teacher/tasks/{tid}")
def delete_task(tid: str, u=Depends(role_required("TEACHER")), db: Session = Depends(get_db)):
    t = get_task(db, tid, u); db.delete(t); db.commit()
    return {"ok": True}
