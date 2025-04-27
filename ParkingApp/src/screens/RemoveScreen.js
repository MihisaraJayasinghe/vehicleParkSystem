// src/screens/RemoveScreen.js
import React, { useState } from 'react';
import { View, TextInput, Button, StyleSheet, Text } from 'react-native';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';

export default function RemoveScreen({ route }) {
  const { slotId } = route.params;
  const [info, setInfo] = useState(null);

  const handleRemove = async () => {
    try {
      const res = await axios.post(
        `${API_BASE_URL}/slots/clear`,
        { slot_id: Number(slotId), rate_per_hour: 10.0 }
      );
      setInfo(`Cleared! Fee: $${res.data.fee}`);
    } catch (e) {
      setInfo(e.response?.data?.detail || 'Removal failed');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Clear Slot #{slotId}</Text>
      {info && <Text style={styles.message}>{info}</Text>}
      <Button title="Clear Slot" onPress={handleRemove} />
    </View>
  );
}
// ...styles omitted...