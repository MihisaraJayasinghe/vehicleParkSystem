# employee_vehicle_model.py

import os
from pymongo import MongoClient, errors
from dotenv import load_dotenv

# -------------------------------------------------------------------
# Load environment and connect to MongoDB
# -------------------------------------------------------------------
load_dotenv()
MONGO_URI = os.getenv("MONGO_URI")
if not MONGO_URI:
    raise RuntimeError("MONGO_URI not set in .env")

client = MongoClient(MONGO_URI)
db = client.get_default_database()  # or client["your_db_name"]
employees = db.employee_vehicle_plates

# -------------------------------------------------------------------
# Ensure unique index on plate_number
# -------------------------------------------------------------------
employees.create_index("plate_number", unique=True)


# -------------------------------------------------------------------
# 1) Initialize the employee plates collection
# -------------------------------------------------------------------
def init_employee_table():
    """
    Ensures the 'employee_vehicle_plates' collection exists
    and has a unique index on 'plate_number'.
    """
    # Collection is implicitly created on first write;
    # index already created above.
    return True


# -------------------------------------------------------------------
# 2) Add an employee plate
# -------------------------------------------------------------------
def add_employee_plate(plate_number: str) -> dict:
    """
    Inserts a new employee plate into the whitelist.
    Raises ValueError if the plate already exists.
    Returns the inserted document.
    """
    try:
        doc = {"plate_number": plate_number}
        employees.insert_one(doc)
        return doc
    except errors.DuplicateKeyError:
        raise ValueError(f"Plate '{plate_number}' is already registered")


# -------------------------------------------------------------------
# 3) Remove an employee plate
# -------------------------------------------------------------------
def remove_employee_plate(plate_number: str) -> bool:
    """
    Deletes the given plate_number from the whitelist.
    Returns True if deleted, False if not found.
    """
    result = employees.delete_one({"plate_number": plate_number})
    return result.deleted_count == 1


# -------------------------------------------------------------------
# 4) Get all employee plates
# -------------------------------------------------------------------
def get_all_employee_plates() -> list:
    """
    Returns a list of all registered employee plate numbers.
    """
    return [d["plate_number"] for d in employees.find({}, {"_id": 0, "plate_number": 1})]


# -------------------------------------------------------------------
# Example usage (for manual testing)
# -------------------------------------------------------------------
if __name__ == "__main__":
    init_employee_table()
    print("✅ employee_vehicle_plates collection ready.")

    # Add a plate
    try:
        print("Added:", add_employee_plate("EMP-001"))
    except ValueError as e:
        print("Add error:", e)

    # List plates
    print("All plates:", get_all_employee_plates())

    # Remove a plate
    if remove_employee_plate("EMP-001"):
        print("Removed EMP-001")
    else:
        print("EMP-001 not found")