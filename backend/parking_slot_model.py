# employee_vehicle_model_mongo.py

import os
from pymongo import MongoClient
from dotenv import load_dotenv

# — Load env & connect —
load_dotenv()
MONGO_URI = os.getenv("MONGO_URI")
if not MONGO_URI:
    raise RuntimeError("MONGO_URI not set in .env")
client = MongoClient(MONGO_URI)
db = client.get_default_database()
employees = db.employee_vehicle_plates

# — Ensure unique plate_number index —
employees.create_index("plate_number", unique=True)

def add_employee_plate(plate_number: str) -> dict:
    """
    Insert a new employee plate; raises on duplicate.
    """
    doc = {"plate_number": plate_number}
    try:
        employees.insert_one(doc)
    except Exception as e:
        raise ValueError(f"Could not add plate: {e}")
    return doc

def get_all_employee_plates() -> list:
    """
    Return all employee plate_number strings.
    """
    return [d["plate_number"] for d in employees.find({}, {"plate_number": 1, "_id": 0})]