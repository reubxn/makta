import { createContext, useContext } from 'react';
import type { AppData } from './data';

export const DataContext = createContext<{ data: AppData } | null>(null);

export function useData() {
  const v = useContext(DataContext);
  if (!v) throw new Error('DataContext missing');
  return v;
}
