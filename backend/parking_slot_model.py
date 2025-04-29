# employee_vehicle_model.py

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

# — Employee plates collection —
employees = db.employee_vehicle_plates
employees.create_index("plate_number", unique=True)

# ==================================================================
# ======= TEMP SEED BLOCK START (REMOVE FOR PRODUCTION) ============
# This will run on import and ensure 100 free slots exist.
try:
    from parking_slot_crud import init_slots
    init_slots(count=100)
    print("✅ (TEMP) parking_slots seeded with 100 free slots")
except ImportError:
    print("⚠️ Could not import init_slots — slot seeding skipped")
# ======= TEMP SEED BLOCK END =====================================
# ==================================================================

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
    return [
        d["plate_number"]
        for d in employees.find({}, {"plate_number": 1, "_id": 0})
    ]

# — If you run this file directly, also seed parking slots manually —
if __name__ == "__main__":
    print("✅ employee_vehicle_plates collection ready.")
    try:
        from parking_slot_crud import init_slots as __init_slots
        __init_slots(count=100)
        print("✅ parking_slots seeded with 100 free slots.")
    except ImportError:
        print("⚠️ Could not import init_slots from parking_slot_crud.py")