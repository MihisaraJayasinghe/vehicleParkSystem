import React, { useState, useEffect } from 'react';
import { Table, Button, Form } from 'react-bootstrap';
import Swal from 'sweetalert2';

function ParkManagement() {
  const [vehicles, setVehicles] = useState([]);
  const [searchPlate, setSearchPlate] = useState('');

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/get_parked_vehicles');
      const data = await res.json();
      setVehicles(data);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
    }
  };

  const handleRemoveVehicle = async (licensePlate) => {
    const result = await Swal.fire({
      title: 'Remove Vehicle?',
      text: `Are you sure you want to remove vehicle ${licensePlate}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, remove it!'
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch('http://127.0.0.1:8000/remove_vehicle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ license_plate: licensePlate })
        });
        
        const data = await res.json();
        if (data.fee !== undefined) {
          await Swal.fire(
            'Vehicle Removed',
            `Parking fee: $${data.fee}`,
            'success'
          );
          fetchVehicles();
        }
      } catch (error) {
        Swal.fire('Error', 'Failed to remove vehicle', 'error');
      }
    }
  };

  return (
    <div className="container mt-4">
      <h2>Parking Management</h2>
      
      <Form className="mb-4">
        <Form.Group>
          <Form.Control
            type="text"
            placeholder="Search by license plate"
            value={searchPlate}
            onChange={(e) => setSearchPlate(e.target.value)}
          />
        </Form.Group>
      </Form>
 
      <div className="table-responsive">
        <Table striped bordered hover>
          <thead>
            <tr>
              <th>License Plate</th>
              <th>Vehicle Type</th>
              <th>Parking Status</th>
              <th>Parking Slot</th>
              <th>Time In</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {Array.isArray(vehicles) && vehicles
              .filter(v => v.license_plate?.toString().includes(searchPlate))
              .map(vehicle => (
                <tr key={vehicle.license_plate}>
                  <td>{vehicle.license_plate}</td>
                  <td>{vehicle.vehicle_type}</td>
                  <td>
                    <span className={`badge bg-${vehicle.parking_state === 'parked' ? 'success' : 'warning'}`}>
                      {vehicle.parking_state || 'Booked'}
                    </span>
                  </td>
                  <td>{vehicle.parking_slot || 'Not assigned'}</td>
                  <td>{new Date(vehicle.time_in).toLocaleString()}</td>
                  <td>
                    <Button
                      variant="danger"
                      onClick={() => handleRemoveVehicle(vehicle.license_plate)}
                      disabled={vehicle.parking_state === 'booked'}
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );
}

export default ParkManagement;