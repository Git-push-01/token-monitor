// Global type declarations for the renderer process

interface ElectronAPI {
  // Providers
  getProviders: () => Promise<any[]>;
  addProvider: (provider: any) => Promise<{ id: string; [key: string]: any }>;
  updateProvider: (id: string, data: any) => Promise<void>;
  removeProvider: (id: string) => Promise<void>;
  testProvider: (type: string, apiKey?: string) => Promise<{ ok: boolean; error?: string }>;
  testConnection: (type: string, config: any) => Promise<{ ok: boolean; error?: string }>;

  // Usage Data
  getUsageStats: (query?: any) => Promise<any>;
  getUsageHistory: (query?: any) => Promise<any[]>;
  getInstances: () => Promise<any[]>;

  // Settings
  getSettings: () => Promise<any>;
  updateSettings: (settings: any) => Promise<void>;

  // Budgets
  getBudgets: () => Promise<any[]>;
  addBudget: (budget: any) => Promise<void>;
  updateBudget: (id: string, data: any) => Promise<void>;
  removeBudget: (id: string) => Promise<void>;

  // Pairing
  getPairingToken: () => Promise<string>;
  resetPairingToken: () => Promise<string>;

  // Export
  exportData: (format: 'csv' | 'json') => Promise<void>;
  exportCSV: (query?: any) => Promise<void>;
  exportJSON: (query?: any) => Promise<void>;

  // Real-time events
  onUsageEvent: (callback: (event: any) => void) => () => void;
  onProviderStatus: (callback: (update: any) => void) => () => void;
  onBudgetAlert: (callback: (alert: any) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
