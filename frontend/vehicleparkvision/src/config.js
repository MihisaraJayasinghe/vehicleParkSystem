// src/config/api.js
import axios from 'axios';

// adjust this to your actual LAN IP or emulator host
export const API_BASE_URL = 'http://192.168.180.66:8000';

export const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});