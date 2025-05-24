import React, { useState, useEffect } from 'react';
import { View, Text, Button, StyleSheet, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { axiosInstance } from '../config/api';

export default function RemoveScreen({ route, navigation }) {
  const { slotId, rate_per_hour } = route.params;
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  // Fetch user data from AsyncStorage
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const json = await AsyncStorage.getItem('user');
        if (json) {
          setUser(JSON.parse(json));
        }
      } catch (e) {
        console.error('Error fetching user data:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  const handleClear = async () => {
    if (!user) {
      setMsg('❌ User data not found. Please log in again.');
      return;
    }
    // Use a default value if rate_per_hour is missing or invalid
    const effectiveRate = Number(rate_per_hour) || 10.0;
    const payload = {
      slot_id: Number(slotId),
      username: user.username,
      vehicle_plate: user.vehicle_plate.toUpperCase(),
      rate_per_hour: effectiveRate
    };
    console.log("Sending clear payload:", payload);
    try {
      setLoading(true);
      const response = await axiosInstance.post('/slots/clear', payload);
      console.log("Clear response:", response.data);
      setMsg(`✅ Slot cleared. Fee: $${response.data.fee}`);
      setTimeout(() => navigation.goBack(), 2000);
    } catch (error) {
      console.error("Clear error:", error.response?.data || error);
      setMsg(`❌ ${error.response?.data?.detail || 'Failed to clear slot'}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text>Loading user data…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Clear Slot #{slotId}</Text>
      <Text style={styles.info}>
        Username: {user?.username || 'N/A'}{'\n'}
        Vehicle Plate: {user?.vehicle_plate?.toUpperCase() || 'N/A'}{'\n'}
        Rate per Hour: ${rate_per_hour || 'N/A'}
      </Text>
      {msg ? <Text style={styles.message}>{msg}</Text> : null}
      <View style={styles.buttons}>
        <Button title="Clear Slot" onPress={handleClear} />
        <Button title="Back" onPress={() => navigation.goBack()} color="#666" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  title: { fontSize: 24, marginBottom: 20 },
  info: { fontSize: 16, marginBottom: 20, textAlign: 'center' },
  message: { marginVertical: 20, color: '#333', textAlign: 'center' },
  buttons: { width: '100%', gap: 10 },
});
