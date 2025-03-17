import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

// Dummy data for demonstration
const dummySlots = Array.from({ length: 100 }, (_, index) => ({
  slot_id: String(index + 1),
  status: Math.random() > 0.7 ? 
    (Math.random() > 0.5 ? 'parked' : 'booked') : 
    'free',
  plate_number: Math.random() > 0.7 ? `ABC${(Math.random() * 1000).toFixed(0)}` : null,
  allocation_type: Math.random() > 0.8 ? 
    (Math.random() > 0.5 ? 'reserved' : 'handicap') : 
    'regular',
  is_occupied: Math.random() > 0.7
}));

export default function ParkingGrid() {
  const [slots, setSlots] = useState(dummySlots);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSlots();
  }, []);

  const fetchSlots = async () => {
    try {
      const response = await fetch('http://192.168.1.4:8000/parking-slots');
      const data = await response.json();
      if (data.slots && Array.isArray(data.slots)) {
        setSlots(data.slots);
      }
    } catch (error) {
      console.error('Failed to fetch slots, using dummy data:', error);
      // Keep using dummy data if fetch fails
    } finally {
      setLoading(false);
    }
  };

  const getSlotColor = (slot: any) => {
    if (slot.status === 'parked' || slot.is_occupied) return '#F44336';
    if (slot.status === 'booked') return '#FFC107';
    if (slot.allocation_type === 'handicap') return '#2196F3';
    if (slot.allocation_type === 'reserved') return '#9C27B0';
    return '#4CAF50';
  };

  const renderSlot = (slot: any) => (
    <TouchableOpacity
      key={slot.slot_id}
      style={[
        styles.slot,
        { backgroundColor: getSlotColor(slot) }
      ]}
      onPress={() => Alert.alert('Slot Info', `Slot ${slot.slot_id}\nStatus: ${slot.status}\n${slot.plate_number ? `Vehicle: ${slot.plate_number}` : 'Empty'}`)}
    >
      <ThemedText style={styles.slotNumber}>
        {slot.slot_id}
      </ThemedText>
      {slot.plate_number && (
        <ThemedText style={styles.plateText}>
          {slot.plate_number}
        </ThemedText>
      )}
      <ThemedText style={styles.statusText}>
        {slot.status.toUpperCase()}
      </ThemedText>
    </TouchableOpacity>
  );

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.title}>Parking Layout</ThemedText>
      <View style={styles.grid}>
        {slots.map(renderSlot)}
      </View>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#4CAF50' }]} />
          <ThemedText>Available</ThemedText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#F44336' }]} />
          <ThemedText>Occupied</ThemedText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#FFC107' }]} />
          <ThemedText>Booked</ThemedText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#2196F3' }]} />
          <ThemedText>Handicap</ThemedText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#9C27B0' }]} />
          <ThemedText>Reserved</ThemedText>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  slot: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    margin: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  slotNumber: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  plateText: {
    color: 'white',
    fontSize: 12,
    marginTop: 4,
  },
  statusText: {
    color: 'white',
    fontSize: 10,
    marginTop: 2,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: 20,
    gap: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
    marginRight: 8,
  }
});
