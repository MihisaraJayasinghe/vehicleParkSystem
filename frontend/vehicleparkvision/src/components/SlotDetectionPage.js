import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaParking } from 'react-icons/fa';

// Create dummy data for parking slots
const createDummySlots = () => {
  const samplePlates = ['ABC123', 'XYZ789', 'DEF456'];
  const sampleTypes = ['regular', 'reserved', 'handicap'];
  
  return Array.from({ length: 100 }, (_, index) => ({
    slot_id: String(index + 1),
    status: Math.random() > 0.7 ? 'booked' : 'free',
    plate_number: Math.random() > 0.7 ? samplePlates[index % 3] : null,
    allocation_type: sampleTypes[index % 3],
    is_occupied: Math.random() > 0.7
  }));
};

function SlotDetectionPage() {
  const [parkingStatus, setParkingStatus] = useState({
    total_slots: 100,
    occupied_slots: 30,
    available_slots: 70
  });
  const [parkingSlots, setParkingSlots] = useState(createDummySlots());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Try to fetch real data
      const [statusRes, slotsRes] = await Promise.all([
        fetch("http://127.0.0.1:8000/parking_status"),
        fetch("http://127.0.0.1:8000/parking-slots")
      ]);

      if (statusRes.ok && slotsRes.ok) {
        const statusData = await statusRes.json();
        const slotsData = await slotsRes.json();
        
        setParkingStatus(statusData);
        if (slotsData.slots && Array.isArray(slotsData.slots)) {
          setParkingSlots(slotsData.slots);
        }
      }
    } catch (error) {
      console.log("Using dummy data due to server error:", error);
      // Keep using dummy data if fetch fails
    }
  };

  const getSlotColor = (slot) => {
    if (slot.status === 'booked') return '#FFC107';
    if (slot.is_occupied) return '#F44336';
    return '#4CAF50';
  };

  const ParkingGrid = () => (
    <div className="card shadow mt-4">
      <div className="card-header bg-primary text-white">
        <h5 className="mb-0">Parking Slots Overview</h5>
      </div>
      <div className="card-body">
        <div className="d-flex flex-wrap justify-content-center" style={{ gap: '10px' }}>
          {parkingSlots.map((slot) => (
            <div
              key={slot.slot_id}
              className="parking-slot"
              style={{
                width: '100px',
                height: '100px',
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
                padding: '5px'
              }}
            >
              <div style={{ fontWeight: 'bold', fontSize: '16px' }}>
                Slot {slot.slot_id}
              </div>
              <div style={{ fontSize: '12px' }}>
                {slot.status.toUpperCase()}
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

  return (
    <div className="container mt-4">
      <Link to="/" className="btn btn-secondary mb-4">Back to Landing</Link>
      
      <div className="text-center mb-5">
        <h2 className="display-4">Parking Slot Status</h2>
        <p className="lead text-muted">Current parking space availability</p>
      </div>

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
`;

// Add styles to document
const styleSheet = document.createElement("style");
styleSheet.innerText = styles;
document.head.appendChild(styleSheet);

export default SlotDetectionPage;
