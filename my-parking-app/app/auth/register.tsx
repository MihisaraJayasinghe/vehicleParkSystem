import React, { useState } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, Text, Alert } from 'react-native';
import { Link, router } from 'expo-router';
import { registerUser } from '../../services/api';


export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleType, setVehicleType] = useState<string>('car');
  const [showVehicleTypes, setShowVehicleTypes] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const vehicleTypes = ['car', 'bike', 'van', 'bus', 'lorry', 'three wheeler'];

  const handleRegister = async () => {
    try {
      setError(null);
      setIsLoading(true);

      if (!name || !vehiclePlate || !vehicleType) {
        setError('Please fill in all fields');
        return;
      }

      if (vehiclePlate.length < 4) {
        setError('Vehicle plate number must be at least 4 characters');
        return;
      }

      const response = await registerUser({
        name,
        vehicle_plate: vehiclePlate.toUpperCase(),
        vehicle_type: vehicleType,
      });

      if (response.error) {
        setError(response.error);
        return;
      }

      Alert.alert('Success', 'Registration successful!', [
        {
          text: 'OK',
          onPress: () => router.replace('/auth/login'),
        },
      ]);
    } catch (err: any) {
      setError(err.error || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Register Your Vehicle</Text>
      <TextInput
        style={styles.input}
        placeholder="Name"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
      />
      <TextInput
        style={styles.input}
        placeholder="Vehicle Plate Number"
        value={vehiclePlate}
        onChangeText={setVehiclePlate}
        autoCapitalize="characters"
      />
      <TouchableOpacity
        style={styles.input}
        onPress={() => setShowVehicleTypes(true)}
      >
        <Text style={styles.inputText}>
          {vehicleType.charAt(0).toUpperCase() + vehicleType.slice(1)}
        </Text>
      </TouchableOpacity>

      {showVehicleTypes && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {vehicleTypes.map((type) => (
              <TouchableOpacity
                key={type}
                style={styles.typeOption}
                onPress={() => {
                  setVehicleType(type);
                  setShowVehicleTypes(false);
                }}
              >
                <Text style={styles.typeText}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}
      <TouchableOpacity 
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={handleRegister}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>
          {isLoading ? 'Registering...' : 'Register'}
        </Text>
      </TouchableOpacity>
      <Link href="/auth/login" asChild>
        <TouchableOpacity style={styles.linkButton}>
          <Text style={styles.linkText}>Already have an account? Login</Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  inputText: {
    fontSize: 16,
    color: '#333',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 20,
    width: '80%',
    maxHeight: '80%',
  },
  typeOption: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  typeText: {
    fontSize: 16,
    color: '#333',
  },
  button: {
    backgroundColor: '#007AFF',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  linkButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  linkText: {
    color: '#007AFF',
    fontSize: 16,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    marginBottom: 10,
    textAlign: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
});
