// src/screens/RemoveScreen.js

import React, { useState } from 'react';
import { View, Button, StyleSheet, Text } from 'react-native';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';

export default function RemoveScreen({ route, navigation }) {
  const { slotId } = route.params;
  const [info, setInfo] = useState(null);

  const handleRemove = async () => {
    try {
      const res = await axios.post(
        `${API_BASE_URL}/slots/clear`,
        { slot_id: Number(slotId), rate_per_hour: 10.0 }
      );
      setInfo(`✅ Cleared! Fee: $${res.data.fee}`);
    } catch (e) {
      setInfo(`❌ ${e.response?.data?.detail || 'Removal failed'}`);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Clear Slot #{slotId}</Text>
      {info ? <Text style={styles.message}>{info}</Text> : null}
      <View style={styles.buttonWrapper}>
        <Button title="Clear Slot" onPress={handleRemove} />
      </View>
      <View style={styles.buttonWrapper}>
        <Button title="Back" onPress={() => navigation.goBack()} color="#888" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
    marginVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  buttonWrapper: {
    marginVertical: 6,
  },
});