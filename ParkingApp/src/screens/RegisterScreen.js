// src/screens/RegisterScreen.js

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';

export default function RegisterScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [plate, setPlate] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const handleRegister = async () => {
    if (!username || !plate) {
      setMsg('Please enter both username and plate');
      return;
    }
    setLoading(true);
    setMsg('');
    try {
      await axios.post(
        `${API_BASE_URL}/register`,
        { username, vehicle_plate: plate }
      );
      setMsg('✅ Registered! You can now log in.');
    } catch (e) {
      setMsg(e.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>

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

      {msg ? (
        <Text style={msg.startsWith('✅') ? styles.success : styles.error}>
          {msg}
        </Text>
      ) : null}

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleRegister}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>Register</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.link}>← Back to Login</Text>
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
  success: {
    color: '#2ECC71',
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