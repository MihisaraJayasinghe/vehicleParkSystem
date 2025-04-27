import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import './ModernStyles.css';

export default function VehicleDetectionPage() {
  const [results, setResults] = useState({ vehicleTypes: [], recognizedPlates: [], annotatedImage: '' });
  const [file, setFile] = useState(null);
  const [capturedUrl, setCapturedUrl] = useState('');
  const [webcamActive, setWebcamActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // --- New state for parking ---
  const [slotToPark, setSlotToPark] = useState('');
  const [parkingMsg, setParkingMsg] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // --- Webcam handlers ---
  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
      streamRef.current = stream;
      await videoRef.current.play();
      setWebcamActive(true);
    } catch {
      alert('Unable to access webcam');
    }
  };
  const stopWebcam = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    videoRef.current.srcObject = null;
    setWebcamActive(false);
    setCapturedUrl('');
  };
  const captureFrame = () => {
    const v = videoRef.current, c = canvasRef.current;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    const dataUrl = c.toDataURL('image/jpeg');
    setCapturedUrl(dataUrl);
    setFile(dataURLtoFile(dataUrl, 'capture.jpg'));
  };

  // helper to convert dataURL → File
  const dataURLtoFile = (dataurl, filename) => {
    const [header, base] = dataurl.split(',');
    const mime = header.match(/:(.*?);/)[1];
    const bin = atob(base), arr = new Uint8Array(bin.length);
    for (let i=0; i<bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new File([arr], filename, { type: mime });
  };

  // --- Submit for detection ---
  const submitImage = async () => {
    if (!file) return alert('Select or capture an image first');
    setIsLoading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('http://127.0.0.1:8000/predict_ocr', { method: 'POST', body: form });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      setResults({
        vehicleTypes: data.vehicle_types,
        recognizedPlates: data.recognized_plates,
        annotatedImage: data.annotated_image
      });
    } catch (err) {
      alert(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // --- New: Park slot API call ---
  const handleParkSlot = async () => {
    if (!slotToPark || !results.recognizedPlates[0]) {
      return alert("Enter a slot ID and detect a plate first");
    }
    setParkingMsg(null);
    try {
      const res = await fetch("http://127.0.0.1:8000/slots/park", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slot_id: Number(slotToPark),
          vehicle_plate: results.recognizedPlates[0]
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Parking failed");
      setParkingMsg(`✅ Parked in slot ${data.slot_id} at ${new Date(data.parked_time).toLocaleTimeString()}`);
    } catch (err) {
      setParkingMsg(`❌ ${err.message}`);
    }
  };

  return (
    <div className="modern-container" style={{ position: 'relative' }}>
      {isLoading && (
        <div className="modern-spinner-overlay">
          <div className="modern-spinner" />
        </div>
      )}

      <Link to="/" className="modern-back-button">← Home</Link>
      <h2 className="modern-title">Vehicle & Plate Detector</h2>

      {/* File Upload */}
      <div className="modern-card">
        <div className="modern-card-header">Upload Image</div>
        <div className="modern-card-body">
          <input
            type="file"
            accept="image/*"
            onChange={e => setFile(e.target.files[0])}
            className="modern-input-file"
            disabled={webcamActive || isLoading}
          />
          <button
            className="modern-button primary"
            onClick={submitImage}
            disabled={!file || isLoading}
          >
            Analyze
          </button>
        </div>
      </div>

      {/* Webcam Capture */}
      <div className="modern-card">
        <div className="modern-card-header">Webcam Capture</div>
        <div className="modern-card-body">
          {!webcamActive ? (
            <button
              className="modern-button secondary"
              onClick={startWebcam}
              disabled={isLoading}
            >
              Start Webcam
            </button>
          ) : (
            <>
              <video ref={videoRef} className="modern-media" muted />
              <div className="modern-button-group">
                <button className="modern-button secondary" onClick={captureFrame} disabled={isLoading}>
                  Capture
                </button>
                <button className="modern-button outline" onClick={stopWebcam} disabled={isLoading}>
                  Stop
                </button>
              </div>
            </>
          )}

          {capturedUrl && (
            <>
              <img src={capturedUrl} alt="Captured" className="modern-image-fixed" />
              <button
                className="modern-button primary"
                onClick={submitImage}
                disabled={isLoading}
              >
                Analyze Capture
              </button>
            </>
          )}

          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>
      </div>

      {/* Results */}
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

            {/* --- New Parking UI --- */}
            <div className="modern-section">
              <h5>Park Detected Vehicle</h5>
              <label className="modern-label">Slot ID</label>
              <input
                type="number"
                min="1"
                className="modern-input"
                value={slotToPark}
                onChange={e => setSlotToPark(e.target.value)}
                placeholder="e.g. 42"
              />
              <button
                className="modern-button success"
                onClick={handleParkSlot}
                disabled={!results.recognizedPlates[0]}
              >
                Park in Slot
              </button>
              {parkingMsg && <p className="modern-text-center">{parkingMsg}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}