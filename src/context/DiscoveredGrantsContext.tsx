'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Grant } from '@/lib/types';

interface DiscoveredGrantsContextType {
  discoveredGrants: Grant[];
  addDiscoveredGrant: (grant: Grant) => void;
  isGrantDiscovered: (website: string) => boolean;
  clearDiscoveredGrants: () => void;
}

const DiscoveredGrantsContext = createContext<DiscoveredGrantsContextType | undefined>(undefined);

export function DiscoveredGrantsProvider({ children }: { children: ReactNode }) {
  const [discoveredGrants, setDiscoveredGrants] = useState<Grant[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('luminarts-discovered-grants');
    if (stored) {
      try { setDiscoveredGrants(JSON.parse(stored)); } catch (e) { console.error('Error loading discovered grants:', e); }
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('luminarts-discovered-grants', JSON.stringify(discoveredGrants));
    }
  }, [discoveredGrants, isLoaded]);

  const normalizeUrl = (url: string): string => {
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace('www.', '').toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  };

  const addDiscoveredGrant = (grant: Grant) => {
    setDiscoveredGrants(prev => {
      // Check if we already have a grant from this website
      const normalizedNewUrl = normalizeUrl(grant.website);
      const exists = prev.some(g => normalizeUrl(g.website) === normalizedNewUrl);
      if (exists) return prev;
      return [...prev, { ...grant, id: `discovered-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` }];
    });
  };

  const isGrantDiscovered = (website: string) => {
    const normalizedUrl = normalizeUrl(website);
    return discoveredGrants.some(g => normalizeUrl(g.website) === normalizedUrl);
  };

  const clearDiscoveredGrants = () => setDiscoveredGrants([]);

  return (
    <DiscoveredGrantsContext.Provider value={{ discoveredGrants, addDiscoveredGrant, isGrantDiscovered, clearDiscoveredGrants }}>
      {children}
    </DiscoveredGrantsContext.Provider>
  );
}

export function useDiscoveredGrants() {
  const context = useContext(DiscoveredGrantsContext);
  if (!context) throw new Error('useDiscoveredGrants must be used within DiscoveredGrantsProvider');
  return context;
}
