'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Grant, SavedGrantsContextType } from '@/lib/types';

const SavedGrantsContext = createContext<SavedGrantsContextType | undefined>(undefined);

export function SavedGrantsProvider({ children }: { children: ReactNode }) {
  const [savedGrants, setSavedGrants] = useState<Grant[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('luminarts-saved-grants');
    if (stored) {
      try { setSavedGrants(JSON.parse(stored)); } catch (e) { console.error('Error loading saved grants:', e); }
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('luminarts-saved-grants', JSON.stringify(savedGrants));
    }
  }, [savedGrants, isLoaded]);

  const addGrant = (grant: Grant) => {
    setSavedGrants(prev => {
      if (prev.some(g => g.id === grant.id)) return prev;
      return [...prev, grant];
    });
  };

  const removeGrant = (id: string) => {
    setSavedGrants(prev => prev.filter(g => g.id !== id));
  };

  const isGrantSaved = (id: string) => savedGrants.some(g => g.id === id);
  
  const clearAllGrants = () => setSavedGrants([]);

  return (
    <SavedGrantsContext.Provider value={{ savedGrants, addGrant, removeGrant, isGrantSaved, clearAllGrants }}>
      {children}
    </SavedGrantsContext.Provider>
  );
}

export function useSavedGrants() {
  const context = useContext(SavedGrantsContext);
  if (!context) throw new Error('useSavedGrants must be used within SavedGrantsProvider');
  return context;
}
