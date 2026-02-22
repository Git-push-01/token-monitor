import { create } from 'zustand';
import type { ViewMode, PersonaType, UserPreferences } from '@token-monitor/shared';

interface SettingsState {
  persona: PersonaType;
  viewMode: ViewMode;
  theme: 'light' | 'dark' | 'system';
  onboarded: boolean;
  burnRate: {
    minIncrementTokens: number;
    maxUpdateRateHz: number;
    smoothingAlpha: number;
  };
  setPersona: (persona: PersonaType) => void;
  setViewMode: (mode: ViewMode) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setOnboarded: (onboarded: boolean) => void;
  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
}

export const useSettings = create<SettingsState>((set, get) => ({
  persona: 'casual',
  viewMode: 'widget',
  theme: 'system',
  onboarded: false,
  burnRate: {
    minIncrementTokens: 10,
    maxUpdateRateHz: 4,
    smoothingAlpha: 0.2,
  },

  setPersona: (persona) => {
    const viewMode = persona === 'casual' ? 'widget' : persona === 'builder' ? 'grid' : 'command-center';
    set({ persona, viewMode });
    get().saveSettings();
  },

  setViewMode: (viewMode) => {
    set({ viewMode });
    get().saveSettings();
  },

  setTheme: (theme) => {
    set({ theme });
    // Apply theme to document
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else {
      // System preference
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
    get().saveSettings();
  },

  setOnboarded: (onboarded) => {
    set({ onboarded });
    get().saveSettings();
  },

  loadSettings: async () => {
    try {
      const settings = await (window as any).electronAPI?.getSettings();
      if (settings) {
        set({
          persona: settings.persona || 'casual',
          viewMode: settings.viewMode || 'widget',
          theme: settings.theme || 'system',
          onboarded: settings.onboarded || false,
          burnRate: settings.burnRate || get().burnRate,
        });
        // Apply theme
        get().setTheme(settings.theme || 'system');
      }
    } catch {
      // Default settings are fine
    }
  },

  saveSettings: async () => {
    try {
      const { persona, viewMode, theme, onboarded, burnRate } = get();
      await (window as any).electronAPI?.updateSettings({
        persona, viewMode, theme, onboarded, burnRate,
      });
    } catch {
      // Silent fail
    }
  },
}));
