from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class VehicleEntry(BaseModel):
    vehicle_type: str
    license_plate: str
    is_employee: bool = False
    time_in: datetime
    time_out: Optional[datetime] = None
    parking_fee: Optional[float] = 0.0
    in_parking: bool = True

class VehicleRemoval(BaseModel):
    license_plate: str
