import { useContext } from 'react';
import { DataContext, type DataContextValue } from '../components/DataContext/DataContextValue';

export function useSharedData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useSharedData must be used within DataProvider');
  return ctx;
}
