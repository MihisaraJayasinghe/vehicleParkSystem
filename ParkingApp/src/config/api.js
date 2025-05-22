// src/config/api.js
import axios from 'axios';

// For Android emulator use "http://10.0.2.2:8000" or adjust according to your network.
export const API_BASE_URL = 'http://192.168.1.2:8000';  // Ensure this IP is reachable from your device
console.log("Using API_BASE_URL:", API_BASE_URL);

export const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000, // 10 seconds timeout
});