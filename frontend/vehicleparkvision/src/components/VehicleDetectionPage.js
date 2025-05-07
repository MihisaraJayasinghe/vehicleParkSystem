import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './ModernStyles.css';

export default function VehicleDetectionPage() {
  // --- OCR results ---
  const [results, setResults] = useState({
    vehicleTypes: [],
    recognizedPlates: [],
    annotatedImage: '',
    suggestedSlot: null,
    autoParked: false,
    message: null
  });

  // --- File to send for OCR ---
  const [file, setFile] = useState(null);

  // --- Parking UI state ---
  const [plateNumber, setPlateNumber] = useState('');
  const [slotToPark, setSlotToPark] = useState('');
  const [parkingMsg, setParkingMsg] = useState('');
  const [showAlert, setShowAlert] = useState(false);

  // --- Loading spinner ---
  const [loading, setLoading] = useState(false);

  // Auto-fill plate and slot
  useEffect(() => {
    if (results.recognizedPlates.length > 0) {
      setPlateNumber(results.recognizedPlates[0]);
    }
    if (results.suggestedSlot !== null && results.suggestedSlot !== undefined) {
      setSlotToPark(String(results.suggestedSlot));
    }
  }, [results]);

  // Trigger parking when both plateNumber and slotToPark are set, and autoParked is true
  useEffect(() => {
    if (results.autoParked && results.message && plateNumber && slotToPark) {
      handleParkSlot();
    }
  }, [results, plateNumber, slotToPark]);

  // Send image → /predict_ocr
  const submitImage = async () => {
    if (!file) return alert('Select an image first');
    setLoading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('http://127.0.0.1:8000/predict_ocr', {
        method: 'POST',
        body: form
      });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      setResults({
        vehicleTypes:     data.vehicle_types,
        recognizedPlates: data.recognized_plates,
        annotatedImage:   data.annotated_image,
        suggestedSlot:    data.suggested_slot,
        autoParked:       data.auto_parked,
        message:          data.message
      });
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle parking UI feedback (no API call since backend already parked)
  const handleParkSlot = () => {
    setParkingMsg(results.message || '✅ Vehicle successfully added to database');
    setShowAlert(true);
    setTimeout(() => {
      setShowAlert(false);
      window.location.reload(); // Auto-refresh after 3 seconds
    }, 3000);
  };

  return (
    <div className="modern-container">
      {loading && (
        <div className="modern-spinner-overlay">
          <div className="modern-spinner" />
        </div>
      )}

      <Link to="/" className="modern-back-button">← Home</Link>
      <h2 className="modern-title">Vehicle & Plate Detection</h2>

      {/* — Image Upload — */}
      <div className="modern-card">
        <div className="modern-card-header">Upload Image</div>
        <div className="modern-card-body">
          <input
            type="file"
            accept="image/*"
            onChange={e => setFile(e.target.files[0])}
            className="modern-input-file"
          />
          <button
            className="modern-button primary"
            onClick={submitImage}
            disabled={!file || loading}
          >
            Analyze
          </button>
        </div>
      </div>

      {/* — OCR Results & Parking UI — */}
      {results.annotatedImage && (
        <div className="modern-card">
          <div className="modern-card-header">Results</div>
          <div className="modern-card-body">
            <img
              src={`data:image/png;base64,${results.annotatedImage}`}
              alt="Annotated"
              className="modern-image-fixed"
            />

            <div className="modern-row">
              <div className="modern-half">
                <h5>Vehicles</h5>
                <ul className="modern-list">
                  {results.vehicleTypes.map((v,i) => <li key={i}>{v}</li>)}
                </ul>
              </div>
              <div className="modern-half">
                <h5>Plates</h5>
                <ul className="modern-list">
                  {results.recognizedPlates.map((p,i) => <li key={i}>{p}</li>)}
                </ul>
              </div>
            </div>

            {/* — Confirm / Edit Plate — */}
            <div className="modern-section">
              <h5>Enter / Confirm Plate</h5>
              <input
                type="text"
                className="modern-input"
                placeholder="Example: AB1234"
                value={plateNumber}
                onChange={e => setPlateNumber(e.target.value.toUpperCase())}
              />
            </div>

            {/* — Park Slot — */}
            <div className="modern-section">
              <h5>Park Vehicle</h5>
              <label className="modern-label">Slot ID</label>
              <input
                type="number"
                className="modern-input"
                min="1"
                placeholder="e.g. 42"
                value={slotToPark}
                onChange={e => setSlotToPark(e.target.value)}
              />
              <button
                className="modern-button success"
                onClick={handleParkSlot}
                disabled={!plateNumber || !slotToPark || loading}
              >
                Park in Slot
              </button>
              {parkingMsg && showAlert && (
                <p className="modern-text-center modern-alert-orange">{parkingMsg}</p>
              )}
              {parkingMsg && !showAlert && (
                <p className="modern-text-center">{parkingMsg}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}