import { create } from 'zustand';
import type { Instance, UsageEventV1 } from '@token-monitor/shared';

interface InstancesState {
  instances: Instance[];
  totalCostToday: number;
  totalTokensToday: number;
  recentEvents: UsageEventV1[];

  loadInstances: () => Promise<void>;
  handleUsageEvent: (event: UsageEventV1) => void;
  getInstanceById: (id: string) => Instance | undefined;
}

export const useInstances = create<InstancesState>((set, get) => ({
  instances: [],
  totalCostToday: 0,
  totalTokensToday: 0,
  recentEvents: [],

  loadInstances: async () => {
    try {
      const instances = await (window as any).electronAPI?.getInstances();
      if (instances) {
        set({ instances });
        // Calculate totals
        const totalCostToday = instances.reduce((sum: number, i: Instance) => sum + i.totalCostUsd, 0);
        const totalTokensToday = instances.reduce(
          (sum: number, i: Instance) => sum + i.totalInputTokens + i.totalOutputTokens, 0
        );
        set({ totalCostToday, totalTokensToday });
      }
    } catch (err) {
      console.error('Failed to load instances:', err);
    }
  },

  handleUsageEvent: (event) => {
    set(state => {
      const key = event.instanceId || event.providerId;
      const existing = state.instances.find(i => i.id === key);

      let updatedInstances: Instance[];

      if (existing) {
        updatedInstances = state.instances.map(i => {
          if (i.id !== key) return i;
          const sparkline = [...i.sparklineData, event.costUsd || 0];
          if (sparkline.length > 30) sparkline.shift();
          return {
            ...i,
            totalInputTokens: i.totalInputTokens + (event.inputTokens || 0),
            totalOutputTokens: i.totalOutputTokens + (event.outputTokens || 0),
            totalCostUsd: i.totalCostUsd + (event.costUsd || 0),
            requestCount: i.requestCount + 1,
            model: event.model || i.model,
            status: 'active' as const,
            lastActivityAt: new Date(event.ts),
            sparklineData: sparkline,
          };
        });
      } else {
        const newInstance: Instance = {
          id: key,
          provider: {} as any, // Will be enriched by the engine
          name: event.instanceId || event.provider,
          model: event.model || 'unknown',
          status: 'active',
          totalInputTokens: event.inputTokens || 0,
          totalOutputTokens: event.outputTokens || 0,
          totalCostUsd: event.costUsd || 0,
          requestCount: 1,
          sparklineData: [event.costUsd || 0],
          startedAt: new Date(event.ts),
          lastActivityAt: new Date(event.ts),
        };
        updatedInstances = [...state.instances, newInstance];
      }

      // Keep recent events (last 100)
      const recentEvents = [event, ...state.recentEvents].slice(0, 100);

      const totalCostToday = updatedInstances.reduce((sum, i) => sum + i.totalCostUsd, 0);
      const totalTokensToday = updatedInstances.reduce(
        (sum, i) => sum + i.totalInputTokens + i.totalOutputTokens, 0
      );

      return {
        instances: updatedInstances,
        recentEvents,
        totalCostToday,
        totalTokensToday,
      };
    });
  },

  getInstanceById: (id) => {
    return get().instances.find(i => i.id === id);
  },
}));
