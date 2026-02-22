import React, { useState } from 'react';
import { useInstances } from '../store/useInstances';
import { useProviders } from '../store/useProviders';
import { ProviderCard } from '../components/ProviderCard';
import { BudgetBar } from '../components/BudgetBar';
import { Sparkline } from '../components/Sparkline';

/**
 * Command Center View — for power users
 * Full dashboard with budget alerts, provider breakdowns, event log
 */
export function CommandCenter() {
  const { instances, totalCostToday, totalTokensToday, recentEvents } = useInstances();
  const { providers } = useProviders();
  const [activeTab, setActiveTab] = useState<'instances' | 'events' | 'analytics'>('instances');

  const sortedInstances = [...instances].sort(
    (a, b) => b.totalCostUsd - a.totalCostUsd
  );

  const totalRequests = instances.reduce((sum, i) => sum + i.requestCount, 0);
  const totalInput = instances.reduce((sum, i) => sum + i.totalInputTokens, 0);
  const totalOutput = instances.reduce((sum, i) => sum + i.totalOutputTokens, 0);

  // Provider breakdown
  const providerBreakdown = providers.map(p => {
    const providerInstances = instances.filter(i => i.provider?.id === p.id);
    return {
      ...p,
      cost: providerInstances.reduce((sum, i) => sum + i.totalCostUsd, 0),
      tokens: providerInstances.reduce((sum, i) => sum + i.totalInputTokens + i.totalOutputTokens, 0),
      requests: providerInstances.reduce((sum, i) => sum + i.requestCount, 0),
    };
  }).sort((a, b) => b.cost - a.cost);

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-auto">
      {/* Top stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard label="Cost Today" value={`$${totalCostToday.toFixed(4)}`} color="text-brand-600" />
        <StatCard label="Tokens Today" value={formatLarge(totalTokensToday)} />
        <StatCard label="Input Tokens" value={formatLarge(totalInput)} />
        <StatCard label="Output Tokens" value={formatLarge(totalOutput)} />
        <StatCard label="Requests" value={totalRequests.toString()} />
        <StatCard label="Active" value={`${instances.filter(i => i.status === 'active').length}/${instances.length}`} />
      </div>

      {/* Budget alerts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <BudgetBar name="Daily Spend" current={totalCostToday} limit={10} period="daily" />
        <BudgetBar name="Monthly Spend" current={totalCostToday * 30} limit={100} period="monthly" />
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
        {(['instances', 'events', 'analytics'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-sm rounded-md capitalize transition-colors ${
              activeTab === tab
                ? 'bg-white dark:bg-gray-900 shadow-sm font-medium'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'instances' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {sortedInstances.map(instance => (
            <ProviderCard key={instance.id} instance={instance} />
          ))}
        </div>
      )}

      {activeTab === 'events' && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="overflow-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Provider</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Model</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Input</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Output</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Cost</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Quality</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {recentEvents.map(event => (
                  <tr key={event.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 token-burn">
                    <td className="px-3 py-2 font-mono text-xs text-gray-500">
                      {new Date(event.ts).toLocaleTimeString()}
                    </td>
                    <td className="px-3 py-2">{event.provider}</td>
                    <td className="px-3 py-2 font-mono text-xs">{event.model || '—'}</td>
                    <td className="px-3 py-2 text-right font-mono">{event.inputTokens?.toLocaleString() || '—'}</td>
                    <td className="px-3 py-2 text-right font-mono">{event.outputTokens?.toLocaleString() || '—'}</td>
                    <td className="px-3 py-2 text-right font-mono text-brand-600">
                      {event.costUsd ? `$${event.costUsd.toFixed(6)}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-block px-1.5 py-0.5 text-xs rounded ${
                        event.quality === 'exact'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                      }`}>
                        {event.quality === 'exact' ? '✓' : '~'}
                      </span>
                    </td>
                  </tr>
                ))}
                {recentEvents.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                      No events yet — waiting for usage data
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="space-y-4">
          {/* Provider breakdown */}
          <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
            <h3 className="text-sm font-semibold mb-3">Cost by Provider</h3>
            <div className="space-y-3">
              {providerBreakdown.map(p => {
                const maxCost = Math.max(...providerBreakdown.map(x => x.cost), 0.001);
                return (
                  <div key={p.id} className="flex items-center gap-3">
                    <span className="text-sm w-28 truncate">{p.name}</span>
                    <div className="flex-1 h-4 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${(p.cost / maxCost) * 100}%`,
                          backgroundColor: p.color,
                        }}
                      />
                    </div>
                    <span className="text-sm font-mono w-20 text-right">${p.cost.toFixed(4)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Placeholder for more analytics */}
          <div className="flex flex-col items-center gap-2 py-8 text-gray-400 dark:text-gray-500">
            <div className="text-3xl">📈</div>
            <p className="text-sm">More analytics coming in Pro+</p>
            <p className="text-xs">Cost forecasting, trend analysis, team dashboards</p>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl p-3 border border-gray-200 dark:border-gray-800">
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className={`text-lg font-bold font-mono ${color || ''}`}>{value}</div>
    </div>
  );
}

function formatLarge(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}
