// src/screens/HomeScreen.js
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

const slotRanges = [
  { type: 'bikes',        start: 1,  end: 40 },
  { type: 'cars',         start: 41, end: 70 },
  { type: 'threeWheelers',start: 71, end: 80 },
  { type: 'vans',         start: 81, end: 90 },
  { type: 'trucks',       start: 91, end: 95 },
  { type: 'lorries',      start: 96, end: 100 },
];

export default function HomeScreen({ navigation }) {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSlots = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/slots`);
      setSlots(Array.isArray(res.data) 
        ? res.data.sort((a,b) => a.slot_id - b.slot_id)
        : []
      );
    } catch (_) {
      // treat any error as "no slots yet"
      setSlots([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchSlots(); }, [fetchSlots]);

  const getSlotColor = status => {
    if (status === 'booked') return '#FFC107';
    if (status === 'parked') return '#F44336';
    return '#4CAF50';
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.slot, { backgroundColor: getSlotColor(item.status) }]}
      onPress={() => {
        const screen = item.status === 'free' ? 'Book' : 'Remove';
        navigation.navigate(screen, { slotId: item.slot_id });
      }}
    >
      <Text style={styles.slotText}>#{item.slot_id}</Text>
      <Text style={styles.slotSub}>{item.status.toUpperCase()}</Text>
      {item.parked_vehicle_plate && (
        <Text style={styles.slotSub}>{item.parked_vehicle_plate}</Text>
      )}
    </TouchableOpacity>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!loading && slots.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>No slots available</Text>
        <TouchableOpacity onPress={() => {
          setRefreshing(true);
          fetchSlots();
        }}>
          <Text style={styles.refreshLink}>Pull to refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={slots}
        keyExtractor={i => i.slot_id.toString()}
        numColumns={4}
        renderItem={renderItem}
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
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  grid: {
    padding: 8,
  },
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
  slotText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  slotSub: {
    color: '#fff',
    fontSize: 12,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 8,
  },
  refreshLink: {
    color: '#4A90E2',
    fontSize: 16,
  },
});
 