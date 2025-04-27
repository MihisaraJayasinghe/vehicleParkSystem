// src/screens/BookingScreen.js
import React, { useState } from 'react';
import { View, TextInput, Button, StyleSheet, Text } from 'react-native';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';

export default function BookingScreen({ route, navigation }) {
  const { slotId } = route.params;
  const [plate, setPlate] = useState('');
  const [msg, setMsg] = useState('');

  const handleBook = async () => {
    try {
      const res = await axios.post(
        `${API_BASE_URL}/slots/book`,
        { slot_id: Number(slotId), vehicle_plate: plate }
      );
      setMsg(`Booked slot ${res.data.slot_id}`);
    } catch (e) {
      setMsg(e.response?.data?.detail || 'Booking failed');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Book Slot #{slotId}</Text>
      <TextInput
        placeholder="Your Plate Number"
        style={styles.input}
        value={plate}
        onChangeText={setPlate}
      />
      {msg && <Text style={styles.message}>{msg}</Text>}
      <Button title="Book Slot" onPress={handleBook} />
      <Button title="Back" onPress={() => navigation.goBack()} />
    </View>
  );
}
// ...styles omitted...