import { contextBridge, ipcRenderer } from 'electron';

// Expose protected APIs to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // ─── Providers ─────────────────────────────────────────────
  getProviders: () => ipcRenderer.invoke('providers:list'),
  addProvider: (provider: any) => ipcRenderer.invoke('providers:add', provider),
  updateProvider: (id: string, data: any) => ipcRenderer.invoke('providers:update', id, data),
  removeProvider: (id: string) => ipcRenderer.invoke('providers:remove', id),
  testConnection: (type: string, config: any) => ipcRenderer.invoke('providers:test', type, config),
  testProvider: async (type: string, apiKey?: string) => {
    const config = apiKey ? { apiKey } : undefined;
    const result = await ipcRenderer.invoke('providers:test', type, config);
    return { ok: result?.success ?? false, error: result?.error || result?.info };
  },

  // ─── Usage Data ────────────────────────────────────────────
  getUsageStats: (query: any) => ipcRenderer.invoke('usage:stats', query),
  getUsageHistory: (query: any) => ipcRenderer.invoke('usage:history', query),
  getInstances: () => ipcRenderer.invoke('usage:instances'),

  // ─── Settings ──────────────────────────────────────────────
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings: any) => ipcRenderer.invoke('settings:update', settings),

  // ─── Budgets ───────────────────────────────────────────────
  getBudgets: () => ipcRenderer.invoke('budgets:list'),
  addBudget: (budget: any) => ipcRenderer.invoke('budgets:add', budget),
  updateBudget: (id: string, data: any) => ipcRenderer.invoke('budgets:update', id, data),
  removeBudget: (id: string) => ipcRenderer.invoke('budgets:remove', id),

  // ─── Pairing ───────────────────────────────────────────────
  getPairingToken: () => ipcRenderer.invoke('pairing:token'),
  resetPairingToken: () => ipcRenderer.invoke('pairing:reset'),

  // ─── Export ────────────────────────────────────────────────
  exportCSV: (query: any) => ipcRenderer.invoke('export:csv', query),
  exportJSON: (query: any) => ipcRenderer.invoke('export:json', query),
  exportData: (format: 'csv' | 'json', query?: any) => {
    if (format === 'csv') return ipcRenderer.invoke('export:csv', query);
    return ipcRenderer.invoke('export:json', query);
  },

  // ─── Real-time events ─────────────────────────────────────
  onUsageEvent: (callback: (event: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('usage:event', handler);
    return () => ipcRenderer.removeListener('usage:event', handler);
  },
  onProviderStatus: (callback: (event: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('provider:status', handler);
    return () => ipcRenderer.removeListener('provider:status', handler);
  },
  onBudgetAlert: (callback: (event: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('budget:alert', handler);
    return () => ipcRenderer.removeListener('budget:alert', handler);
  },

  // ─── Window ────────────────────────────────────────────────
  platform: process.platform,
});
