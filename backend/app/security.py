import os, datetime as dt, secrets
from argon2 import PasswordHasher
from jose import jwt, JWTError
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
from .database import get_db
from .models import User

ph = PasswordHasher()
bearer = HTTPBearer(auto_error=False)
SECRET = os.getenv("JWT_SECRET", "")
if len(SECRET) < 32 or SECRET == "change-me-to-a-long-random-string":
    if os.getenv("ENVIRONMENT", "development").lower() == "production":
        raise RuntimeError("Set JWT_SECRET to a random value of at least 32 characters in production")
    SECRET = secrets.token_urlsafe(32)

def hash_pw(p): return ph.hash(p)

def verify_pw(h, p):
    try: return ph.verify(h, p)
    except Exception: return False

def make_token(u):
    exp = dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=60)
    return jwt.encode({"sub": u.id, "role": u.role, "exp": exp}, SECRET, algorithm="HS256")

def current_user(cred=Depends(bearer), db: Session = Depends(get_db)):
    if not cred: raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(cred.credentials, SECRET, algorithms=["HS256"])
    except JWTError: raise HTTPException(401, "Invalid or expired token")
    sub = payload.get("sub")
    if not isinstance(sub, str) or not sub or "exp" not in payload:
        raise HTTPException(401, "Invalid or expired token")
    u = db.get(User, sub)
    if not u or not u.is_active or u.is_deleted: raise HTTPException(401, "User not found")
    return u

def role_required(role):
    def dep(u=Depends(current_user)):
        if u.role != role: raise HTTPException(403, "Forbidden")
        return u
    return dep
