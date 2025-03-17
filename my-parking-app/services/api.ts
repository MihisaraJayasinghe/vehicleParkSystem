import axios from 'axios';

const BASE_URL = 'http://192.168.1.4:8000'; // Change this to your FastAPI server URL

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 second timeout
});

// Add response interceptor for better error handling
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response) {
      // Server responded with error
      throw error.response.data;
    } else if (error.request) {
      // Request was made but no response
      throw { error: 'Network error. Please check your connection.' };
    } else {
      // Other errors
      throw { error: 'An error occurred. Please try again.' };
    }
  }
);

// User Authentication
export const registerUser = async (userData: {
  name: string;
  vehicle_plate: string;
  vehicle_type: string;
}) => {
  const response = await api.post('/register_user', userData);
  return response.data;
};

export const loginUser = async (loginData: {
  name: string;
  vehicle_plate: string;
}) => {
  const response = await api.post('/login', loginData);
  return response.data;
};

// Parking Management
export const getAvailableSlots = async () => {
  const response = await api.get('/available_slots');
  return response.data;
};

interface FastAPIValidationError {
  detail: Array<{
    loc: string[];
    msg: string;
    type: string;
  }>;
}

interface BookingResponse {
  success: boolean;
  message: string;
  data?: {
    slot_id: string;
    vehicle_plate: string;
    booked_at: string;
    user: {
      name: string;
      vehicle_type: string;
    };
  };
  error?: string;
}

type APIResponse<T> = T | FastAPIValidationError;

export const bookParkingSlot = async (slotId: string, vehiclePlate: string): Promise<BookingResponse> => {
  try {
    console.log('Booking request:', { slotId, vehiclePlate });
    
    const response = await api.post<BookingResponse>(
      `/book_slot/${slotId}`,
      { vehicle_plate: vehiclePlate },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    
    console.log('Booking response:', response.data);
    
    if (!response.data.success) {
      throw { error: response.data.error || 'Booking failed' };
    }
    
    return response.data;
  } catch (error: any) {
    console.error('Booking error:', error);
    
    if (error.response?.data) {
      const errorData = error.response.data;
      
      // Handle FastAPI validation error
      if (errorData.detail?.[0]?.msg) {
        throw { error: errorData.detail[0].msg };
      }
      
      // Handle our custom error
      if (errorData.error) {
        throw { error: errorData.error };
      }
      
      // Handle unknown error format
      if (typeof errorData === 'string') {
        throw { error: errorData };
      }
    }
    
    // Handle network or other errors
    if (error.error) {
      throw error;
    }
    
    throw { error: error.message || 'Failed to book parking slot' };
  }
};

export const parkVehicle = async (vehiclePlate: string) => {
  const response = await api.post('/park_vehicle', { vehicle_plate: vehiclePlate });
  return response.data;
};

export const removeVehicle = async (slotId: string, vehiclePlate: string) => {
  const response = await api.post('/remove_parked_vehicle', {
    slot_id: slotId,
    vehicle_plate: vehiclePlate,
  });
  return response.data;
};

// Vehicle Detection
export const detectVehicle = async (formData: FormData) => {

  
  const response = await api.post('/predict_ocr', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

// Parking Status
export const getParkingStatus = async () => {
  const response = await api.get('/get_parking_status');
  return response.data;
};

export const getParkedVehicles = async () => {
  const response = await api.get('/get_parked_vehicles');
  return response.data;
};
