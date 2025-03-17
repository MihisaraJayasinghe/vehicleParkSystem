import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import VehicleDetectionPage from './components/VehicleDetectionPage';
import SlotDetectionPage from './components/SlotDetectionPage';
import ParkManagementPage from './components/ParkManagementPage';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/vehicle-detection" element={<VehicleDetectionPage />} />
        <Route path="/slot-detection" element={<SlotDetectionPage />} />
        <Route path="/park-management" element={<ParkManagementPage />} />
      </Routes>
    </Router>
  );
}

export default App;
