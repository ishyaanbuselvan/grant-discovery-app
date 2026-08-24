'use client';
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

interface ReceivedGrantsContextType {
  receivedGrantIds: string[];
  markAsReceived: (id: string) => void;
  unmarkAsReceived: (id: string) => void;
  isGrantReceived: (id: string) => boolean;
  isLoading: boolean;
  refreshReceivedGrants: () => void;
}

const ReceivedGrantsContext = createContext<ReceivedGrantsContextType | undefined>(undefined);

export function ReceivedGrantsProvider({ children }: { children: ReactNode }) {
  const [receivedGrantIds, setReceivedGrantIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch received grants from API
  const fetchReceivedGrants = useCallback(async () => {
    try {
      const response = await fetch('/api/received-grants');
      const data = await response.json();
      setReceivedGrantIds(data.receivedGrants || []);
    } catch (error) {
      console.error('Error fetching received grants:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    fetchReceivedGrants();
  }, [fetchReceivedGrants]);

  // Poll for updates every 30 seconds to sync across users
  useEffect(() => {
    const interval = setInterval(fetchReceivedGrants, 30000);
    return () => clearInterval(interval);
  }, [fetchReceivedGrants]);

  const markAsReceived = async (id: string) => {
    // Optimistically update UI
    setReceivedGrantIds(prev => {
      if (prev.includes(id)) return prev;
      return [...prev, id];
    });

    try {
      const response = await fetch('/api/received-grants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grantId: id }),
      });
      const data = await response.json();
      if (data.receivedGrants) {
        setReceivedGrantIds(data.receivedGrants);
      }
    } catch (error) {
      console.error('Error marking grant as received:', error);
      // Revert on error
      setReceivedGrantIds(prev => prev.filter(gId => gId !== id));
    }
  };

  const unmarkAsReceived = async (id: string) => {
    // Optimistically update UI
    setReceivedGrantIds(prev => prev.filter(gId => gId !== id));

    try {
      const response = await fetch('/api/received-grants', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grantId: id }),
      });
      const data = await response.json();
      if (data.receivedGrants) {
        setReceivedGrantIds(data.receivedGrants);
      }
    } catch (error) {
      console.error('Error unmarking grant as received:', error);
      // Revert on error
      setReceivedGrantIds(prev => [...prev, id]);
    }
  };

  const isGrantReceived = (id: string) => receivedGrantIds.includes(id);

  const refreshReceivedGrants = () => {
    fetchReceivedGrants();
  };

  return (
    <ReceivedGrantsContext.Provider value={{
      receivedGrantIds,
      markAsReceived,
      unmarkAsReceived,
      isGrantReceived,
      isLoading,
      refreshReceivedGrants
    }}>
      {children}
    </ReceivedGrantsContext.Provider>
  );
}

export function useReceivedGrants() {
  const context = useContext(ReceivedGrantsContext);
  if (!context) throw new Error('useReceivedGrants must be used within ReceivedGrantsProvider');
  return context;
}
