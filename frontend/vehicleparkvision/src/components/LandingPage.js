import React from 'react';
import { Link } from 'react-router-dom';
import { FaCar, FaParking, FaTasks } from 'react-icons/fa';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../LandingPage.css';

function LandingPage() {
  return (
    <div className="landing-page container-fluid p-0" style={{   minHeight: '100vh' }}>
      <div className="text-center py-5">
        <h1 className="h1">ParkVision</h1>
        <p className="h2">Advanced Parking Management System</p>
      </div>
      <div className="container">
        <div className="row">
          <div className="col-md-4 mb-4 d-flex justify-content-center">
            <Link to="/vehicle-detection" className="text-decoration-none w-100">
              <div className="card landing-card shadow-lg">
                <div className="card-body text-center">
                  <FaCar className="landing-icon" />
                  <h5 className="card-title mt-3">Real Time Vehicle & License Plate Detection</h5>
                  <p className="card-text">Instantly detect vehicles and plates.</p>
                </div>
              </div>
            </Link>
          </div>
          <div className="col-md-4 mb-4 d-flex justify-content-center">
            <Link to="/slot-detection" className="text-decoration-none w-100">
              <div className="card landing-card shadow-lg">
                <div className="card-body text-center">
                  <FaParking className="landing-icon" />
                  <h5 className="card-title mt-3">Vehicle Slot Detection</h5>
                  <p className="card-text">Quickly locate available slots.</p>
                </div>
              </div>
            </Link>
          </div>
          <div className="col-md-4 mb-4 d-flex justify-content-center">
            <Link to="/park-management" className="text-decoration-none w-100">
              <div className="card landing-card shadow-lg">
                <div className="card-body text-center">
                  <FaTasks className="landing-icon" />
                  <h5 className="card-title mt-3">Vehicle Park Management</h5>
                  <p className="card-text">Efficiently manage parking details.</p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LandingPage;
