// src/screens/BookingScreen.js
import React, { useState, useEffect } from 'react';
import { View, Button, StyleSheet, Text } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';
import { Picker } from '@react-native-picker/picker';

export default function BookingScreen({ route, navigation }) {
  const { slotId } = route.params;
  const [msg, setMsg] = useState('');
  const [userData, setUserData] = useState({});
  const [userPlate, setUserPlate] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const allowedTypes = ["Bikes", "Cars", "ThreeWheelers", "Vans", "Trucks", "Lorries"];
  // Allowed slot ranges mapping (front-end version)
  const allowedRanges = {
    Bikes: { low: 1, high: 40 },
    Cars: { low: 41, high: 70 },
    ThreeWheelers: { low: 71, high: 80 },
    Vans: { low: 81, high: 90 },
    Trucks: { low: 91, high: 95 },
    Lorries: { low: 96, high: 100 }
  };

  useEffect(() => {
    AsyncStorage.getItem('user').then(userJson => {
      if (userJson) {
        const user = JSON.parse(userJson);
        setUserData(user);
        setUserPlate(user.vehicle_plate);
        // If user record has vehicle_type, use it
        if (user.vehicle_type) setVehicleType(user.vehicle_type);
      }
    });
  }, []);

  const handleBook = async () => {
    if (!userPlate || !vehicleType) {
      setMsg('User data missing from storage; please select your vehicle type');
      return;
    }
    const slot = Number(slotId);
    const range = allowedRanges[vehicleType];
    if (!range || slot < range.low || slot > range.high) {
      setMsg(`❌ Slot ${slot} is not available for ${vehicleType}. Allowed slots are ${range.low}-${range.high}.`);
      return;
    }
    try {
      const resSlots = await axios.get(`${API_BASE_URL}/slots`);
      const userBooking = resSlots.data.find(
        s => s.parked_vehicle_plate === userPlate && s.status === 'booked'
      );
      if (userBooking) {
        setMsg(`❌ You already have a booked slot (#${userBooking.slot_id})`);
        return;
      }
      const res = await axios.post(
        `${API_BASE_URL}/slots/book`,
        { 
          slot_id: slot, 
          vehicle_plate: userPlate, 
          username: userData.username, 
          vehicle_type: vehicleType 
        }
      );
      setMsg(`✅ Booked slot ${res.data.slot_id}`);
    } catch (e) {
      let errorDetail = 'Booking failed';
      if (e.response && e.response.data) {
        errorDetail = typeof e.response.data.detail === 'string'
          ? e.response.data.detail
          : JSON.stringify(e.response.data);
      }
      setMsg(`❌ ${errorDetail}`);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Book Slot #{slotId}</Text>
      <Text style={styles.info}>Your Plate: {userPlate}</Text>
      { !vehicleType && (
        <>
          <Text style={styles.info}>Select your vehicle type:</Text>
          <Picker
            selectedValue={vehicleType}
            onValueChange={(itemValue) => setVehicleType(itemValue)}
            style={styles.picker}
          >
            <Picker.Item label="Select type..." value="" />
            {allowedTypes.map((type, idx) => (
              <Picker.Item key={idx} label={type} value={type} />
            ))}
          </Picker>
        </>
      )}
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
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 20, marginBottom: 12, textAlign: 'center' },
  info: { textAlign: 'center', marginBottom: 12, fontSize: 16 },
  message: { textAlign: 'center', marginBottom: 12, color: '#333' },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-evenly' },
  buttonWrapper: { flex: 1, marginHorizontal: 5 },
  picker: { height: 50, width: '80%', alignSelf: 'center', marginBottom: 12 }
});