import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './ModernStyles.css';

function VehicleDetectionPage() {
  const [imageResults, setImageResults] = useState({
    vehicleTypes: [],
    recognizedPlates: [],
    annotatedImage: ''
  });
  const [imageFile, setImageFile] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [newVehicle, setNewVehicle] = useState({
    vehicle_type: '',
    license_plate: '',
    is_employee: false,
  });
  const [addingStatus, setAddingStatus] = useState("");
  const [parkedVehicles, setParkedVehicles] = useState([]);
  const [videoUrl, setVideoUrl] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleImageSubmit = async (e) => {
    e.preventDefault();
    if (!imageFile) return alert("No image selected!");
    const formData = new FormData();
    formData.append("file", imageFile);
    try {
      const res = await fetch("http://127.0.0.1:8000/predict_ocr", {
        method: "POST",
        body: formData
      });
      if (!res.ok) throw new Error("Image upload error.");
      const data = await res.json();
      setImageResults({
        vehicleTypes: data.vehicle_types,
        recognizedPlates: data.recognized_plates,
        annotatedImage: data.annotated_image
      });
    } catch (error) {
      alert(error.message);
    }
  };

  const analyzeVideoFrame = async (videoElement, currentTime) => {
    // Create canvas and capture frame
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    
    // Convert to blob
    const blob = await new Promise(resolve => {
      canvas.toBlob(resolve, 'image/jpeg', 1.0);
    });

    // Send to backend
    const formData = new FormData();
    formData.append("file", blob, "video-frame.jpg");
    
    const res = await fetch("http://127.0.0.1:8000/predict_ocr", {
      method: "POST",
      body: formData
    });
    
    if (!res.ok) throw new Error("Failed to analyze video frame");
    const data = await res.json();
    
    // Check if both vehicle and plate were detected
    const hasVehicle = data.vehicle_types.length > 0;
    const hasPlate = data.recognized_plates.length > 0;
    
    return {
      success: hasVehicle && hasPlate,
      data: data
    };
  };

  const handleVideoSubmit = async (e) => {
    e.preventDefault();
    if (!videoFile) return alert("No video selected!");
    
    try {
      setIsAnalyzing(true);
      
      // Create video element
      const videoElement = document.createElement('video');
      videoElement.preload = 'auto';
      
      // Create URL for video
      const videoUrl = URL.createObjectURL(videoFile);
      setVideoUrl(videoUrl);
      
      // Load video
      await new Promise((resolve, reject) => {
        videoElement.onloadeddata = () => resolve(videoElement);
        videoElement.onerror = () => reject('Error loading video');
        videoElement.src = videoUrl;
      });

      const duration = videoElement.duration;
      const interval = duration / 10; // Try 10 different positions
      let currentTime = 0;
      let detectionResult = null;

      // Try different frames until successful detection
      while (currentTime < duration) {
        videoElement.currentTime = currentTime;
        
        await new Promise((resolve) => {
          videoElement.onseeked = () => resolve();
        });

        const result = await analyzeVideoFrame(videoElement, currentTime);
        
        if (result.success) {
          detectionResult = result.data;
          break;
        }

        currentTime += interval;
      }

      if (detectionResult) {
        setImageResults({
          vehicleTypes: detectionResult.vehicle_types,
          recognizedPlates: detectionResult.recognized_plates,
          annotatedImage: detectionResult.annotated_image
        });
      } else {
        alert("Could not detect both vehicle and number plate in any video frame");
      }

    } catch (error) {
      alert("Error processing video: " + error.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleNewVehicleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setNewVehicle({
      ...newVehicle,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleAddVehicleSubmit = async (e) => {
    e.preventDefault();
    if (!window.confirm("Are you sure you want to add this vehicle?")) return;
    try {
      const res = await fetch("http://127.0.0.1:8000/add_vehicle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newVehicle)
      });
      const data = await res.json();
      if (res.ok) {
        setAddingStatus("Vehicle successfully added.");
      } else {
        setAddingStatus("Error: " + data.error);
      }
    } catch (err) {
      setAddingStatus("Error: " + err.message);
    }
  };

  const fetchParkedVehicles = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/get_parked_vehicles");
      if (!res.ok) throw new Error("Failed to fetch parked vehicles.");
      const data = await res.json();
      setParkedVehicles(data);
    } catch (error) {
      alert(error.message);
    }
  };

  useEffect(() => {
    fetchParkedVehicles();
  }, []);

  useEffect(() => {
    if (imageResults.recognizedPlates.length > 0) {
      setNewVehicle((prev) => ({
        ...prev,
        license_plate: imageResults.recognizedPlates[0]
      }));
    }
    if (imageResults.vehicleTypes.length > 0) {
      setNewVehicle((prev) => ({
        ...prev,
        vehicle_type: imageResults.vehicleTypes[0]
      }));
    }
  }, [imageResults]);

  return (
    <div className="modern-container">
      <Link to="/" className="modern-back-button">Back to Landing</Link>
      <h2 className="modern-title">Vehicle & License Plate Detection</h2>
      
      <div className="modern-card">
        <div className="modern-card-header">Upload Vehicle Image</div>
        <div className="modern-card-body">
          <form onSubmit={handleImageSubmit}>
            <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files[0])} required className="modern-input-file" />
            <button type="submit" className="modern-button primary">Analyze Image</button>
          </form>
        </div>
      </div>

      <div className="modern-row">
        <div className="modern-half">
          <h5>Vehicle Types</h5>
          <ul className="modern-list">
            {imageResults.vehicleTypes.map((v, index) => (
              <li key={index} className="modern-list-item">{v}</li>
            ))}
          </ul>
        </div>
        <div className="modern-half">
          <h5>Number Plates</h5>
          <ul className="modern-list">
            {imageResults.recognizedPlates.map((plate, index) => (
              <li key={index} className="modern-list-item">{plate}</li>
            ))}
          </ul>
        </div>
      </div>

      {imageResults.annotatedImage && (
        <div className="modern-card">
          <div className="modern-card-header">Annotated Image</div>
          <div className="modern-card-body modern-image-container">
            <img src={`data:image/png;base64,${imageResults.annotatedImage}`} alt="Annotated" className="modern-image" />
          </div>
        </div>
      )}

      <hr className="modern-divider" />

      <div className="modern-card">
        <div className="modern-card-header">Upload Vehicle Video</div>
        <div className="modern-card-body">
          <form onSubmit={handleVideoSubmit}>
            <input 
              type="file" 
              accept="video/*" 
              onChange={(e) => setVideoFile(e.target.files[0])} 
              required 
              className="modern-input-file" 
              disabled={isAnalyzing}
            />
            <button 
              type="submit" 
              className="modern-button primary"
              disabled={isAnalyzing}
            >
              {isAnalyzing ? 'Analyzing Video...' : 'Analyze Video Frame'}
            </button>
          </form>
        </div>
      </div>

      {/* Video Preview and Results */}
      <div className="modern-card">
        <div className="modern-card-header">Video Analysis</div>
        <div className="modern-card-body">
          <div className="modern-media-grid">
            {/* Original Video Preview */}
            {videoUrl && (
              <div className="modern-media-container">
                <video 
                  src={videoUrl}
                  controls
                  className="modern-media"
                  style={{ maxHeight: '500px' }}
                >
                  Your browser does not support video playback.
                </video>
              </div>
            )}

            {/* Analyzed Frame */}
            {imageResults.annotatedImage && (
              <div className="modern-media-container">
                <img 
                  src={`data:image/png;base64,${imageResults.annotatedImage}`}
                  alt="Analyzed frame"
                  className="modern-media"
                  style={{ maxHeight: '500px' }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="modern-card">
        <div className="modern-card-header">Add Vehicle to Parking</div>
        <div className="modern-card-body">
          <form onSubmit={handleAddVehicleSubmit}>
            <label className="modern-label">Vehicle Type</label>
            <input type="text" name="vehicle_type" className="modern-input" value={newVehicle.vehicle_type} onChange={handleNewVehicleChange} required />
            
            <label className="modern-label">License Plate</label>
            <input type="text" name="license_plate" className="modern-input" value={newVehicle.license_plate} onChange={handleNewVehicleChange} required />
            
            <div className="modern-checkbox-group">
              <input type="checkbox" name="is_employee" className="modern-checkbox" checked={newVehicle.is_employee} onChange={handleNewVehicleChange} />
              <label className="modern-checkbox-label">Employee Vehicle (No charge)</label>
            </div>
            <button type="submit" className="modern-button success">Add Vehicle</button>
          </form>
          {addingStatus && <div className="modern-alert">{addingStatus}</div>}
        </div>
      </div>

      <div className="modern-card">
        <div className="modern-card-header modern-card-header-flex">
          <span>Current Parked Vehicles</span>
          <button className="modern-button outline" onClick={fetchParkedVehicles}>Refresh</button>
        </div>
        <div className="modern-card-body">
          {parkedVehicles.length > 0 ? (
            <table className="modern-table">
              <thead>
                <tr>
                  <th>Vehicle Type</th>
                  <th>License Plate</th>
                  <th>Employee</th>
                  <th>Time In</th>
                </tr>
              </thead>
              <tbody>
                {parkedVehicles.map((veh) => (
                  <tr key={veh._id}>
                    <td>{veh.vehicle_type}</td>
                    <td>{veh.license_plate}</td>
                    <td>{veh.is_employee ? "Yes" : "No"}</td>
                    <td>{veh.time_in}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="modern-text-center">No vehicles currently parked.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default VehicleDetectionPage;
