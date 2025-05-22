import logging
import base64
import cv2
import numpy as np
from datetime import datetime
import torch
from torch.autograd import Variable
from PIL import Image
import torchvision.transforms as transforms
import pytesseract
import re
import tempfile  # added for handling temporary files

from fastapi import FastAPI, File, UploadFile, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel

import uvicorn
from ultralytics import YOLO

from model import Model

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

# Logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# FastAPI setup
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load ML models
logger.info("Loading YOLO model…")
model = YOLO("best5.pt")

class_names = {
    0: 'Lorry', 1: 'bike', 2: 'bus', 3: 'car',
    4: 'number plate', 5: 'three wheeler',
    6: 'three wheeler', 7: 'van'
}
slot_service = SlotDetectionService(model_path="parking.pt")

# Initialize DB on startup
init_employee_table()
init_slots(count=100)

# Pydantic schemas
class UserAuth(BaseModel):
    username: str
    vehicle_plate: str

class SlotAction(BaseModel):
    slot_id: int
    vehicle_plate: str

class ClearAction(BaseModel):
    slot_id: int
    rate_per_hour: float = 10.0

# Auth endpoints
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

# Slot-init endpoint
@app.post("/slots/init")
def api_init_slots(count: int = Query(100, ge=1, le=1000)):
    init_slots(count)
    return {"message": f"Initialized {count} slots"}

# Slot CRUD endpoints
@app.post("/slots/book")
def api_book_slot(action: SlotAction):
    try:
        updated = book_slot(action.slot_id, action.vehicle_plate)
        updated.pop("_id", None)
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

# ML OCR endpoint
@app.post("/predict_ocr")
async def predict_ocr(file: UploadFile = File(...)):
    """
    Detect vehicles & number-plates. If a video file is uploaded, capture a screenshot
    and process it for OCR. Then, auto-park if slot is booked.
    """
    try:
        # 1) Determine if the file is an image or video
        if file.content_type.startswith("video"):
            # Save uploaded video to a temporary file
            with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as temp_video:
                temp_video.write(await file.read())
                temp_video_path = temp_video.name
            # Use OpenCV to capture the first frame
            cap = cv2.VideoCapture(temp_video_path)
            ret, frame = cap.read()
            cap.release()
            if not ret:
                raise HTTPException(400, "Could not extract frame from video")
            img = frame  # Use extracted frame as the image for subsequent processing
        else:
            # Process as image file
            img_bytes = await file.read()
            img = cv2.imdecode(np.frombuffer(img_bytes, np.uint8), cv2.IMREAD_COLOR)
            if img is None:
                raise HTTPException(400, "Bad image")

        # 2) Run YOLO with higher confidence
        det = model.predict(img, conf=0.65, verbose=False)[0]
        annotated = det.plot()
        vehicles, plates = [], []
        for box in det.boxes:
            cls_id = int(box.cls[0])
            label = class_names.get(cls_id, "unknown")
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            if label == "number plate":
                crop = img[y1:y2, x1:x2]
                # Enhanced preprocessing for OCR
                gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
                resized = cv2.resize(gray, None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC)
                blur = cv2.bilateralFilter(resized, 11, 30, 30)
                _, thresh = cv2.threshold(blur, 0, 255,
                                          cv2.THRESH_BINARY + cv2.THRESH_OTSU)
                kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3,3))
                morphed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
                crop_pil = Image.fromarray(morphed)
                plate_text = pytesseract.image_to_string(
                    crop_pil,
                    config='--psm 8 --oem 1 -c tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
                ).strip()
                if not plate_text:
                    plate_text = pytesseract.image_to_string(
                        crop_pil,
                        config='--psm 7 --oem 1 -c tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
                    ).strip()
                plate_text = re.sub(r'[^A-Z0-9]', '', plate_text)
                plates.append(plate_text)
                cv2.putText(annotated, plate_text, (x1, max(y1-10, 0)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,255,255), 2)
            else:
                vehicles.append(label)
                cv2.putText(annotated, label, (x1, max(y1-10, 0)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,255,0), 2)

        # 3) Auto-park if booked
        suggested_slot = None
        auto_parked = False
        message = None
        if plates:
            plate0 = plates[0]
            slot_doc = slots_collection.find_one(
                {"parked_vehicle_plate": plate0, "status": "booked"},
                {"slot_id": 1, "_id": 0}
            )
            if slot_doc:
                suggested_slot = slot_doc["slot_id"]
                try:
                    updated = park_slot(suggested_slot, plate0)
                    auto_parked = True
                    message = f"Vehicle successfully added to database in slot {suggested_slot}"
                except ValueError as e:
                    logger.error(f"Failed to park slot: {e}")
                    message = str(e)

        # 4) Encode annotated image
        ok, png = cv2.imencode(".png", annotated)
        if not ok:
            raise RuntimeError("encode-fail")

        return {
            "vehicle_types": vehicles if vehicles else [],
            "recognized_plates": plates if plates else [],
            "annotated_image": base64.b64encode(png).decode() if png is not None else None,
            "suggested_slot": suggested_slot,
            "auto_parked": auto_parked,
            "message": message
        }

    except Exception as e:
        logger.exception("/predict_ocr")
        raise HTTPException(status_code=500, detail=str(e))

# ML slot-detection endpoint
@app.post("/detect_slots")
async def detect_slots(file: UploadFile = File(...)):
    try:
        data = await file.read()
        return slot_service.detect_slots(data)
    except Exception as e:
        logger.error(f"/detect_slots error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Run the app
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)