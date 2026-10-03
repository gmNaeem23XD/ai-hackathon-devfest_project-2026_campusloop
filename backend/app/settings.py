import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


def _as_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    app_name: str
    organization_name: str
    allowed_registration_domains: tuple[str, ...]
    demo_mode: bool
    admin_email: str | None
    admin_password: str | None
    teacher_designations: tuple[str, ...]
    demo_departments: tuple[tuple[str, str], ...]


def load_settings() -> Settings:
    domains = tuple(
        domain.strip().lower().lstrip("@")
        for domain in os.getenv("ALLOWED_REGISTRATION_DOMAINS", "gmail.com,diu.edu.bd").split(",")
        if domain.strip()
    )
    admin_email = os.getenv("ADMIN_EMAIL", "").strip().lower() or None
    admin_password = os.getenv("ADMIN_PASSWORD") or None
    if bool(admin_email) != bool(admin_password):
        raise RuntimeError("Set both ADMIN_EMAIL and ADMIN_PASSWORD to provision an admin account")
    if admin_password and len(admin_password) < 12:
        raise RuntimeError("ADMIN_PASSWORD must contain at least 12 characters")
    designations = tuple(
        designation.strip()
        for designation in os.getenv(
            "TEACHER_DESIGNATIONS",
            "Lecturer,Senior Lecturer,Assistant Professor,Associate Professor,Professor,Other",
        ).split(",")
        if designation.strip()
    )
    departments = tuple(
        (code.strip().upper(), name.strip())
        for entry in os.getenv(
            "DEMO_DEPARTMENTS",
            "CSE:Department of Computer Science and Engineering,SWE:Department of Software Engineering,EEE:Department of Electrical and Electronic Engineering",
        ).split(",")
        if ":" in entry
        for code, name in [entry.split(":", 1)]
        if code.strip() and name.strip()
    )
    return Settings(
        app_name=os.getenv("APP_NAME", "Campusloop").strip() or "Campusloop",
        organization_name=os.getenv("ORGANIZATION_NAME", "Daffodil International University").strip()
        or "Daffodil International University",
        allowed_registration_domains=domains,
        demo_mode=_as_bool(
            os.getenv("DEMO_MODE"),
            default=os.getenv("ENVIRONMENT", "development").strip().lower() not in {"production", "prod"},
        ),
        admin_email=admin_email,
        admin_password=admin_password,
        teacher_designations=designations,
        demo_departments=departments,
    )


settings = load_settings()