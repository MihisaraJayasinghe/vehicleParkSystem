import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Alert,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Button,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import {
  getAvailableSlots,
  bookParkingSlot,
  removeVehicle,
} from '../../services/api';
import { Colors } from '../../constants/Colors';
import { useColorScheme } from '../../hooks/useColorScheme';

interface ParkingSlot {
  slot_id: string;
  is_occupied: boolean;
  is_booked: boolean;
  vehicle_plate: string | null;
  parked_at: string | null;
  booked_by: string | null;
}

export default function ParkingGridScreen() {
  // Get current user from AuthContext (saved locally)
  const { user } = useAuth();
  const currentUser = user; // expecting fields: name, vehicle_plate, vehicle_type

  const [parkingSlots, setParkingSlots] = useState<ParkingSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<ParkingSlot | null>(null);
  const [manualPlate, setManualPlate] = useState('');

  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Fetch parking slots from the backend
  const loadParkingSlots = async () => {
    try {
      const slots = await getAvailableSlots();
      setParkingSlots(slots);
    } catch (error) {
      Alert.alert('Error', 'Failed to load parking slots');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadParkingSlots();
    const interval = setInterval(loadParkingSlots, 30000);
    return () => clearInterval(interval);
  }, []);

  // Handle slot press:
  // - If free: show input to book (manual plate entry).
  // - If booked/occupied by current user: allow removal.
  // - Otherwise, inform the user.
  const handleSlotPress = (slot: ParkingSlot) => {
    if (!slot.is_occupied && !slot.is_booked) {
      setSelectedSlot(slot);
      setManualPlate('');
    } else {
      if (slot.vehicle_plate === currentUser?.vehicle_plate) {
        removeVehicleFromSlot(slot);
      } else {
        Alert.alert('Info', 'This slot is already booked by another vehicle.');
      }
    }
  };

  // Confirm booking using the manually entered plate
  const confirmBooking = async () => {
    if (!selectedSlot) return;
    if (!manualPlate.trim()) {
      Alert.alert('Error', 'Vehicle plate cannot be empty.');
      return;
    }
    try {
      setLoading(true);
      console.log(`Booking slot ${selectedSlot.slot_id} with plate: ${manualPlate}`);
      const result = await bookParkingSlot(selectedSlot.slot_id, manualPlate);
      if (result.error) {
        Alert.alert('Booking Failed', result.error);
      } else {
        Alert.alert('Success', result.message || 'Parking slot booked successfully');
        loadParkingSlots();
      }
    } catch (error: any) {
      console.error('Booking error:', error);
      Alert.alert(
        'Booking Error',
        error.error || 'Failed to book parking slot. Please try again.'
      );
    } finally {
      setLoading(false);
      setSelectedSlot(null);
      setManualPlate('');
    }
  };

  // Remove vehicle if the slot's vehicle plate matches the current user's plate
  const removeVehicleFromSlot = async (slot: ParkingSlot) => {
    if (!slot.vehicle_plate) {
      Alert.alert('Error', 'No vehicle plate found in this slot');
      return;
    }
    try {
      setLoading(true);
      console.log(`Removing vehicle from slot ${slot.slot_id}, plate: ${slot.vehicle_plate}`);
      const result = await removeVehicle(slot.slot_id, slot.vehicle_plate);
      if (result.fee) {
        Alert.alert('Vehicle Removed', `Parking fee: $${result.fee}`);
      } else {
        Alert.alert('Success', 'Vehicle removed successfully');
      }
      loadParkingSlots();
    } catch (error: any) {
      console.error('Remove vehicle error:', error);
      Alert.alert('Error', error.error || 'Failed to remove vehicle');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadParkingSlots();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  // Determine slot background color:
  // Available → green; Booked by current user → yellow; Booked by others → red.
  const getSlotColor = (slot: ParkingSlot) => {
    if (!slot.is_occupied && !slot.is_booked) return colors.success;
    if (slot.vehicle_plate === currentUser?.vehicle_plate) return colors.warning;
    return colors.error;
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <Text style={[styles.headerText, { color: colors.text }]}>
            Available Parking Slots
          </Text>
        </View>
        <View style={styles.grid}>
          {parkingSlots.map((slot) => (
            <TouchableOpacity
              key={slot.slot_id}
              style={[styles.slot, { backgroundColor: getSlotColor(slot) }]}
              onPress={() => handleSlotPress(slot)}
            >
              <Text style={styles.slotId}>{slot.slot_id}</Text>
              <Text style={styles.slotStatus}>
                {slot.is_occupied || slot.is_booked ? 'Occupied/Booked' : 'Available'}
              </Text>
              {slot.vehicle_plate && (
                <Text style={styles.plateText}>{slot.vehicle_plate}</Text>
              )}
              {/* If booked by current user, show Remove button */}
              {slot.vehicle_plate === currentUser?.vehicle_plate && (
                <Button title="Remove" onPress={() => removeVehicleFromSlot(slot)} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Show booking input if an available slot is selected */}
      {selectedSlot && (
        <View style={styles.bookingContainer}>
          <Text style={styles.bookingLabel}>
            Enter vehicle plate for {selectedSlot.slot_id}:
          </Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. ABC-1234"
            value={manualPlate}
            onChangeText={setManualPlate}
          />
          <Button title="Confirm Booking" onPress={confirmBooking} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 16, alignItems: 'center' },
  headerText: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 8, justifyContent: 'center' },
  slot: {
    width: '30%',
    aspectRatio: 1,
    margin: '1.5%',
    borderRadius: 8,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  slotId: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  slotStatus: { fontSize: 14, color: '#fff', marginTop: 4 },
  plateText: { fontSize: 12, color: '#fff', marginTop: 4 },
  bookingContainer: { backgroundColor: '#f0f0f0', padding: 16 },
  bookingLabel: { marginBottom: 8, fontSize: 16 },
  input: { height: 40, backgroundColor: '#fff', borderColor: '#ccc', borderWidth: 1, marginBottom: 12, paddingHorizontal: 8, borderRadius: 4 },
});