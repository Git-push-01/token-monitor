"use strict";
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // ─── Providers ─────────────────────────────────────────────
  getProviders: () => ipcRenderer.invoke("providers:list"),
  addProvider: (provider) => ipcRenderer.invoke("providers:add", provider),
  updateProvider: (id, data) => ipcRenderer.invoke("providers:update", id, data),
  removeProvider: (id) => ipcRenderer.invoke("providers:remove", id),
  testConnection: (type, config) => ipcRenderer.invoke("providers:test", type, config),
  testProvider: async (type, apiKey) => {
    const config = apiKey ? { apiKey } : undefined;
    const result = await ipcRenderer.invoke("providers:test", type, config);
    return { ok: (result && result.success) || false, error: (result && (result.error || result.info)) || undefined };
  },

  // ─── Usage Data ────────────────────────────────────────────
  getUsageStats: (query) => ipcRenderer.invoke("usage:stats", query),
  getUsageHistory: (query) => ipcRenderer.invoke("usage:history", query),
  getInstances: () => ipcRenderer.invoke("usage:instances"),

  // ─── Settings ──────────────────────────────────────────────
  getSettings: () => ipcRenderer.invoke("settings:get"),
  updateSettings: (settings) => ipcRenderer.invoke("settings:update", settings),

  // ─── Budgets ───────────────────────────────────────────────
  getBudgets: () => ipcRenderer.invoke("budgets:list"),
  addBudget: (budget) => ipcRenderer.invoke("budgets:add", budget),
  updateBudget: (id, data) => ipcRenderer.invoke("budgets:update", id, data),
  removeBudget: (id) => ipcRenderer.invoke("budgets:remove", id),

  // ─── Pairing ───────────────────────────────────────────────
  getPairingToken: () => ipcRenderer.invoke("pairing:token"),
  resetPairingToken: () => ipcRenderer.invoke("pairing:reset"),

  // ─── Export ────────────────────────────────────────────────
  exportCSV: (query) => ipcRenderer.invoke("export:csv", query),
  exportJSON: (query) => ipcRenderer.invoke("export:json", query),
  exportData: (format, query) => {
    if (format === "csv") return ipcRenderer.invoke("export:csv", query);
    return ipcRenderer.invoke("export:json", query);
  },

  // ─── Real-time events ─────────────────────────────────────
  onUsageEvent: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("usage:event", handler);
    return () => ipcRenderer.removeListener("usage:event", handler);
  },
  onProviderStatus: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("provider:status", handler);
    return () => ipcRenderer.removeListener("provider:status", handler);
  },
  onBudgetAlert: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("budget:alert", handler);
    return () => ipcRenderer.removeListener("budget:alert", handler);
  },

  // ─── Window ────────────────────────────────────────────────
  platform: process.platform,
});
