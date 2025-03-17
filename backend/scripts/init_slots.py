from pymongo import MongoClient
from datetime import datetime
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
MONGO_URI = os.getenv("MONGO_URI")

def init_parking_slots():
    try:
        # Connect to MongoDB
        client = MongoClient(MONGO_URI)
        db = client.parkvision_db
        parking_slots = db.parking_slots

        # Clear existing slots
        parking_slots.delete_many({})

        # Create 100 slots with initial free status
        slots = [
            {
                "slot_id": str(i + 1),
                "status": "free",
                "plate_number": None,
                "booking_time": None,
                "parking_time": None,
                "created_at": datetime.utcnow()
            }
            for i in range(100)
        ]

        # Insert all slots
        result = parking_slots.insert_many(slots)
        print(f"Successfully created {len(result.inserted_ids)} parking slots")

    except Exception as e:
        print(f"Error initializing parking slots: {str(e)}")
    finally:
        client.close()

if __name__ == "__main__":
    init_parking_slots()
