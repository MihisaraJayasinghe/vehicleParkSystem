from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class User(BaseModel):
    name: str
    vehicle_plate: str
    vehicle_type: str

class UserLogin(BaseModel):
    name: str
    vehicle_plate: str

class ParkingSlot(BaseModel):
    slot_id: str
    status: str = "available"  # "available", "booked", "parked"
    vehicle_plate: Optional[str] = None
    vehicle_type: Optional[str] = None
    time_in: Optional[datetime] = None
    time_out: Optional[datetime] = None
    booking_time: Optional[datetime] = None
    booked_by: Optional[str] = None
    fee: float = 0.0

class ParkingSlotStatus(BaseModel):
    slot_id: str
    status: str = "free"  # "free", "booked", "parked"
    plate_number: Optional[str] = None
    booking_time: Optional[datetime] = None
    parking_time: Optional[datetime] = None

class SlotUpdateRequest(BaseModel):
    plate_number: str
    status: str

class Employee(BaseModel):
    name: str
    employee_id: str
    vehicle_plate: Optional[str] = None

class SlotAllocation(BaseModel):
    slot_id: str
    vehicle_plate: Optional[str] = None
    allocation_type: str = "regular"  # regular, reserved, handicap, etc.
    is_occupied: bool = False
    occupied_since: Optional[datetime] = None
    last_updated: datetime = datetime.utcnow()
