
from pymongo import MongoClient
from datetime import datetime
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
MONGO_URI = os.getenv("MONGO_URI")

def init_parking_slots_with_allocations():
    try:
        # Connect to MongoDB
        client = MongoClient(MONGO_URI)
        db = client.parkvision_db
        slot_allocations = db.slot_allocations

        # Clear existing allocations
        slot_allocations.delete_many({})

        # Sample vehicle plates for demonstration
        sample_vehicles = [
            {"plate": "ABC123", "type": "regular"},
            {"plate": "XYZ789", "type": "reserved"},
            {"plate": "DEF456", "type": "handicap"},
        ]

        # Create 100 slots with some pre-allocated
        slots = []
        for i in range(100):
            slot_id = str(i + 1)
            
            # Allocate some slots for demonstration
            is_allocated = i % 4 == 0  # Every 4th slot is allocated
            vehicle = sample_vehicles[i % len(sample_vehicles)] if is_allocated else None
            
            slot = {
                "slot_id": slot_id,
                "vehicle_plate": vehicle["plate"] if vehicle else None,
                "allocation_type": vehicle["type"] if vehicle else "regular",
                "is_occupied": is_allocated,
                "occupied_since": datetime.utcnow() if is_allocated else None,
                "last_updated": datetime.utcnow()
            }
            slots.append(slot)

        # Insert all slots
        result = slot_allocations.insert_many(slots)
        print(f"Successfully created {len(result.inserted_ids)} slot allocations")

    except Exception as e:
        print(f"Error initializing slot allocations: {str(e)}")
    finally:
        client.close()

if __name__ == "__main__":
    init_parking_slots_with_allocations()