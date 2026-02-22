import React from 'react';
import { useInstances } from '../store/useInstances';
import { useProviders } from '../store/useProviders';
import { ProviderCard } from '../components/ProviderCard';

/**
 * Grid View — for builders
 * Multi-instance grid with sparklines, token counts, cost per session
 */
export function Grid() {
  const { instances, totalCostToday, totalTokensToday } = useInstances();
  const { providers } = useProviders();

  const sortedInstances = [...instances].sort(
    (a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()
  );

  if (providers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <div className="text-6xl">🛠</div>
        <h2 className="text-xl font-semibold">No providers connected</h2>
        <p className="text-gray-500 dark:text-gray-400 text-center max-w-sm">
          Add your API keys and connect providers to see your token usage across all services.
        </p>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: '/settings' }))}
          className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
        >
          Connect Providers
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
        <div className="flex gap-6">
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Active</div>
            <div className="text-lg font-bold">{instances.filter(i => i.status === 'active').length}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Tokens Today</div>
            <div className="text-lg font-bold font-mono">{formatLarge(totalTokensToday)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Cost Today</div>
            <div className="text-lg font-bold font-mono text-brand-600">
              ${totalCostToday.toFixed(4)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Providers</div>
            <div className="text-lg font-bold">{providers.length}</div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: '/settings' }))}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Settings"
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* Instance grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {sortedInstances.map(instance => (
          <ProviderCard
            key={instance.id}
            instance={instance}
          />
        ))}
      </div>

      {/* Empty instances placeholder */}
      {instances.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-12 text-gray-400 dark:text-gray-500">
          <div className="text-4xl">📡</div>
          <p className="text-sm">Waiting for usage data...</p>
          <p className="text-xs">Make API calls, open Claude Code, or use AI tools to see data here</p>
        </div>
      )}
    </div>
  );
}

function formatLarge(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}
