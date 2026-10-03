import os
from dotenv import load_dotenv
load_dotenv()
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base

URL = os.getenv("DATABASE_URL", "sqlite:///./app.db")
engine = create_engine(URL, connect_args={"check_same_thread": False} if URL.startswith("sqlite") else {})
SessionLocal = sessionmaker(bind=engine, autoflush=False)
Base = declarative_base()

def initialize_database():
    Base.metadata.create_all(engine)
    with engine.begin() as connection:
        user_columns = {column["name"] for column in inspect(connection).get_columns("users")}
        user_additions = {
            "is_approved": "BOOLEAN NOT NULL DEFAULT TRUE",
            "is_deleted": "BOOLEAN NOT NULL DEFAULT FALSE",
            "deleted_at": "DATETIME",
            "phone_number": "VARCHAR(30)",
            "gender": "VARCHAR(40)",
            "profile_picture_path": "VARCHAR(255)",
        }
        for column, declaration in user_additions.items():
            if column not in user_columns:
                connection.execute(text(f"ALTER TABLE users ADD COLUMN {column} {declaration}"))

        course_columns = {column["name"] for column in inspect(connection).get_columns("courses")}
        course_additions = {
            "department_id": "VARCHAR REFERENCES departments(id)",
            "semester": "VARCHAR(40)",
            "section": "VARCHAR(40)",
            "academic_year": "VARCHAR(24)",
        }
        for column, declaration in course_additions.items():
            if column not in course_columns:
                connection.execute(text(f"ALTER TABLE courses ADD COLUMN {column} {declaration}"))

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
