DEMO_PASSWORD = "password123"

DEMO_USERS = (
    {"university_id": "T001", "name": "Dr. Sarah Khan", "email": "teacher@uni.edu", "role": "TEACHER"},
    {"university_id": "S001", "name": "Rahim Ahmed", "email": "rahim@uni.edu", "role": "STUDENT"},
    {"university_id": "S002", "name": "Anika Rahman", "email": "anika@uni.edu", "role": "STUDENT"},
    {"university_id": "S003", "name": "Karim Hossain", "email": "karim@uni.edu", "role": "STUDENT"},
)

DEMO_COURSE = {"course_code": "CSE-101", "name": "Introduction to AI"}

DEMO_DEPARTMENTS = (
    {"code": "CSE", "name": "Department of Computer Science and Engineering"},
    {"code": "SWE", "name": "Department of Software Engineering"},
    {"code": "EEE", "name": "Department of Electrical and Electronic Engineering"},
)

DEMO_TEACHER_PROFILES = {
    "teacher@uni.edu": {
        "department_code": "CSE",
        "designation": "Assistant Professor",
        "professional_info": "Artificial intelligence and software systems.",
    },
}

DEMO_COURSE_DETAILS = {
    "CSE-101": {"department_code": "CSE", "semester": "Fall", "section": "A", "academic_year": "2026"},
}