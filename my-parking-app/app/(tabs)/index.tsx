import { Redirect } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';

export default function Index() {
  const { user } = useAuth();
  return <Redirect href={user ? '/(tabs)/parking-grid' : '/auth/login'} />;
}
