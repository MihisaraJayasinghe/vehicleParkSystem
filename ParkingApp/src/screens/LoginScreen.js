// src/screens/LoginScreen.js

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { axiosInstance } from '../config/api';

export default function LoginScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [plate, setPlate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!username || !plate) {
      setError('Please enter both username and plate');
      return;
    }
    setLoading(true);
    setError('');
    console.log("Attempting login with:", username, plate); // added logging
    try {
      const res = await axiosInstance.post(
        `/login`,
        { username, vehicle_plate: plate }
      );
      console.log("Login response:", res); // log response
      if (res.status === 200) {
        navigation.replace('Home');
      } else {
        setError('Login failed');
      }
    } catch (e) {
      console.error("Login error:", e); // log error to console
      // Added detailed logging of error response
      if (e.response) {
        console.error("Status:", e.response.status);
        console.error("Response data:", e.response.data);
      }
      setError(e.response?.data?.detail || 'Login error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome Back</Text>

      <TextInput
        style={styles.input}
        placeholder="Username"
        autoCapitalize="none"
        value={username}
        onChangeText={setUsername}
      />

      <TextInput
        style={styles.input}
        placeholder="Vehicle Plate"
        autoCapitalize="characters"
        value={plate}
        onChangeText={setPlate}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>Log In</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => navigation.navigate('Register')}
      >
        <Text style={styles.link}>Don't have an account? Register</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    marginBottom: 32,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#4A90E2',
    paddingVertical: 14,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonDisabled: {
    backgroundColor: '#7FB3E6',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  error: {
    color: '#E74C3C',
    marginBottom: 12,
    textAlign: 'center',
  },
  link: {
    color: '#4A90E2',
    textAlign: 'center',
    marginTop: 8,
    fontSize: 14,
  },
});