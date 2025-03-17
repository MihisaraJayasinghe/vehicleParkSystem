import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';

// Define slot capacities for each vehicle type
const vehicleCapacities = {
  bikes: { total: 40, occupied: 0 },
  cars: { total: 30, occupied: 0 },
  threeWheelers: { total: 10, occupied: 0 },
  vans: { total: 10, occupied: 0 },
  trucks: { total: 5, occupied: 0 },
  lorries: { total: 5, occupied: 0 },
};

// Define slot ranges for each vehicle type
const slotRanges = [
  { type: 'bikes', start: 1, end: 40 }, // Slots 1-40
  { type: 'cars', start: 41, end: 70 }, // Slots 41-70
  { type: 'threeWheelers', start: 71, end: 80 }, // Slots 71-80
  { type: 'vans', start: 81, end: 90 }, // Slots 81-90
  { type: 'trucks', start: 91, end: 95 }, // Slots 91-95
  { type: 'lorries', start: 96, end: 100 }, // Slots 96-100
];

// Create dummy slots with vehicle types
const createDummySlots = () => {
  const samplePlates = ['ABC123', 'XYZ789', 'DEF456'];
  
  return Array.from({ length: 100 }, (_, index) => {
    const slotId = index + 1;
    const range = slotRanges.find(r => slotId >= r.start && slotId <= r.end);
    
    return {
      slot_id: String(slotId),
      status: Math.random() > 0.7 ? 'booked' : 'free',
      plate_number: Math.random() > 0.7 ? samplePlates[index % 3] : null,
      vehicle_type: range.type,
      is_occupied: Math.random() > 0.7,
    };
  });
};

function SlotDetectionPage() {
  const [parkingStatus, setParkingStatus] = useState({
    total_slots: 100,
    occupied_slots: 0,
    available_slots: 0,
  });
  const [parkingSlots, setParkingSlots] = useState(createDummySlots());
  const [vehicleCapacitiesState, setVehicleCapacitiesState] = useState(vehicleCapacities);

  // Memoize fetchData to prevent redefinition on every render
  const fetchData = useCallback(async () => {
    try {
      // Fetch real data from API
      const [statusRes, slotsRes] = await Promise.all([
        fetch("http://127.0.0.1:8000/parking_status"),
        fetch("http://127.0.0.1:8000/parking-slots")
      ]);

      let statusData = { total_slots: 100, occupied_slots: 0, available_slots: 0 };
      let slotsData = { slots: parkingSlots }; // Default to current slots if fetch fails

      if (statusRes.ok && slotsRes.ok) {
        statusData = await statusRes.json();
        slotsData = await slotsRes.json();

        setParkingStatus(statusData);
        if (slotsData.slots && Array.isArray(slotsData.slots)) {
          setParkingSlots(slotsData.slots);
        }
      }

      // Update vehicle type occupancy based on slots
      const updatedCapacities = { ...vehicleCapacities };
      Object.keys(updatedCapacities).forEach(type => {
        updatedCapacities[type].occupied = (slotsData.slots || parkingSlots).filter(slot => 
          slot.vehicle_type?.toLowerCase() === type.toLowerCase() && (slot.is_occupied || slot.status === 'booked')
        ).length;
      });
      setVehicleCapacitiesState(updatedCapacities);

      // Update overall parking status
      const occupied = (slotsData.slots || parkingSlots).filter(slot => slot.is_occupied || slot.status === 'booked').length;
      setParkingStatus(prev => ({
        ...prev,
        occupied_slots: occupied,
        available_slots: prev.total_slots - occupied,
      }));
    } catch (error) {
      console.log("Using dummy data due to server error:", error);
      // Update capacities based on dummy data
      const updatedCapacities = { ...vehicleCapacities };
      Object.keys(updatedCapacities).forEach(type => {
        updatedCapacities[type].occupied = parkingSlots.filter(slot => 
          slot.vehicle_type.toLowerCase() === type.toLowerCase() && (slot.is_occupied || slot.status === 'booked')
        ).length;
      });
      setVehicleCapacitiesState(updatedCapacities);

      const occupied = parkingSlots.filter(slot => slot.is_occupied || slot.status === 'booked').length;
      setParkingStatus({
        total_slots: 100,
        occupied_slots: occupied,
        available_slots: 100 - occupied,
      });
    }
  }, [parkingSlots]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getSlotColor = (slot) => {
    if (slot.status === 'booked') return '#FFC107';
    if (slot.is_occupied) return '#F44336';
    return '#4CAF50';
  };

  const ParkingGrid = () => {
    // Sort slots by slot_id
    const sortedSlots = [...parkingSlots].sort((a, b) => Number(a.slot_id) - Number(b.slot_id));

    return (
      <div className="card shadow mt-4">
        <div className="card-header bg-primary text-white">
          <h5 className="mb-0">Parking Slots Overview</h5>
        </div>
        <div className="card-body">
          {Object.keys(vehicleCapacities).map((type, index) => {
            const slotsForType = sortedSlots.filter(slot => slot.vehicle_type === type);
            if (slotsForType.length === 0) return null;

            const range = slotRanges.find(r => r.type === type);
            return (
              <div key={type} className="mb-4">
                <h4 className="text-center text-primary">
                  {type.charAt(0).toUpperCase() + type.slice(1)}: Slots {range.start}-{range.end}
                </h4>
                <div className="d-flex flex-wrap justify-content-center" style={{ gap: '10px' }}>
                  {slotsForType.map((slot) => (
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
                        transition: 'transform 0.2s',
                        padding: '5px',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontWeight: 'bold', fontSize: '16px' }}>
                        Slot {slot.slot_id}
                      </div>
                      <div style={{ fontSize: '12px' }}>
                        {slot.status.toUpperCase()}
                      </div>
                      <div style={{ fontSize: '11px', marginTop: '4px' }}>
                        {slot.vehicle_type.charAt(0).toUpperCase() + slot.vehicle_type.slice(1)}
                      </div>
                      {slot.plate_number && (
                        <div style={{ fontSize: '11px', marginTop: '4px' }}>
                          {slot.plate_number}
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
            <div className="d-flex align-items-center">
              <div style={{ width: '20px', height: '20px', backgroundColor: '#4CAF50', marginRight: '8px', borderRadius: '4px' }}></div>
              <span>Free</span>
            </div>
            <div className="d-flex align-items-center">
              <div style={{ width: '20px', height: '20px', backgroundColor: '#FFC107', marginRight: '8px', borderRadius: '4px' }}></div>
              <span>Booked</span>
            </div>
            <div className="d-flex align-items-center">
              <div style={{ width: '20px', height: '20px', backgroundColor: '#F44336', marginRight: '8px', borderRadius: '4px' }}></div>
              <span>Occupied</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="container mt-4">
      <Link to="/" className="btn btn-secondary mb-4">Back to Landing</Link>
      
      <div className="text-center mb-5">
        <h2 className="display-4">Parking Slot Status</h2>
        <p className="lead text-muted">Current parking space availability</p>
      </div>

      {/* Overall Parking Status */}
      <div className="row mb-4">
        <div className="col-md-4">
          <div className="card text-center bg-light">
            <div className="card-body">
              <h3>{parkingStatus.total_slots}</h3>
              <p>Total Slots</p>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card text-center bg-success text-white">
            <div className="card-body">
              <h3>{parkingStatus.available_slots}</h3>
              <p>Available Slots</p>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card text-center bg-danger text-white">
            <div className="card-body">
              <h3>{parkingStatus.occupied_slots}</h3>
              <p>Occupied Slots</p>
            </div>
          </div>
        </div>
      </div>

      {/* Vehicle Type Capacity Summary */}
      <div className="mb-4">
        <h4>Parking Capacity by Vehicle Type</h4>
        <div className="row">
          {Object.entries(vehicleCapacitiesState).map(([type, { total, occupied }]) => (
            <div key={type} className="col-md-4 mb-3">
              <div className="card">
                <div className="card-body">
                  <h5 className="card-title">{type.charAt(0).toUpperCase() + type.slice(1)}</h5>
                  <p className="card-text">
                    Total Slots: {total}<br />
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

// Add these styles to your CSS
const styles = `
  .parking-slot:hover {
    transform: translateY(-2px);
    transition: all 0.2s ease-in-out;
  }
  
  .parking-slot.free:hover {
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
  }

  .card {
    border: 1px solid #ddd;
    border-radius: 5px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .card-body {
    padding: 15px;
  }

  .card-title {
    font-size: 1.1rem;
    margin-bottom: 10px;
  }

  .card-text {
    font-size: 0.9rem;
    color: #333;
  }
`;

// Add styles to document
const styleSheet = document.createElement("style");
styleSheet.innerText = styles;
document.head.appendChild(styleSheet);

export default SlotDetectionPage;