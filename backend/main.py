# main.py

import logging
import base64
import cv2
import numpy as np
from datetime import datetime

from fastapi import FastAPI, File, UploadFile, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel

import uvicorn
from ultralytics import YOLO
import easyocr

# ---------- local modules ----------
from app.slot_service import SlotDetectionService
from parking_slot_crud import (
    init_slots,
    book_slot,
    park_slot,
    get_all_slots,
    clear_slot,
    slots as slots_collection
)
from employee_vehicle_model import init_employee_table, get_all_employee_plates
from user_auth_mongo import register_user, login_user
# -----------------------------------

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
slot_service = SlotDetectionService(model_path="parking.pt")

# --- Initialize DB on startup ---
init_employee_table()
init_slots(count=100)

# --- Pydantic schemas ---
class UserAuth(BaseModel):
    username: str
    vehicle_plate: str

class SlotAction(BaseModel):
    slot_id: int
    vehicle_plate: str

class ClearAction(BaseModel):
    slot_id: int
    rate_per_hour: float = 10.0

# --- Auth endpoints ---
@app.post("/register")
def api_register(u: UserAuth):
    try:
        doc = register_user(u.username, u.vehicle_plate)
        return {"success": True, "user": {"username": doc["username"], "vehicle_plate": doc["vehicle_plate"]}}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/login")
def api_login(u: UserAuth):
    try:
        doc = login_user(u.username, u.vehicle_plate)
        return {"success": True, "user": {"username": doc["username"], "vehicle_plate": doc["vehicle_plate"]}}
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))

# --- Slot-init endpoint ---
@app.post("/slots/init")
def api_init_slots(count: int = Query(100, ge=1, le=1000)):
    init_slots(count)
    return {"message": f"Initialized {count} slots"}

# --- Slot CRUD endpoints ---
@app.post("/slots/book")
def api_book_slot(action: SlotAction):
    try:
        updated = book_slot(action.slot_id, action.vehicle_plate)
        updated.pop("_id", None)  # remove MongoDB internal ID
        return JSONResponse(jsonable_encoder(updated))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/slots/park")
def api_park_slot(action: SlotAction):
    try:
        updated = park_slot(action.slot_id, action.vehicle_plate)
        updated.pop("_id", None)
        return JSONResponse(jsonable_encoder(updated))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/slots")
def api_list_slots():
    slots = get_all_slots()
    return JSONResponse(jsonable_encoder(slots))

@app.post("/slots/clear")
def api_clear_slot(action: ClearAction):
    try:
        info = clear_slot(action.slot_id, action.rate_per_hour)
        return JSONResponse(jsonable_encoder(info))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/slots/parked-employees")
def api_parked_employees():
    plates = get_all_employee_plates()
    docs = list(slots_collection.find(
        {"status": "parked", "parked_vehicle_plate": {"$in": plates}},
        {"_id": 0}
    ))
    return JSONResponse(jsonable_encoder(docs))

# --- ML OCR endpoint ---
@app.post("/predict_ocr")
async def predict_ocr(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        img = cv2.imdecode(np.frombuffer(contents, np.uint8), cv2.IMREAD_COLOR)
        if img is None:
            raise HTTPException(status_code=400, detail="Invalid image")

        det = model.predict(img, conf=0.5)[0]
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
                    text = " ".join([o[1] for o in ocr])
                    plates.append(text)
                    cv2.putText(annotated, text, (x1, max(y1-10,0)),
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

# --- ML slot-detection endpoint ---
@app.post("/detect_slots")
async def detect_slots(file: UploadFile = File(...)):
    try:
        data = await file.read()
        return slot_service.detect_slots(data)
    except Exception as e:
        logger.error(f"/detect_slots error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- Run the app ---
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)