'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { isCommunityOnly } from '@/config/features';

export type ViewMode = 'community' | 'full';

interface ViewModeContextType {
  mode: ViewMode;
  isExtended: boolean;
  isCommunityMode: boolean;
  /** false when the build forces community-only; no toggle shown */
  canToggle: boolean;
  setMode: (mode: ViewMode) => void;
  toggle: () => void;
}

const ViewModeContext = createContext<ViewModeContextType>({
  mode: 'community',
  isExtended: false,
  isCommunityMode: true,
  canToggle: false,
  setMode: () => {},
  toggle: () => {},
});

const STORAGE_KEY = 'qawl-view-mode';

export function ViewModeProvider({ children }: { children: React.ReactNode }) {
  // Default is 'community' — users start in the focused community view.
  const [mode, setModeState] = useState<ViewMode>('community');

  useEffect(() => {
    // Community build is locked — don't read localStorage.
    if (isCommunityOnly) return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as ViewMode | null;
      if (saved === 'full' || saved === 'community') setModeState(saved);
    } catch {
      // localStorage not available (e.g. private browsing edge cases)
    }
  }, []);

  const setMode = useCallback((newMode: ViewMode) => {
    if (isCommunityOnly) return;
    setModeState(newMode);
    try {
      localStorage.setItem(STORAGE_KEY, newMode);
    } catch {}
  }, []);

  const toggle = useCallback(() => {
    setMode(mode === 'community' ? 'full' : 'community');
  }, [mode, setMode]);

  // If the build forces community mode, ignore any saved preference.
  const effectiveMode: ViewMode = isCommunityOnly ? 'community' : mode;

  return (
    <ViewModeContext.Provider
      value={{
        mode: effectiveMode,
        isExtended: effectiveMode === 'full',
        isCommunityMode: effectiveMode === 'community',
        canToggle: !isCommunityOnly,
        setMode,
        toggle,
      }}
    >
      {children}
    </ViewModeContext.Provider>
  );
}

export const useViewMode = () => useContext(ViewModeContext);
