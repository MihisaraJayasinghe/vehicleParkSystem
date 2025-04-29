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
      setMsg(`✅ Booked slot ${res.data.slot_id}`);
    } catch (e) {
      setMsg(`❌ ${e.response?.data?.detail || 'Booking failed'}`);
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
        autoCapitalize="characters"
      />
      {msg ? <Text style={styles.message}>{msg}</Text> : null}
      <View style={styles.buttonRow}>
        <View style={styles.buttonWrapper}>
          <Button title="Book Slot" onPress={handleBook} />
        </View>
        <View style={styles.buttonWrapper}>
          <Button title="Back" onPress={() => navigation.goBack()} color="#888" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff'
  },
  title: {
    fontSize: 20,
    marginBottom: 12,
    textAlign: 'center'
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12
  },
  message: {
    textAlign: 'center',
    marginBottom: 12,
    color: '#333'
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly'
  },
  buttonWrapper: {
    flex: 1,
    marginHorizontal: 5
  }
});