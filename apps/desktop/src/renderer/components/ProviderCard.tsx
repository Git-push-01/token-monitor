import React from 'react';
import type { Instance } from '@token-monitor/shared';
import { Sparkline } from './Sparkline';
import { PROVIDER_DEFINITIONS } from '@token-monitor/shared';

interface ProviderCardProps {
  instance: Instance;
  compact?: boolean;
  onClick?: () => void;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatCost(usd: number): string {
  if (usd >= 100) return `$${usd.toFixed(0)}`;
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  if (usd >= 0.01) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(4)}`;
}

export function ProviderCard({ instance, compact, onClick }: ProviderCardProps) {
  const providerType = instance.provider?.type;
  const def = providerType ? PROVIDER_DEFINITIONS[providerType] : null;
  const isEstimated = instance.provider?.isEstimated;

  const statusColor =
    instance.status === 'active' ? 'bg-green-500' :
    instance.status === 'error' ? 'bg-red-500' :
    instance.status === 'paused' ? 'bg-yellow-500' :
    'bg-gray-400';

  if (compact) {
    return (
      <button
        onClick={onClick}
        className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-brand-400 transition-colors w-full text-left"
      >
        <span className="text-lg">{def?.icon || '❓'}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{instance.name}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {isEstimated ? '~' : ''}{formatCost(instance.totalCostUsd)}
          </div>
        </div>
        <div className={`w-2 h-2 rounded-full ${statusColor}`} />
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="flex flex-col gap-3 p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-brand-400 hover:shadow-md transition-all w-full text-left"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{def?.icon || '❓'}</span>
          <div>
            <div className="text-sm font-semibold">{instance.name}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
              {instance.model}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {isEstimated && (
            <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded font-medium" title="Estimated data (~85% accurate)">
              ~
            </span>
          )}
          <div className={`w-2 h-2 rounded-full ${statusColor}`} />
        </div>
      </div>

      {/* Sparkline */}
      <Sparkline
        data={instance.sparklineData}
        width={200}
        height={40}
        color={def?.color || '#5c7cfa'}
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Input</div>
          <div className="text-sm font-semibold font-mono token-burn">
            {isEstimated ? '~' : ''}{formatTokens(instance.totalInputTokens)}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Output</div>
          <div className="text-sm font-semibold font-mono token-burn">
            {isEstimated ? '~' : ''}{formatTokens(instance.totalOutputTokens)}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Cost</div>
          <div className="text-sm font-semibold font-mono token-burn" style={{ color: def?.color }}>
            {isEstimated ? '~' : ''}{formatCost(instance.totalCostUsd)}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
        <span>{instance.requestCount} requests</span>
        <span>{timeSince(instance.lastActivityAt)} ago</span>
      </div>
    </button>
  );
}

function timeSince(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}
