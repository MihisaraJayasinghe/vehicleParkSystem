import React, { useState, useEffect } from 'react';
import { Table, Form, Spinner, Badge } from 'react-bootstrap';
import Swal from 'sweetalert2';

function ParkManagement() {
  const [slots, setSlots] = useState([]);
  const [searchPlate, setSearchPlate] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSlots();
  }, []);

  const fetchSlots = async () => {
    setIsLoading(true);
    try {
      // GET /slots returns an array directly—not under key "vehicles"
      const res = await fetch('http://127.0.0.1:8000/slots');
      const data = await res.json();
      // Filter for only parked slots (adjust condition if you want to include booked as well)
      const parkedSlots = data.filter(slot => slot.status === 'parked');
      setSlots(parkedSlots);
    } catch (error) {
      console.error('Error fetching slots:', error);
      Swal.fire('Error', 'Failed to fetch parked vehicles', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Case-insensitive search on parked_vehicle_plate
  const filteredSlots = slots.filter(slot =>
    slot.parked_vehicle_plate?.toString().toLowerCase().includes(searchPlate.toLowerCase())
  );

  return (
    <div className="container mt-4">
      <h2>Parked Vehicles</h2>

      <Form className="mb-4">
        <Form.Control
          type="text"
          placeholder="Search by license plate"
          value={searchPlate}
          onChange={(e) => setSearchPlate(e.target.value)}
        />
      </Form>

      {isLoading ? (
        <div className="text-center">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
        </div>
      ) : (
        <div className="table-responsive">
          <Table striped bordered hover>
            <thead>
              <tr>
                <th>Slot ID</th>
                <th>Status</th>
                <th>Vehicle Plate</th>
                <th>Time In</th>
              </tr>
            </thead>
            <tbody>
              {filteredSlots.length ? (
                filteredSlots.map(slot => (
                  <tr key={slot.slot_id}>
                    <td>{slot.slot_id}</td>
                    <td>
                      <Badge bg="success">
                        {slot.status.toUpperCase()}
                      </Badge>
                    </td>
                    <td>{slot.parked_vehicle_plate || 'N/A'}</td>
                    <td>
                      {slot.parked_time ? new Date(slot.parked_time).toLocaleString() : 'N/A'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="text-center">
                    No parked vehicles found.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  );
}

export default ParkManagement;