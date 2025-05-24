import os
from datetime import datetime
from pymongo import MongoClient
from dotenv import load_dotenv
import logging

load_dotenv()
MONGO_URI = os.getenv("MONGO_URI")
if not MONGO_URI:
    raise RuntimeError("MONGO_URI not set in .env")

try:
    client = MongoClient(MONGO_URI)
except Exception as e:
    logging.error("Failed to connect to MongoDB with MONGO_URI=%s: %s", MONGO_URI, e)
    raise

db = client.get_default_database()
slots = db.parking_slots

try:
    slots.create_index("slot_id", unique=True)
except Exception as e:
    logging.error("Failed to create index for slots: %s", e)

def init_slots(count: int = 100):
    """Seed slots 1-count as free (only if collection empty)."""
    if slots.count_documents({}) == 0:
        docs = [
            {"slot_id": i, "status": "free",
             "parked_vehicle_plate": None, "parked_time": None}
            for i in range(1, count + 1)
        ]
        slots.insert_many(docs)

def book_slot(slot_id: int, plate: str) -> dict:
    plate = plate.strip().upper()
    if slots.find_one({"parked_vehicle_plate": plate, "status": "booked"}):
        _err(f"User with plate {plate} already has a booked slot")
    return slots.find_one_and_update(
        {"slot_id": slot_id, "status": "free"},
        {"$set": {"status": "booked", "parked_vehicle_plate": plate}},
        return_document=True
    ) or _err(f"Slot {slot_id} not free")

def park_slot(slot_id: int, plate: str) -> dict:
    plate = plate.strip().upper()
    now = datetime.utcnow()
    return slots.find_one_and_update(
        {"slot_id": slot_id, "status": "booked",
         "parked_vehicle_plate": plate},
        {"$set": {"status": "parked", "parked_time": now}},
        return_document=True
    ) or _err(f"Slot {slot_id} not booked for {plate}")

def get_all_slots() -> list:
    return list(slots.find({}, {"_id": 0}))

def clear_slot(slot_id: int, vehicle_plate: str, rate: float = 10.0) -> dict:
    # Normalize input vehicle_plate
    vehicle_plate = str(vehicle_plate).strip().upper()
    doc = slots.find_one({"slot_id": slot_id})
    if not doc or doc["status"] != "parked" or not doc["parked_time"]:
        _err(f"Slot {slot_id} not parked")
    stored_plate = str(doc["parked_vehicle_plate"]).strip().upper()
    # Ensure the provided plate matches the parked plate
    if stored_plate != vehicle_plate:
        _err(f"Unauthorized: Slot {slot_id} is parked by {stored_plate}")
    start, end = doc["parked_time"], datetime.utcnow()
    hours = (end - start).total_seconds() / 3600
    fee = round(hours * rate, 2)
    slots.update_one(
        {"slot_id": slot_id},
        {"$set": {"status": "free",
                  "parked_vehicle_plate": None,
                  "parked_time": None}}
    )
    return {"slot_id": slot_id, "parked_time": start,
            "cleared_time": end, "duration_hours": hours, "fee": fee}

def _err(msg):
    raise ValueError(msg)