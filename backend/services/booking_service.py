from datetime import datetime
from typing import Dict, Optional
from pymongo.collection import Collection
import logging

logger = logging.getLogger(__name__)

class BookingService:
    def __init__(self, users_collection: Collection, slots_collection: Collection):
        self.users = users_collection
        self.slots = slots_collection

    async def book_slot(self, slot_id: str, vehicle_plate: str) -> Dict:
        """Book a parking slot for a vehicle."""
        try:
            # Input validation
            if not slot_id or not vehicle_plate:
                return {"error": "Slot ID and vehicle plate are required"}

            # Normalize vehicle plate
            vehicle_plate = vehicle_plate.strip().upper()
            logger.info(f"Booking slot {slot_id} for vehicle {vehicle_plate}")

            # 1. Check if user exists
            user = self.users.find_one({"vehicle_plate": vehicle_plate})
            if not user:
                logger.error(f"User not found for vehicle plate: {vehicle_plate}")
                return {"error": "User not found. Please register first."}

            # 2. Check if user already has a booking
            if user.get("booked_slot"):
                current_slot = self.slots.find_one({"slot_id": user["booked_slot"]})
                if current_slot and current_slot.get("is_booked"):
                    logger.error(f"User already has booked slot: {user['booked_slot']}")
                    return {"error": f"You already have booked slot {user['booked_slot']}"}
                else:
                    # Clear invalid booking
                    self.users.update_one(
                        {"vehicle_plate": vehicle_plate},
                        {"$set": {"booked_slot": None}}
                    )

            # 3. Check if slot exists and is available
            slot = self.slots.find_one({"slot_id": slot_id})
            if not slot:
                logger.error(f"Invalid slot ID: {slot_id}")
                return {"error": "Invalid parking slot"}

            if slot.get("is_occupied"):
                logger.error(f"Slot {slot_id} is occupied")
                return {"error": "This slot is currently occupied"}

            if slot.get("is_booked"):
                if slot.get("booked_by") == vehicle_plate:
                    logger.error(f"Slot {slot_id} already booked by same user")
                    return {"error": "You have already booked this slot"}
                logger.error(f"Slot {slot_id} already booked by another user")
                return {"error": "This slot is already booked by another user"}

            # 4. Book the slot
            booking_time = datetime.utcnow()
            slot_update = self.slots.update_one(
                {
                    "slot_id": slot_id,
                    "is_booked": False,
                    "is_occupied": False
                },
                {
                    "$set": {
                        "is_booked": True,
                        "booked_by": vehicle_plate,
                        "booked_at": booking_time
                    }
                }
            )

            if slot_update.modified_count == 0:
                logger.error(f"Failed to update slot {slot_id}")
                return {"error": "Failed to book slot. It may have been taken by another user."}

            # 5. Update user's booking status
            user_update = self.users.update_one(
                {"vehicle_plate": vehicle_plate},
                {"$set": {"booked_slot": slot_id}}
            )

            if user_update.modified_count == 0:
                # Rollback slot booking
                self.slots.update_one(
                    {"slot_id": slot_id},
                    {
                        "$set": {
                            "is_booked": False,
                            "booked_by": None,
                            "booked_at": None
                        }
                    }
                )
                logger.error(f"Failed to update user booking for {vehicle_plate}")
                return {"error": "Failed to update booking status"}

            logger.info(f"Successfully booked slot {slot_id} for vehicle {vehicle_plate}")
            return {
                "success": True,
                "message": f"Successfully booked slot {slot_id}",
                "data": {
                    "slot_id": slot_id,
                    "vehicle_plate": vehicle_plate,
                    "booked_at": booking_time,
                    "user": {
                        "name": user["name"],
                        "vehicle_type": user["vehicle_type"]
                    }
                }
            }

        except Exception as e:
            logger.error(f"Error booking slot: {str(e)}")
            return {"error": "An unexpected error occurred. Please try again."}
