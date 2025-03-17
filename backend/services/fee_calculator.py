from datetime import datetime

class ParkingFeeCalculator:
    def __init__(self):
        self.hourly_rate = 2.50  # $2.50 per hour
        self.employee_rate = 0.0  # Free for employees

    def calculate_fee(self, time_in: datetime, is_employee: bool) -> float:
        if is_employee:
            return 0.0
            
        duration = datetime.utcnow() - time_in
        hours = duration.total_seconds() / 3600
        return round(hours * self.hourly_rate, 2)
