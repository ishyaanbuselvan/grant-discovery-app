'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface ReceivedGrantsContextType {
  receivedGrantIds: string[];
  markAsReceived: (id: string) => void;
  unmarkAsReceived: (id: string) => void;
  isGrantReceived: (id: string) => boolean;
  clearAllReceived: () => void;
}

const ReceivedGrantsContext = createContext<ReceivedGrantsContextType | undefined>(undefined);

export function ReceivedGrantsProvider({ children }: { children: ReactNode }) {
  const [receivedGrantIds, setReceivedGrantIds] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('luminarts-received-grants');
    if (stored) {
      try { setReceivedGrantIds(JSON.parse(stored)); } catch (e) { console.error('Error loading received grants:', e); }
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('luminarts-received-grants', JSON.stringify(receivedGrantIds));
    }
  }, [receivedGrantIds, isLoaded]);

  const markAsReceived = (id: string) => {
    setReceivedGrantIds(prev => {
      if (prev.includes(id)) return prev;
      return [...prev, id];
    });
  };

  const unmarkAsReceived = (id: string) => {
    setReceivedGrantIds(prev => prev.filter(gId => gId !== id));
  };

  const isGrantReceived = (id: string) => receivedGrantIds.includes(id);

  const clearAllReceived = () => setReceivedGrantIds([]);

  return (
    <ReceivedGrantsContext.Provider value={{ receivedGrantIds, markAsReceived, unmarkAsReceived, isGrantReceived, clearAllReceived }}>
      {children}
    </ReceivedGrantsContext.Provider>
  );
}

export function useReceivedGrants() {
  const context = useContext(ReceivedGrantsContext);
  if (!context) throw new Error('useReceivedGrants must be used within ReceivedGrantsProvider');
  return context;
}
