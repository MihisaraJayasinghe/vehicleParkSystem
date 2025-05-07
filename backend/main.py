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
import pytesseract

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

# --- Helper function to group detections into lines ---
def group_into_lines(detections):
    if not detections:
        return []
    sorted_dets = sorted(detections, key=lambda det: det['top'] if 'top' in det else min(point[1] for point in det[0]))
    lines = []
    current_line = []
    avg_height = sum(det['height'] if 'height' in det else max(point[1] for point in det[0]) - min(point[1] for point in det[0]) for det in sorted_dets) / len(sorted_dets)
    threshold = avg_height * 0.5
    for det in sorted_dets:
        if not current_line:
            current_line.append(det)
            continue
        prev_det = current_line[-1]
        prev_bottom = prev_det['top'] + prev_det['height'] if 'height' in prev_det else max(point[1] for point in prev_det[0])
        curr_top = det['top'] if 'top' in det else min(point[1] for point in det[0])
        if curr_top - prev_bottom < threshold:
            current_line.append(det)
        else:
            lines.append(current_line)
            current_line = [det]
    if current_line:
        lines.append(current_line)
    return lines

# --- ML OCR endpoint ---
@app.post("/predict_ocr")
async def predict_ocr(file: UploadFile = File(...)):
    """
    Detect vehicles & number-plates, OCR the plate, and auto-park if slot is booked.
    Return:
      {
        vehicle_types: [...],
        recognized_plates: [...],
        annotated_image: "base64png",
        suggested_slot: <slot_id> | null,
        auto_parked: bool,
        message: str | null
      }
    """
    try:
        # 1) Read & decode image
        img_bytes = await file.read()
        img = cv2.imdecode(np.frombuffer(img_bytes, np.uint8), cv2.IMREAD_COLOR)
        if img is None:
            raise HTTPException(400, "Bad image")

        # 2) Run YOLO
        det = model.predict(img, conf=0.45, verbose=False)[0]
        annotated = det.plot()

        vehicles, plates = [], []
        for box in det.boxes:
            cls_id = int(box.cls[0])
            label = class_names.get(cls_id, "unknown")
            x1, y1, x2, y2 = map(int, box.xyxy[0])

            if label == "number plate":
                crop = img[y1:y2, x1:x2]
                height, width = crop.shape[:2]
                resize_factor = max(2, 100 / min(height, width))
                crop = cv2.resize(crop, None, fx=resize_factor, fy=resize_factor, interpolation=cv2.INTER_CUBIC)
                gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
                blur = cv2.GaussianBlur(gray, (5, 5), 0)
                _, th = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

                ocr_easy = reader.readtext(th, detail=1)
                logger.info(f"EasyOCR detections: {len(ocr_easy)}")
                if ocr_easy:
                    lines = group_into_lines(ocr_easy)
                    logger.info(f"EasyOCR lines: {len(lines)}")
                    if lines:
                        main_line = sorted(lines[0], key=lambda det: min(point[0] for point in det[0]))
                        raw_easy = ''.join(det[1].replace(" ", "") for det in main_line)
                        conf_easy = sum(det[2] for det in main_line) / len(main_line)
                    else:
                        raw_easy, conf_easy = "", 0.0
                else:
                    raw_easy, conf_easy = "", 0.0

                custom_config = r'--oem 3 --psm 7'
                tess_data = pytesseract.image_to_data(th, config=custom_config, output_type=pytesseract.Output.DICT)
                selected_dets = [{'left': tess_data['left'][i], 'top': tess_data['top'][i], 'height': tess_data['height'][i], 'text': tess_data['text'][i], 'conf': tess_data['conf'][i]} 
                                 for i in range(len(tess_data['text'])) if tess_data['text'][i].strip()]
                logger.info(f"Tesseract detections: {len(selected_dets)}")
                if selected_dets:
                    lines = group_into_lines(selected_dets)
                    logger.info(f"Tesseract lines: {len(lines)}")
                    if lines:
                        main_line = sorted(lines[0], key=lambda det: det['left'])
                        raw_tess = ''.join(det['text'].replace(" ", "") for det in main_line)
                        confs = [det['conf'] for det in main_line if det['conf'] > 0]
                        conf_tess = sum(confs) / len(confs) / 100.0 if confs else 0.0
                    else:
                        raw_tess, conf_tess = "", 0.0
                else:
                    raw_tess, conf_tess = "", 0.0

                raw = raw_tess if (conf_tess > conf_easy or raw_easy == "") else raw_easy
                if not raw:
                    raw = pytesseract.image_to_string(th, config=custom_config).strip().replace(" ", "")

                plates.append(raw)
                cv2.putText(annotated, raw, (x1, max(y1-10, 0)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,255,255), 2)
            else:
                vehicles.append(label)
                cv2.putText(annotated, label, (x1, max(y1-10, 0)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,255,0), 2)

        # 3) Look up and auto-park if slot is booked
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
            "vehicle_types":     vehicles,
            "recognized_plates": plates,
            "annotated_image":   base64.b64encode(png).decode(),
            "suggested_slot":    suggested_slot,
            "auto_parked":       auto_parked,
            "message":           message
        }

    except Exception as e:
        logger.exception("/predict_ocr")
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