# main.py

import logging
import base64
import cv2
import numpy as np
from datetime import datetime

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

import uvicorn
from ultralytics import YOLO
import easyocr

# ML service
from app.slot_service import SlotDetectionService

# Mongo-backed parking slot CRUD
from parking_slot_crud import (
    init_slots,
    book_slot,
    park_slot,
    get_all_slots,
    clear_slot,
    slots as slots_collection
)

# Mongo-backed employee plates
from employee_vehicle_model import init_employee_table, get_all_employee_plates

# Mongo-backed auth
from user_auth_mongo import register_user, login_user

# --- Logging setup ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- FastAPI setup ---
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Load ML models ---
logger.info("Loading YOLO model…")
model = YOLO("best5.pt")

logger.info("Starting EasyOCR reader…")
reader = easyocr.Reader(['en'], gpu=False)

class_names = {
    0: 'Lorry', 1: 'bike', 2: 'bus', 3: 'car',
    4: 'number plate', 5: 'three wheeler',
    6: 'three wheeler', 7: 'van'
}

# --- Initialize DB on startup ---
init_employee_table()
init_slots(count=100)

# --- Auth request schema ---
class UserAuth(BaseModel):
    username: str
    vehicle_plate: str

# --- 0) Register new user ---
@app.post("/register")
def api_register(user: UserAuth):
    try:
        doc = register_user(user.username, user.vehicle_plate)
        return {
            "success": True,
            "user": {
                "username": doc["username"],
                "vehicle_plate": doc["vehicle_plate"],
               
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
# --- 00) Login existing user ---
@app.post("/login")
def api_login(user: UserAuth):
    try:
        doc = login_user(user.username, user.vehicle_plate)
        return {
            "success": True,
            "user": {
                "username": doc["username"],
                "vehicle_plate": doc["vehicle_plate"],
               
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))

# --- ML OCR endpoint ---
@app.post("/predict_ocr")
async def predict_ocr(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        img = cv2.imdecode(np.frombuffer(contents, np.uint8), cv2.IMREAD_COLOR)
        if img is None:
            raise HTTPException(400, "Invalid image")

        det = model.predict(source=img, conf=0.5)[0]
        annotated = det.plot()

        vehicles, plates = [], []
        for box in det.boxes:
            cls_id = int(box.cls[0])
            name = class_names.get(cls_id, "unknown")
            x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())

            if name == "number plate":
                crop = img[y1:y2, x1:x2]
                crop = cv2.resize(crop, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
                gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
                blur = cv2.bilateralFilter(gray, 11, 17, 17)
                _, thresh = cv2.threshold(blur, 100, 255, cv2.THRESH_BINARY)
                if cv2.mean(thresh)[0] < 127:
                    thresh = cv2.bitwise_not(thresh)
                proc = cv2.cvtColor(thresh, cv2.COLOR_GRAY2RGB)
                ocr = reader.readtext(proc)
                if ocr:
                    txt = " ".join([o[1] for o in ocr])
                    plates.append(txt)
                    cv2.putText(annotated, txt, (x1, max(y1-10,0)),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,255,255), 2)
            else:
                vehicles.append(name)
                cv2.putText(annotated, name, (x1, max(y1-10,0)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,255,0), 2)

        ok, png = cv2.imencode(".png", annotated)
        if not ok:
            raise RuntimeError("Failed to encode image")
        b64 = base64.b64encode(png.tobytes()).decode()

        return {"vehicle_types": vehicles, "recognized_plates": plates, "annotated_image": b64}
    except Exception as e:
        logger.error(f"/predict_ocr error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- ML slot detection ---
slot_service = SlotDetectionService(model_path="parking.pt")

@app.post("/detect_slots")
async def detect_slots(file: UploadFile = File(...)):
    try:
        data = await file.read()
        return slot_service.detect_slots(data)
    except Exception as e:
        logger.error(f"/detect_slots error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- SlotAction & ClearAction schemas ---
class SlotAction(BaseModel):
    slot_id: int
    vehicle_plate: str

class ClearAction(BaseModel):
    slot_id: int
    rate_per_hour: float = 10.0

# --- 1) Book a slot ---
@app.post("/slots/book")
def api_book_slot(req: SlotAction):
    try:
        updated = book_slot(req.slot_id, req.vehicle_plate)
        return JSONResponse(updated)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# --- 2) Park a booked slot ---
@app.post("/slots/park")
def api_park_slot(req: SlotAction):
    try:
        updated = park_slot(req.slot_id, req.vehicle_plate)
        # return datetime as ISO
        updated["parked_time"] = updated["parked_time"].isoformat()
        return JSONResponse(updated)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# --- 3) List all slots ---
@app.get("/slots")
def api_list_slots():
    all_slots = get_all_slots()
    # convert any datetime fields
    for s in all_slots:
        if s.get("parked_time"):
            s["parked_time"] = s["parked_time"].isoformat()
    return JSONResponse(all_slots)

# --- 4) Clear slot & compute fee ---
@app.post("/slots/clear")
def api_clear_slot(req: ClearAction):
    try:
        info = clear_slot(req.slot_id, req.rate_per_hour)
        # info contains datetime fields
        info["parked_time"] = info["parked_time"].isoformat()
        info["cleared_time"] = info["cleared_time"].isoformat()
        return JSONResponse(info)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# --- 5) Parked employee slots ---
@app.get("/slots/parked-employees")
def api_parked_employees():
    plates = get_all_employee_plates()
    docs = slots_collection.find(
        {"status": "parked", "parked_vehicle_plate": {"$in": plates}},
        {"_id": 0}
    )
    result = list(docs)
    for s in result:
        if s.get("parked_time"):
            s["parked_time"] = s["parked_time"].isoformat()
    return JSONResponse(result)

# --- Run the app ---
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)