import React from 'react';
import { useInstances } from '../store/useInstances';
import { useProviders } from '../store/useProviders';
import { UsageRing } from '../components/UsageRing';
import { Sparkline } from '../components/Sparkline';

/**
 * Widget View — for casual users
 * Simple, clean, no jargon. Shows "You sent / AI replied" language.
 */
export function Widget() {
  const { instances, totalCostToday, totalTokensToday } = useInstances();
  const { providers } = useProviders();

  const activeInstances = instances.filter(i => i.status === 'active');
  const hasEstimated = instances.some(i => i.provider?.isEstimated);

  // Aggregate sparkline from all instances
  const aggregateSparkline = instances.reduce<number[]>((acc, inst) => {
    inst.sparklineData.forEach((val, i) => {
      acc[i] = (acc[i] || 0) + val;
    });
    return acc;
  }, []);

  if (providers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <div className="text-6xl">📊</div>
        <h2 className="text-xl font-semibold">Welcome to Token Monitor</h2>
        <p className="text-gray-500 dark:text-gray-400 text-center max-w-sm">
          Connect your first AI provider to start tracking your usage.
        </p>
        <button
          onClick={() => {
            // Navigate to settings/add provider
            window.dispatchEvent(new CustomEvent('navigate', { detail: '/settings' }));
          }}
          className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
        >
          Add Provider
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-md mx-auto">
      {/* Main usage display */}
      <div className="flex flex-col items-center gap-4">
        <UsageRing
          used={totalCostToday}
          total={10} // Default budget, will be configurable
          size={140}
          label="today"
          sublabel={`$${totalCostToday.toFixed(4)} spent`}
        />
      </div>

      {/* Today's summary - plain language */}
      <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Today's Activity</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-2xl font-bold font-mono token-burn">
              {hasEstimated ? '~' : ''}{formatCompact(totalTokensToday)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Total tokens</div>
          </div>
          <div>
            <div className="text-2xl font-bold font-mono token-burn text-brand-600">
              {hasEstimated ? '~' : ''}${totalCostToday.toFixed(4)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Cost</div>
          </div>
        </div>

        {/* Sparkline */}
        {aggregateSparkline.length > 1 && (
          <div className="mt-4">
            <Sparkline data={aggregateSparkline} width={320} height={48} />
          </div>
        )}
      </div>

      {/* Active providers - simple list */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Providers</h3>
        {activeInstances.map(instance => (
          <div
            key={instance.id}
            className="flex items-center gap-3 p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800"
          >
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <div className="flex-1">
              <div className="text-sm font-medium">{instance.name}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {instance.provider?.isEstimated ? '~' : ''}
                {formatCompact(instance.totalInputTokens + instance.totalOutputTokens)} tokens
              </div>
            </div>
            <div className="text-sm font-mono font-semibold">
              {instance.provider?.isEstimated ? '~' : ''}${instance.totalCostUsd.toFixed(4)}
            </div>
          </div>
        ))}
      </div>

      {/* Estimated data disclaimer */}
      {hasEstimated && (
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
          ~ indicates estimated data from browser extension.
          Actual usage may differ by 10-25%.
        </p>
      )}
    </div>
  );
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}
