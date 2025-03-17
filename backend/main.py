from fastapi import FastAPI, File, UploadFile, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import uvicorn
import logging
from typing import Optional, Dict, Any
from datetime import datetime
from models.database_models import User, UserLogin, ParkingSlot, Employee

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

class BookingRequest(BaseModel):
    vehicle_plate: str

class BookingResponseData(BaseModel):
    slot_id: str
    vehicle_plate: str
    booked_at: str
    user: Dict[str, str]

class BookingResponse(BaseModel):
    success: bool
    message: str
    data: Optional[BookingResponseData] = None
    error: Optional[str] = None

import cv2
import numpy as np
import io
import base64
import tempfile

from ultralytics import YOLO
import easyocr

import os
from pymongo import MongoClient
from dotenv import load_dotenv
from app.slot_service import SlotDetectionService
from services.fee_calculator import ParkingFeeCalculator
from models.parking_models import VehicleEntry, VehicleRemoval

# Add logging
import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Fix the .env loading and MongoDB connection
load_dotenv(dotenv_path="/Users/mihisarajayasinghe/Downloads/vehiclepark/backend/.env")
MONGO_URI = os.getenv("MONGO_URI")

if not MONGO_URI:
    logger.error("MONGO_URI not found in .env file")
    raise ValueError("MONGO_URI environment variable is not set")

try:
    client = MongoClient(MONGO_URI)
    client.admin.command('ping')
    logger.info("Successfully connected to MongoDB Atlas")
    
    from services.database_service import DatabaseService
    from services.booking_service import BookingService
    
    db_service = DatabaseService(MONGO_URI)
    booking_service = BookingService(db_service.users, db_service.parking_slots)
    
    # Initialize 100 parking slots if they don't exist
    if db_service.parking_slots.count_documents({}) == 0:
        slots = [{"slot_id": str(i+1), "status": "free", "plate_number": None} 
                for i in range(100)]
        db_service.parking_slots.insert_many(slots)
        logger.info("Initialized 100 parking slots")

except Exception as e:
    logger.error(f"Failed to connect to MongoDB Atlas: {str(e)}")
    raise

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2) Load your custom YOLO model (ensure the path is correct)
model = YOLO("best5.pt")

# 3) Create an EasyOCR Reader (adjust as needed)
reader = easyocr.Reader(['en'], gpu=False)

# 4) Class labels (adjust as necessary)
class_names = {
    0: 'Lorry',
    1: 'bike',
    2: 'bus',
    3: 'car',
    4: 'number plate',
    5: 'three wheeler',
    6: 'three wheeler',
    7: 'van'
}

# Initialize services for slot detection and fee calculation
slot_service = SlotDetectionService(model_path="/Users/mihisarajayasinghe/Downloads/vehiclepark/backend/parking.pt")
fee_calculator = ParkingFeeCalculator()

from services.database_service import DatabaseService

db_service = DatabaseService(MONGO_URI)

@app.post("/predict_ocr")
async def predict_ocr(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        np_img = np.frombuffer(contents, np.uint8)
        image_bgr = cv2.imdecode(np_img, cv2.IMREAD_COLOR)

        if image_bgr is None:
            return JSONResponse({"error": "Could not decode image"}, status_code=400)

        results = model.predict(source=image_bgr, conf=0.5)
        detections = results[0]
        annotated_img = detections.plot()

        vehicle_types = []
        recognized_plates = []

        for box in detections.boxes:
            cls_id = int(box.cls[0])
            class_name = class_names.get(cls_id, "unknown")
            conf = float(box.conf[0])
            x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())

            if class_name == "number plate":
                plate_region = image_bgr[y1:y2, x1:x2]
                plate_rgb = cv2.cvtColor(plate_region, cv2.COLOR_BGR2RGB)
                ocr_results = reader.readtext(plate_rgb)
                if ocr_results:
                    recognized_str = " ".join([res[1] for res in ocr_results])
                    recognized_plates.append(recognized_str)
                    cv2.putText(
                        annotated_img,
                        recognized_str,
                        (x1, max(y1 - 10, 0)),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.7, (0, 255, 255), 2
                    )
            else:
                vehicle_types.append(class_name)
                cv2.putText(
                    annotated_img,
                    class_name,
                    (x1, max(y1 - 10, 0)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7, (0, 255, 0), 2
                )

        success, encoded_image = cv2.imencode(".png", annotated_img)
        if not success:
            return JSONResponse({"error": "Failed to encode annotated image"}, status_code=500)
        b64_string = base64.b64encode(encoded_image.tobytes()).decode("utf-8")

        response_data = {
            "vehicle_types": vehicle_types,
            "recognized_plates": recognized_plates,
            "annotated_image": b64_string
        }
        return JSONResponse(response_data)

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/add_vehicle")
async def add_vehicle(vehicle: dict = Body(...)):
    try:
        logger.info(f"Adding vehicle: {vehicle}")
        vehicle_type = vehicle.get("vehicle_type")
        license_plate = vehicle.get("license_plate")
        is_employee = vehicle.get("is_employee", False)
        
        if not vehicle_type or not license_plate:
            return JSONResponse({"error": "Missing vehicle_type or license_plate"}, status_code=400)
            
        current_time = datetime.utcnow()
        new_record = {
            "vehicle_type": vehicle_type,
            "license_plate": license_plate,
            "is_employee": is_employee,
            "in_parking": True,
            "time_in": current_time
        }
        
        result = vehicles_collection.insert_one(new_record)
        return JSONResponse({
            "message": "Vehicle added successfully",
            "id": str(result.inserted_id)
        })
        
    except Exception as e:
        logger.error(f"Error adding vehicle: {str(e)}")
        return JSONResponse({"error": f"Failed to add vehicle: {str(e)}"}, status_code=500)

@app.post("/remove_vehicle")
async def remove_vehicle(vehicle: VehicleRemoval):
    try:
        parked_vehicle = vehicles_collection.find_one({
            "license_plate": vehicle.license_plate,
            "in_parking": True
        })
        
        if not parked_vehicle:
            return JSONResponse({"error": "Vehicle not found"}, status_code=404)
            
        fee = fee_calculator.calculate_fee(
            parked_vehicle["time_in"],
            parked_vehicle.get("is_employee", False)
        )
        
        vehicles_collection.update_one(
            {"_id": parked_vehicle["_id"]},
            {
                "$set": {
                    "in_parking": False,
                    "time_out": datetime.utcnow(),
                    "parking_fee": fee
                }
            }
        )
        
        return {
            "message": "Vehicle removed successfully",
            "fee": fee
        }
        
    except Exception as e:
        return JSONResponse({"error": f"Failed to remove vehicle: {str(e)}"}, status_code=500)

@app.get("/parking_status")
async def get_parking_status():
    try:
        total_slots = 100
        parked_count = vehicles_collection.count_documents({"in_parking": True})
        return {
            "total_slots": total_slots,
            "occupied_slots": parked_count,
            "available_slots": total_slots - parked_count
        }
    except Exception as e:
        return JSONResponse({"error": f"Failed to get parking status: {str(e)}"}, status_code=500)

@app.get("/get_parked_vehicles")
async def get_parked_vehicles():
    try:
        cursor = vehicles_collection.find({"in_parking": True})
        vehicles = []
        
        for doc in cursor:
            vehicles.append({
                "id": str(doc["_id"]),
                "vehicle_type": doc.get("vehicle_type", ""),
                "license_plate": doc.get("license_plate", ""),
                "time_in": doc.get("time_in", datetime.utcnow()).isoformat(),
                "is_employee": doc.get("is_employee", False),
                "parking_slot": doc.get("parking_slot", None),
                "parking_state": doc.get("parking_state", "booked")  # 'booked' or 'parked'
            })
        
        return JSONResponse(content={"vehicles": vehicles})
        
    except Exception as e:
        logger.error(f"Error getting parked vehicles: {str(e)}")
        return JSONResponse({"error": f"Failed to get vehicles: {str(e)}"}, status_code=500)

@app.post("/detect_slots")
async def detect_slots(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        result = slot_service.detect_slots(contents)
        return JSONResponse(result)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/register_user")
async def register_user(user: User):
    return await db_service.register_user(user)

@app.post("/login")
async def login(login_data: UserLogin):
    try:
        logger.info(f"Login attempt for user: {login_data.name} with vehicle: {login_data.vehicle_plate}")
        result = await db_service.login_user(login_data)
        logger.info(f"Login result: {result}")
        
        if "error" in result:
            logger.warning(f"Login failed: {result['error']}")
            return JSONResponse(status_code=401, content=result)
        
        return JSONResponse(status_code=200, content=result)
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return JSONResponse(status_code=500, content={"error": f"Failed to process login request: {str(e)}"})

@app.get("/available_slots")
async def get_available_slots():
    try:
        slots = await db_service.get_available_slots()
        for slot in slots:
            if '_id' in slot:
                slot['_id'] = str(slot['_id'])
        return slots
    except Exception as e:
        logger.error(f"Error getting available slots: {str(e)}")
        return JSONResponse(status_code=500, content={"error": "Failed to get parking slots"})
    
@app.post("/book_slot/{slot_id}")
async def book_slot(slot_id: str, booking_data: dict = Body(...)):
    try:
        logger.info(f"Raw booking data: {booking_data}")
        
        if not isinstance(booking_data, dict) or 'vehicle_plate' not in booking_data:
            return JSONResponse(
                status_code=422,
                content={
                    "detail": [{
                        "loc": ["body", "vehicle_plate"],
                        "msg": "Vehicle plate is required",
                        "type": "value_error"
                    }]
                }
            )
        
        vehicle_plate = booking_data['vehicle_plate']
        logger.info(f"Processing booking for slot {slot_id} with vehicle {vehicle_plate}")
        
        result = await booking_service.book_slot(slot_id, vehicle_plate)
        logger.info(f"Booking result: {result}")
        
        if "error" in result:
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "message": "Booking failed",
                    "error": result["error"]
                }
            )
        
        return {
            "success": True,
            "message": result["message"],
            "data": result["data"]
        }
        
    except Exception as e:
        logger.error(f"Error in book_slot endpoint: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "Internal server error",
                "error": str(e)
            }
        )

@app.post("/park_vehicle/{vehicle_plate}")
async def park_vehicle(vehicle_plate: str):
    return await db_service.park_vehicle(vehicle_plate)

@app.post("/remove_parked_vehicle/{slot_id}")
async def remove_parked_vehicle(slot_id: str, vehicle_plate: str):
    return await db_service.remove_vehicle(slot_id, vehicle_plate)

@app.get("/parking-slots")
async def get_parking_slots():
    try:
        slots = list(parking_slots_collection.find({}, {'_id': 0}))
        return JSONResponse(content={"slots": slots})
    except Exception as e:
        logger.error(f"Error getting parking slots: {str(e)}")
        return JSONResponse(
            {"error": "Failed to get parking slots"}, 
            status_code=500
        )

@app.post("/book-slot/{slot_id}")
async def book_parking_slot(slot_id: str, plate_number: str = Body(...)):
    try:
        # Check if slot is available
        slot = parking_slots_collection.find_one({"slot_id": slot_id})
        if not slot or slot["status"] != "free":
            return JSONResponse(
                {"error": "Slot not available"}, 
                status_code=400
            )

        # Update slot status
        parking_slots_collection.update_one(
            {"slot_id": slot_id},
            {
                "$set": {
                    "status": "booked",
                    "plate_number": plate_number,
                    "booking_time": datetime.utcnow()
                }
            }
        )

        # Update vehicle status in vehicles collection
        vehicles_collection.update_one(
            {"license_plate": plate_number},
            {
                "$set": {
                    "parking_state": "booked",
                    "parking_slot": slot_id
                }
            }
        )

        return JSONResponse({"message": "Slot booked successfully"})
    except Exception as e:
        logger.error(f"Error booking slot: {str(e)}")
        return JSONResponse(
            {"error": "Failed to book slot"}, 
            status_code=500
        )

@app.post("/park-vehicle/{slot_id}")
async def mark_vehicle_parked(slot_id: str):
    try:
        # Find the booked slot
        slot = parking_slots_collection.find_one({"slot_id": slot_id})
        if not slot or slot["status"] != "booked":
            return JSONResponse(
                {"error": "Slot not booked"}, 
                status_code=400
            )

        # Update slot status
        parking_slots_collection.update_one(
            {"slot_id": slot_id},
            {
                "$set": {
                    "status": "parked",
                    "parking_time": datetime.utcnow()
                }
            }
        )

        # Update vehicle status
        vehicles_collection.update_one(
            {"license_plate": slot["plate_number"]},
            {
                "$set": {
                    "parking_state": "parked"
                }
            }
        )

        return JSONResponse({"message": "Vehicle marked as parked"})
    except Exception as e:
        logger.error(f"Error updating parking status: {str(e)}")
        return JSONResponse(
            {"error": "Failed to update parking status"}, 
            status_code=500
        )

@app.post("/remove-vehicle/{slot_id}")
async def remove_parked_vehicle(slot_id: str):
    try:
        slot = parking_slots_collection.find_one({"slot_id": slot_id})
        if not slot:
            return JSONResponse(
                {"error": "Slot not found"}, 
                status_code=404
            )

        # Reset slot status
        parking_slots_collection.update_one(
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

        # Update vehicle status if there was a vehicle
        if slot.get("plate_number"):
            vehicles_collection.update_one(
                {"license_plate": slot["plate_number"]},
                {
                    "$set": {
                        "parking_state": None,
                        "parking_slot": None,
                        "in_parking": False,
                        "time_out": datetime.utcnow()
                    }
                }
            )

        return JSONResponse({"message": "Slot cleared successfully"})
    except Exception as e:
        logger.error(f"Error removing vehicle: {str(e)}")
        return JSONResponse(
            {"error": "Failed to remove vehicle"}, 
            status_code=500
        )

@app.get("/slot-allocations")
async def get_slot_allocations():
    try:
        slots = list(db.slot_allocations.find({}, {'_id': 0}))
        return JSONResponse(content={"slots": slots})
    except Exception as e:
        logger.error(f"Error getting slot allocations: {str(e)}")
        return JSONResponse(
            {"error": "Failed to get slot allocations"}, 
            status_code=500
        )

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)