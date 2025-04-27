import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import './ModernStyles.css';

// Define slot ranges for each vehicle type
const slotRanges = [
  { type: 'bikes', start: 1, end: 40 },
  { type: 'cars', start: 41, end: 70 },
  { type: 'threeWheelers', start: 71, end: 80 },
  { type: 'vans', start: 81, end: 90 },
  { type: 'trucks', start: 91, end: 95 },
  { type: 'lorries', start: 96, end: 100 },
];

// Initial capacities (total per type)
const vehicleCapacities = {
  bikes:    { total: 40, occupied: 0 },
  cars:     { total: 30, occupied: 0 },
  threeWheelers: { total: 10, occupied: 0 },
  vans:     { total: 10, occupied: 0 },
  trucks:   { total: 5, occupied: 0 },
  lorries:  { total: 5, occupied: 0 },
};

export default function SlotDetectionPage() {
  const [parkingStatus, setParkingStatus] = useState({
    total_slots: 0,
    occupied_slots: 0,
    available_slots: 0,
  });
  const [parkingSlots, setParkingSlots] = useState([]);
  const [vehicleCapacitiesState, setVehicleCapacitiesState] = useState(vehicleCapacities);

  // Fetch slots from backend
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/slots");
      if (!res.ok) throw new Error("Failed to fetch slots");
      const slots = await res.json();             // array of { slot_id, status, parked_vehicle_plate, parked_time }
      setParkingSlots(slots);

      // Overall counts
      const total = slots.length;
      const occupied = slots.filter(s => s.status !== 'free').length;
      setParkingStatus({
        total_slots: total,
        occupied_slots: occupied,
        available_slots: total - occupied
      });

      // Per-type occupancy
      const caps = { ...vehicleCapacities };
      Object.keys(caps).forEach(type => {
        caps[type].occupied = slots.filter(s => {
          const id = Number(s.slot_id);
          const range = slotRanges.find(r => r.type === type);
          return range && id >= range.start && id <= range.end && s.status !== 'free';
        }).length;
      });
      setVehicleCapacitiesState(caps);

    } catch (e) {
      console.error("Error loading slots:", e);
      // Optionally keep previous state or show error message
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getSlotColor = (slot) => {
    if (slot.status === 'booked')   return '#FFC107';  // yellow
    if (slot.status === 'parked')   return '#F44336';  // red
    return '#4CAF50';                                    // green
  };

  const ParkingGrid = () => {
    const sorted = [...parkingSlots].sort((a,b) => Number(a.slot_id) - Number(b.slot_id));
    return (
      <div className="card shadow mt-4">
        <div className="card-header bg-primary text-white">
          <h5 className="mb-0">Parking Slots Overview</h5>
        </div>
        <div className="card-body">
          {slotRanges.map(({type, start, end}) => {
            const slotsForType = sorted.filter(s => {
              const id = Number(s.slot_id);
              return id >= start && id <= end;
            });
            return (
              <div key={type} className="mb-4">
                <h4 className="text-center text-primary">
                  {type.charAt(0).toUpperCase() + type.slice(1)}: Slots {start}-{end}
                </h4>
                <div className="d-flex flex-wrap justify-content-center" style={{ gap: '10px' }}>
                  {slotsForType.map(slot => (
                    <div
                      key={slot.slot_id}
                      className="parking-slot"
                      style={{
                        width: '100px',
                        height: '120px',
                        backgroundColor: getSlotColor(slot),
                        borderRadius: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        color: 'white',
                        cursor: 'pointer',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        padding: '5px',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontWeight: 'bold', fontSize: '16px' }}>
                        {slot.slot_id}
                      </div>
                      <div style={{ fontSize: '12px' }}>
                        {slot.status.toUpperCase()}
                      </div>
                      {slot.parked_vehicle_plate && (
                        <div style={{ fontSize: '11px', marginTop: '4px' }}>
                          {slot.parked_vehicle_plate}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="card-footer">
          <div className="d-flex justify-content-center gap-3">
            <Legend color="#4CAF50" label="Free" />
            <Legend color="#FFC107" label="Booked" />
            <Legend color="#F44336" label="Parked" />
          </div>
        </div>
      </div>
    );
  };

  const Legend = ({ color, label }) => (
    <div className="d-flex align-items-center">
      <div style={{
        width: '20px', height: '20px',
        backgroundColor: color,
        marginRight: '8px',
        borderRadius: '4px'
      }} />
      <span>{label}</span>
    </div>
  );

  return (
    <div className="container mt-4">
      <Link to="/" className="btn btn-secondary mb-4">Back to Landing</Link>
      
      <div className="text-center mb-5">
        <h2 className="display-4">Parking Slot Status</h2>
        <p className="lead text-muted">Current parking space availability</p>
      </div>

      {/* Overall Parking Status */}
      <div className="row mb-4">
        <StatCard title="Total Slots"   value={parkingStatus.total_slots}  bg="bg-light" text="text-dark" />
        <StatCard title="Available"     value={parkingStatus.available_slots} bg="bg-success" text="text-white" />
        <StatCard title="Occupied"      value={parkingStatus.occupied_slots}  bg="bg-danger"  text="text-white" />
      </div>

      {/* Vehicle Type Capacity Summary */}
      <div className="mb-4">
        <h4>Capacity by Vehicle Type</h4>
        <div className="row">
          {Object.entries(vehicleCapacitiesState).map(([type, { total, occupied }]) => (
            <div key={type} className="col-md-4 mb-3">
              <div className="card">
                <div className="card-body">
                  <h5 className="card-title">{type.charAt(0).toUpperCase() + type.slice(1)}</h5>
                  <p className="card-text">
                    Total: {total}<br />
                    Occupied: {occupied}<br />
                    Available: {total - occupied}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <ParkingGrid />
    </div>
  );
}

// small stat card
const StatCard = ({ title, value, bg, text }) => (
  <div className="col-md-4">
    <div className={`card text-center ${bg} ${text}`}>
      <div className="card-body">
        <h3>{value}</h3>
        <p>{title}</p>
      </div>
    </div>
  </div>
);