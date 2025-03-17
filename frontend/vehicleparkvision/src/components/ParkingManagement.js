import React, { useState, useEffect } from 'react';
import { Table, Button, Form, Alert } from 'react-bootstrap';
import Swal from 'sweetalert2';

function ParkingManagement() {
  const [vehicles, setVehicles] = useState([]);
  const [searchPlate, setSearchPlate] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('http://127.0.0.1:8000/get_parked_vehicles');
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to fetch vehicles');
      }
      
      const data = await res.json();
      setVehicles(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching vehicles:', err);
    } finally {
      setLoading(false);
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

  const handleAddVehicle = async (vehicleData) => {
    try {
      const response = await fetch('http://127.0.0.1:8000/add_vehicle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(vehicleData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add vehicle');
      }

      await fetchVehicles(); // Refresh the list
      return true;
    } catch (err) {
      console.error('Error adding vehicle:', err);
      Swal.fire('Error', err.message, 'error');
      return false;
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <Alert variant="danger">{error}</Alert>;

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
              <th>Employee</th>
              <th>Time In</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {vehicles
              .filter(v => v.license_plate.includes(searchPlate))
              .map(vehicle => (
                <tr key={vehicle._id}>
                  <td>{vehicle.license_plate}</td>
                  <td>{vehicle.vehicle_type}</td>
                  <td>{vehicle.is_employee ? 'Yes' : 'No'}</td>
                  <td>{new Date(vehicle.time_in).toLocaleString()}</td>
                  <td>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleRemoveVehicle(vehicle.license_plate)}
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

export default ParkingManagement;