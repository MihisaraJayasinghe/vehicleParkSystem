# parking_slot_crud_mongo.py

import os
from datetime import datetime
from pymongo import MongoClient, errors
from dotenv import load_dotenv

# — Load env & connect —
load_dotenv()
MONGO_URI = os.getenv("MONGO_URI")
if not MONGO_URI:
    raise RuntimeError("MONGO_URI not set in .env")
client = MongoClient(MONGO_URI)
db = client.get_default_database()    # or client["your_db_name"]
slots = db.parking_slots

# — Ensure unique slot_id index —
slots.create_index("slot_id", unique=True)

def init_slots(count: int = 100):
    """
    Populate `parking_slots` with slot_id 1…count if empty.
    """
    if slots.count_documents({}) == 0:
        docs = [
            {
                "slot_id": i,
                "status": "free",            # free|booked|parked
                "parked_vehicle_plate": None,
                "parked_time": None
            }
            for i in range(1, count + 1)
        ]
        slots.insert_many(docs)

def book_slot(slot_id: int, vehicle_plate: str) -> dict:
    """
    Mark a slot as 'booked' and assign the vehicle_plate.
    """
    result = slots.find_one_and_update(
        {"slot_id": slot_id, "status": "free"},
        {"$set": {"status": "booked", "parked_vehicle_plate": vehicle_plate}},
        return_document=True
    )
    if not result:
        raise ValueError(f"Slot {slot_id} not free")
    return result

def park_slot(slot_id: int, vehicle_plate: str) -> dict:
    """
    Move a 'booked' slot to 'parked' and record current UTC time.
    """
    now = datetime.utcnow()
    result = slots.find_one_and_update(
        {
            "slot_id": slot_id,
            "status": "booked",
            "parked_vehicle_plate": vehicle_plate
        },
        {"$set": {"status": "parked", "parked_time": now}},
        return_document=True
    )
    if not result:
        raise ValueError(f"Slot {slot_id} not booked for {vehicle_plate}")
    return result

def get_all_slots() -> list:
    """
    Return all slots with their current fields.
    """
    return list(slots.find({}, {"_id": 0}))

def clear_slot(slot_id: int, rate_per_hour: float = 10.0) -> dict:
    """
    Free a parked slot, calculate fee & return fee info.
    """
    doc = slots.find_one({"slot_id": slot_id})
    if not doc or doc["status"] != "parked" or not doc.get("parked_time"):
        raise ValueError(f"Slot {slot_id} not parked")
    
    start = doc["parked_time"]
    end = datetime.utcnow()
    hours = (end - start).total_seconds() / 3600.0
    fee = round(hours * rate_per_hour, 2)
    
    # reset slot
    slots.update_one(
        {"slot_id": slot_id},
        {"$set": {"status": "free", "parked_vehicle_plate": None, "parked_time": None}}
    )
    return {
        "slot_id": slot_id,
        "parked_time": start,
        "cleared_time": end,
        "duration_hours": hours,
        "fee": fee
    }