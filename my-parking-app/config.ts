// Use your computer's IP address instead of localhost
export const API_URL = 'http://192.168.1.4:8000'; // Replace with your computer's IP address

export const handleNetworkError = (error: any) => {
  if (error.message === 'Network request failed') {
    return 'Cannot connect to server. Please check your connection and make sure the server is running.';
  }
  return error.message || 'An error occurred';
};