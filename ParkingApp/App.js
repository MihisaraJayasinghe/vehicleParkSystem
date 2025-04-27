// App.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator }  from '@react-navigation/stack';

import LoginScreen    from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import BookingScreen  from './src/screens/BookingScreen'; 
import RemoveScreen   from './src/screens/RemoveScreen';
 
import HomeScreen     from './src/screens/HomeScreen';
 
const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen name="Login"    component={LoginScreen}    options={{ headerShown:false }} />
        <Stack.Screen name="Register" component={RegisterScreen} options={{ title:'Register' }} />
        <Stack.Screen name="Booking"  component={BookingScreen}  options={{ title:'Book a Slot' }} />
        <Stack.Screen name="Remove"   component={RemoveScreen}   options={{ title:'Clear a Slot' }} />
        
        <Stack.Screen name="Home"     component={HomeScreen}     options={{ title:'Slots Overview' }} />
        
      </Stack.Navigator>
    </NavigationContainer>
  );
}