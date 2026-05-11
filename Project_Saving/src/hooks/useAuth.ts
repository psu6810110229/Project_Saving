import { useContext } from 'react';
import { AuthContext } from '../components/AuthProvider/AuthProvider';

export function useAuth() {
  return useContext(AuthContext);
}
