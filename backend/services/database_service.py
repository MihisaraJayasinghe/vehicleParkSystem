from pymongo import MongoClient
from datetime import datetime
from typing import Dict, Any, Optional, List
import logging

logger = logging.getLogger(__name__)

class DatabaseService:
    def __init__(self, mongo_uri: str):
        self.client = MongoClient(mongo_uri)
        self.db = self.client.parkvision_db
        self.users = self.db.users
        self.parking_slots = self.db.parking_slots
        self.vehicles = self.db.vehicles

    async def register_user(self, user_data: Dict[str, Any]) -> Dict[str, Any]:
        try:
            # Check if user already exists
            existing_user = self.users.find_one({
                "vehicle_plate": user_data.vehicle_plate
            })
            
            if existing_user:
                return {"error": "Vehicle plate already registered"}

            # Insert new user
            user_doc = {
                "name": user_data.name,
                "vehicle_plate": user_data.vehicle_plate,
                "created_at": datetime.utcnow()
            }
            
            result = self.users.insert_one(user_doc)
            
            return {
                "success": True,
                "message": "User registered successfully",
                "user_id": str(result.inserted_id)
            }
            
        except Exception as e:
            logger.error(f"Error registering user: {str(e)}")
            return {"error": "Failed to register user"}

    async def login_user(self, login_data: Dict[str, Any]) -> Dict[str, Any]:
        try:
            # Find user by name and vehicle plate
            user = self.users.find_one({
                "name": login_data.name,
                "vehicle_plate": login_data.vehicle_plate
            })

            if not user:
                # If user doesn't exist, register them
                registration_result = await self.register_user(login_data)
                if "error" in registration_result:
                    return registration_result
                
                user = self.users.find_one({
                    "name": login_data.name,
                    "vehicle_plate": login_data.vehicle_plate
                })

            return {
                "success": True,
                "message": "Login successful",
                "user": {
                    "id": str(user["_id"]),
                    "name": user["name"],
                    "vehicle_plate": user["vehicle_plate"]
                }
            }

        except Exception as e:
            logger.error(f"Error during login: {str(e)}")
            return {"error": "Failed to process login request"}

    async def get_available_slots(self) -> list:
        try:
            return list(self.parking_slots.find({"status": "free"}))
        except Exception as e:
            logger.error(f"Error getting available slots: {str(e)}")
            return []

    async def park_vehicle(self, vehicle_plate: str) -> Dict[str, Any]:
        try:
            # Find the booked slot for this vehicle
            slot = self.parking_slots.find_one({
                "plate_number": vehicle_plate,
                "status": "booked"
            })

            if not slot:
                return {"error": "No booking found for this vehicle"}

            # Update slot status to parked
            self.parking_slots.update_one(
                {"plate_number": vehicle_plate},
                {
                    "$set": {
                        "status": "parked",
                        "parking_time": datetime.utcnow()
                    }
                }
            )

            # Update vehicle status
            self.vehicles.update_one(
                {"license_plate": vehicle_plate},
                {
                    "$set": {
                        "parking_state": "parked",
                        "time_in": datetime.utcnow()
                    }
                }
            )

            return {"message": "Vehicle parked successfully"}

        except Exception as e:
            logger.error(f"Error parking vehicle: {str(e)}")
            return {"error": "Failed to park vehicle"}

    async def remove_vehicle(self, slot_id: str, vehicle_plate: str) -> Dict[str, Any]:
        try:
            # Reset slot status
            self.parking_slots.update_one(
                {"slot_id": slot_id},
                {
                    "$set": {
                        "status": "free",
                        "plate_number": None,
                        "booking_time": None,
                        "parking_time": None
                    }
                }
            )

            # Update vehicle status
            self.vehicles.update_one(
                {"license_plate": vehicle_plate},
                {
                    "$set": {
                        "parking_state": None,
                        "parking_slot": None,
                        "in_parking": False,
                        "time_out": datetime.utcnow()
                    }
                }
            )

            return {"message": "Vehicle removed successfully"}

        except Exception as e:
            logger.error(f"Error removing vehicle: {str(e)}")
            return {"error": "Failed to remove vehicle"}

    async def get_all_slots(self) -> List[Dict[str, Any]]:
        try:
            slots = list(self.parking_slots.find({}, {'_id': 0}))
            return {
                "success": True,
                "slots": slots
            }
        except Exception as e:
            logger.error(f"Error getting slots: {str(e)}")
            return {
                "success": False,
                "error": "Failed to get parking slots"
            }

    async def update_slot_status(self, slot_id: str, status: str, plate_number: str = None) -> Dict[str, Any]:
        try:
            update_data = {
                "status": status,
                "last_updated": datetime.utcnow()
            }
            
            if plate_number:
                update_data["plate_number"] = plate_number
            
            self.parking_slots.update_one(
                {"slot_id": slot_id},
                {"$set": update_data}
            )
            
            return {"success": True, "message": f"Slot {slot_id} updated to {status}"}
        except Exception as e:
            logger.error(f"Error updating slot status: {str(e)}")
            return {"success": False, "error": "Failed to update slot status"}
