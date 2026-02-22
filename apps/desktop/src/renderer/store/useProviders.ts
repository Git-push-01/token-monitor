import { create } from 'zustand';
import type { Provider, ProviderType } from '@token-monitor/shared';
import { PROVIDER_DEFINITIONS } from '@token-monitor/shared';

interface ProvidersState {
  providers: Provider[];
  loading: boolean;
  addProvider: (type: ProviderType, name: string, config?: Record<string, unknown>) => Promise<Provider | null>;
  updateProvider: (id: string, data: Partial<Provider>) => void;
  removeProvider: (id: string) => Promise<void>;
  testConnection: (type: string, config: any) => Promise<{ success: boolean; info?: string }>;
  loadProviders: () => Promise<void>;
}

export const useProviders = create<ProvidersState>((set, get) => ({
  providers: [],
  loading: false,

  updateProvider: (id, data) => {
    set(s => ({
      providers: s.providers.map(p =>
        p.id === id ? { ...p, ...data, updatedAt: new Date() } : p
      ),
    }));
  },

  addProvider: async (type, name, config) => {
    try {
      const def = PROVIDER_DEFINITIONS[type];
      if (!window.electronAPI?.addProvider) {
        console.error('electronAPI.addProvider not available');
        return null;
      }
      const result = await window.electronAPI.addProvider({
        type,
        name: name || def.displayName,
        config: config || {},
        isEstimated: def.isConsumer,
      });
      console.log('addProvider IPC result:', result);
      if (result && result.id) {
        const provider: Provider = {
          id: result.id,
          type,
          name: name || def.displayName,
          displayIcon: def.icon,
          color: def.color,
          dataQuality: def.dataQuality,
          connectionMethod: def.connectionMethod,
          status: 'connected',
          isEstimated: def.isConsumer,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        set(s => ({ providers: [...s.providers, provider] }));
        return provider;
      }
      console.error('addProvider returned unexpected result:', result);
    } catch (err) {
      console.error('Failed to add provider:', err);
    }
    return null;
  },

  removeProvider: async (id) => {
    try {
      await (window as any).electronAPI?.removeProvider(id);
      set(s => ({ providers: s.providers.filter(p => p.id !== id) }));
    } catch (err) {
      console.error('Failed to remove provider:', err);
    }
  },

  testConnection: async (type, config) => {
    try {
      const result = await (window as any).electronAPI?.testConnection(type, config);
      return result || { success: false };
    } catch {
      return { success: false, info: 'Connection test failed' };
    }
  },

  loadProviders: async () => {
    set({ loading: true });
    try {
      const rows = await (window as any).electronAPI?.getProviders();
      if (rows) {
        const providers: Provider[] = rows.map((r: any) => {
          const def = PROVIDER_DEFINITIONS[r.type as ProviderType];
          return {
            id: r.id,
            type: r.type,
            name: r.name,
            displayIcon: def?.icon || '❓',
            color: def?.color || '#666',
            dataQuality: def?.dataQuality || 'exact',
            connectionMethod: def?.connectionMethod || 'api_key',
            status: r.status,
            isEstimated: !!r.is_estimated,
            createdAt: new Date(r.created_at),
            updatedAt: new Date(r.updated_at),
          };
        });
        set({ providers });
      }
    } catch (err) {
      console.error('Failed to load providers:', err);
    }
    set({ loading: false });
  },
}));
