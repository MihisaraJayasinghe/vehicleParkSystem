// src/screens/SlotScreen.js

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  Text,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';

export default function SlotScreen({ navigation }) {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSlots = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/slots`);
      setSlots(res.data.sort((a, b) => a.slot_id - b.slot_id));
    } catch (e) {
      console.error('Failed to load slots', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  const getSlotColor = status => {
    if (status === 'booked') return '#FFC107';
    if (status === 'parked') return '#F44336';
    return '#4CAF50';
  };

  const renderSlot = ({ item }) => (
    <TouchableOpacity
      style={[styles.slot, { backgroundColor: getSlotColor(item.status) }]}
      onPress={() => {
        const screen = item.status === 'free' ? 'Book' : 'Remove';
        navigation.navigate(screen, { slotId: item.slot_id });
      }}
    >
      <Text style={styles.slotId}>#{item.slot_id}</Text>
      <Text style={styles.slotStatus}>{item.status.toUpperCase()}</Text>
      {item.parked_vehicle_plate && (
        <Text style={styles.slotPlate}>{item.parked_vehicle_plate}</Text>
      )}
    </TouchableOpacity>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={slots}
        keyExtractor={s => s.slot_id.toString()}
        numColumns={4}
        renderItem={renderSlot}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchSlots();
            }}
          />
        }
        contentContainerStyle={styles.grid}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  grid: { padding: 8 },
  slot: {
    flex: 1,
    margin: 4,
    height: 80,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  slotId: { color: '#fff', fontWeight: 'bold' },
  slotStatus: { color: '#fff', fontSize: 12 },
  slotPlate: { color: '#fff', fontSize: 11, marginTop: 4 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});