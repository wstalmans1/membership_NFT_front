'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface DataContextType {
  // Payouts state
  allPayouts: any[];
  setAllPayouts: (payouts: any[] | ((prev: any[]) => any[])) => void;
  loadedPayoutCount: number;
  setLoadedPayoutCount: (count: number | ((prev: number) => number)) => void;
  oldestLoadedPayoutBlock: bigint | null;
  setOldestLoadedPayoutBlock: (block: bigint | null) => void;
  noMorePayouts: boolean;
  setNoMorePayouts: (value: boolean) => void;
  hasAutoSearchedPayouts: boolean;
  setHasAutoSearchedPayouts: (value: boolean) => void;
  
  // Proposals state
  allProposals: any[];
  setAllProposals: (proposals: any[] | ((prev: any[]) => any[])) => void;
  loadedProposalCount: number;
  setLoadedProposalCount: (count: number | ((prev: number) => number)) => void;
  oldestLoadedProposalBlock: bigint | null;
  setOldestLoadedProposalBlock: (block: bigint | null) => void;
  noMoreProposals: boolean;
  setNoMoreProposals: (value: boolean) => void;
  hasAutoSearchedProposals: boolean;
  setHasAutoSearchedProposals: (value: boolean) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [allPayouts, setAllPayoutsState] = useState<any[]>([]);
  const [loadedPayoutCount, setLoadedPayoutCountState] = useState(0);
  const [oldestLoadedPayoutBlock, setOldestLoadedPayoutBlock] = useState<bigint | null>(null);
  const [noMorePayouts, setNoMorePayouts] = useState(false);
  const [hasAutoSearchedPayouts, setHasAutoSearchedPayouts] = useState(false);
  
  const [allProposals, setAllProposalsState] = useState<any[]>([]);
  const [loadedProposalCount, setLoadedProposalCountState] = useState(0);
  const [oldestLoadedProposalBlock, setOldestLoadedProposalBlock] = useState<bigint | null>(null);
  const [noMoreProposals, setNoMoreProposals] = useState(false);
  const [hasAutoSearchedProposals, setHasAutoSearchedProposals] = useState(false);

  // Wrapper functions to support functional updates - wrapped in useCallback to prevent infinite loops
  const setAllPayouts = useCallback((payouts: any[] | ((prev: any[]) => any[])) => {
    if (typeof payouts === 'function') {
      setAllPayoutsState(payouts);
    } else {
      setAllPayoutsState(payouts);
    }
  }, []);

  const setLoadedPayoutCount = useCallback((count: number | ((prev: number) => number)) => {
    if (typeof count === 'function') {
      setLoadedPayoutCountState(count);
    } else {
      setLoadedPayoutCountState(count);
    }
  }, []);

  const setAllProposals = useCallback((proposals: any[] | ((prev: any[]) => any[])) => {
    if (typeof proposals === 'function') {
      setAllProposalsState(proposals);
    } else {
      setAllProposalsState(proposals);
    }
  }, []);

  const setLoadedProposalCount = useCallback((count: number | ((prev: number) => number)) => {
    if (typeof count === 'function') {
      setLoadedProposalCountState(count);
    } else {
      setLoadedProposalCountState(count);
    }
  }, []);

  return (
    <DataContext.Provider
      value={{
        allPayouts,
        setAllPayouts,
        loadedPayoutCount,
        setLoadedPayoutCount,
        oldestLoadedPayoutBlock,
        setOldestLoadedPayoutBlock,
        noMorePayouts,
        setNoMorePayouts,
        hasAutoSearchedPayouts,
        setHasAutoSearchedPayouts,
        allProposals,
        setAllProposals,
        loadedProposalCount,
        setLoadedProposalCount,
        oldestLoadedProposalBlock,
        setOldestLoadedProposalBlock,
        noMoreProposals,
        setNoMoreProposals,
        hasAutoSearchedProposals,
        setHasAutoSearchedProposals,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useDataContext() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useDataContext must be used within a DataProvider');
  }
  return context;
}
