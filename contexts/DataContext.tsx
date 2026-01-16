'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface DataContextType {
  // Payouts state
  allPayouts: any[];
  setAllPayouts: (payouts: any[] | ((prev: any[]) => any[])) => void;
  oldestLoadedPayoutBlock: bigint | null;
  setOldestLoadedPayoutBlock: (block: bigint | null) => void;
  noMorePayouts: boolean;
  setNoMorePayouts: (value: boolean) => void;
  hasAutoSearchedPayouts: boolean;
  setHasAutoSearchedPayouts: (value: boolean) => void;
  
  // Proposals state
  allProposals: any[];
  setAllProposals: (proposals: any[] | ((prev: any[]) => any[])) => void;
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
  const [oldestLoadedPayoutBlock, setOldestLoadedPayoutBlock] = useState<bigint | null>(null);
  const [noMorePayouts, setNoMorePayouts] = useState(false);
  const [hasAutoSearchedPayouts, setHasAutoSearchedPayouts] = useState(false);
  
  const [allProposals, setAllProposalsState] = useState<any[]>([]);
  const [oldestLoadedProposalBlock, setOldestLoadedProposalBlock] = useState<bigint | null>(null);
  const [noMoreProposals, setNoMoreProposals] = useState(false);
  const [hasAutoSearchedProposals, setHasAutoSearchedProposals] = useState(false);

  // Wrapper functions to support functional updates
  const setAllPayouts = (payouts: any[] | ((prev: any[]) => any[])) => {
    if (typeof payouts === 'function') {
      setAllPayoutsState(payouts);
    } else {
      setAllPayoutsState(payouts);
    }
  };

  const setAllProposals = (proposals: any[] | ((prev: any[]) => any[])) => {
    if (typeof proposals === 'function') {
      setAllProposalsState(proposals);
    } else {
      setAllProposalsState(proposals);
    }
  };

  return (
    <DataContext.Provider
      value={{
        allPayouts,
        setAllPayouts,
        oldestLoadedPayoutBlock,
        setOldestLoadedPayoutBlock,
        noMorePayouts,
        setNoMorePayouts,
        hasAutoSearchedPayouts,
        setHasAutoSearchedPayouts,
        allProposals,
        setAllProposals,
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
