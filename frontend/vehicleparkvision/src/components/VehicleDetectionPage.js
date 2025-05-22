import React, { useState, useEffect, useRef } from 'react';
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

  // --- File & preview state ---
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isVideo, setIsVideo] = useState(false);
  const videoRef = useRef(null);

  // --- Parking UI state ---
  const [plateNumber, setPlateNumber] = useState('');
  const [slotToPark, setSlotToPark] = useState('');
  const [parkingMsg, setParkingMsg] = useState('');
  const [showAlert, setShowAlert] = useState(false);

  // --- Loading spinner ---
  const [loading, setLoading] = useState(false);

  // Auto-fill only for images (not videos)
  useEffect(() => {
    if (!isVideo && results.recognizedPlates.length) {
      setPlateNumber(results.recognizedPlates[0]);
    }
    if (results.suggestedSlot != null) {
      setSlotToPark(String(results.suggestedSlot));
    }
  }, [results, isVideo]);

  // Handle file select
  const handleFileChange = e => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setIsVideo(f.type.startsWith('video/'));
    setPreviewUrl(URL.createObjectURL(f));
  };

  // Capture a frame at a fraction of video
  const extractFrameFraction = (videoFile, fraction) =>
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(videoFile);
      const video = document.createElement('video');
      video.style.cssText = 'position:absolute;visibility:hidden;left:-9999px;top:0;';
      video.preload = 'metadata';
      video.muted = true;
      video.src = url;
      document.body.appendChild(video);

      video.addEventListener('loadedmetadata', () => {
        const t = Math.min(fraction * video.duration, video.duration - 0.01);
        video.currentTime = t;
      });

      video.addEventListener('seeked', () => {
        setTimeout(() => {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          canvas.getContext('2d').drawImage(video, 0, 0);
          canvas.toBlob(blob => {
            document.body.removeChild(video);
            URL.revokeObjectURL(url);
            blob ? resolve(blob) : reject(new Error('Failed to capture frame'));
          }, 'image/png');
        }, 100);
      });

      video.addEventListener('error', () => {
        document.body.removeChild(video);
        URL.revokeObjectURL(url);
        reject(new Error('Video load error'));
      });
    });

  // Compute longest common suffix among strings
  const commonSuffix = arr => {
    if (!arr.length) return '';
    const minLen = Math.min(...arr.map(s => s.length));
    let suffix = '';
    for (let i = 1; i <= minLen; i++) {
      const sub = arr[0].slice(-i);
      if (arr.every(s => s.endsWith(sub))) suffix = sub;
      else break;
    }
    return suffix;
  };

  // Submit image or multiple frames
  const submitImage = async () => {
    if (!file) {
      alert('Select a file first');
      return;
    }
    setLoading(true);
    try {
      let data;
      if (isVideo) {
        const fractions = [0.1, 0.5, 0.9];
        const ocrResults = [];
        let lastResponse = null;

        for (const frac of fractions) {
          const frame = await extractFrameFraction(file, frac);
          const form = new FormData();
          form.append('file', frame, 'frame.png');
          const res = await fetch('http://127.0.0.1:8000/predict_ocr', {
            method: 'POST',
            body: form
          });
          if (!res.ok) throw new Error('Upload failed');
          lastResponse = await res.json();
          ocrResults.push(lastResponse.recognized_plates[0] || '');
        }

        const stablePlate = commonSuffix(ocrResults);
        setPlateNumber(stablePlate);

        data = {
          ...lastResponse,
          recognized_plates: ocrResults,
          recognizedPlates: ocrResults,  // for setResults structure
          suggested_slot: lastResponse.suggested_slot,
          auto_parked: lastResponse.auto_parked,
          message: lastResponse.message
        };
        setResults(prev => ({
          ...prev,
          vehicleTypes: lastResponse.vehicle_types,
          recognizedPlates: ocrResults,
          annotatedImage: lastResponse.annotated_image,
          suggestedSlot: lastResponse.suggested_slot,
          autoParked: lastResponse.auto_parked,
          message: lastResponse.message
        }));
      } else {
        const form = new FormData();
        form.append('file', file);
        const res = await fetch('http://127.0.0.1:8000/predict_ocr', {
          method: 'POST',
          body: form
        });
        if (!res.ok) throw new Error('Upload failed');
        data = await res.json();
        setResults({
          vehicleTypes: data.vehicle_types,
          recognizedPlates: data.recognized_plates,
          annotatedImage: data.annotated_image,
          suggestedSlot: data.suggested_slot,
          autoParked: data.auto_parked,
          message: data.message
        });
        setPlateNumber(data.recognized_plates[0] || '');
      }

      // **IMMEDIATE ALERT** if backend says auto_parked
      if (data.auto_parked) {
        const msg = data.message || `Vehicle ${plateNumber} parked in slot ${data.suggested_slot}`;
        alert(msg);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Manual park button (still alerts + banner)
  const handleParkSlot = () => {
    const msg = results.message || '✅ Vehicle added';
    alert(msg);
    setParkingMsg(msg);
    setShowAlert(true);
    setTimeout(() => setShowAlert(false), 3000);
  };

  return (
    <div className="modern-container">
      {loading && (
        <div className="modern-spinner-overlay">
          <div className="modern-spinner" />
        </div>
      )}

      <Link to="/" className="modern-back-button">Back</Link>
      <h2 className="modern-title">Vehicle & Plate Detection</h2>

      {/* File Upload & Preview */}
      <div className="modern-card">
        <div className="modern-card-header">Upload Image or Video</div>
        <div className="modern-card-body">
          <input
            type="file"
            accept="image/*,video/*"
            onChange={handleFileChange}
            className="modern-input-file"
          />

          {previewUrl && isVideo ? (
            <video ref={videoRef} src={previewUrl} controls className="modern-video-preview" />
          ) : previewUrl ? (
            <img src={previewUrl} alt="preview" className="modern-image-fixed" />
          ) : null}

          <button
            className="modern-button primary"
            onClick={submitImage}
            disabled={!file || loading}
          >
            Analyze
          </button>
        </div>
      </div>

      {/* OCR Results & Parking */}
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
                  {results.vehicleTypes.map((v, i) => <li key={i}>{v}</li>)}
                </ul>
              </div>
              <div className="modern-half">
                <h5>Plates</h5>
                <ul className="modern-list">
                  {results.recognizedPlates.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </div>
            </div>

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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}