import React from 'react';

interface BudgetBarProps {
  name: string;
  current: number;
  limit: number;
  period: string;
}

export function BudgetBar({ name, current, limit, period }: BudgetBarProps) {
  const percent = limit > 0 ? Math.min((current / limit) * 100, 100) : 0;

  const barColor =
    percent >= 100 ? 'bg-red-500' :
    percent >= 90 ? 'bg-red-400' :
    percent >= 75 ? 'bg-amber-500' :
    'bg-brand-500';

  return (
    <div className="p-3 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">{name}</span>
        <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">{period}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="text-xs font-mono text-gray-600 dark:text-gray-300 whitespace-nowrap">
          ${current.toFixed(2)} / ${limit.toFixed(2)}
        </span>
      </div>
      {percent >= 90 && (
        <p className="mt-1 text-xs text-red-500 dark:text-red-400">
          ⚠️ {percent >= 100 ? 'Budget exceeded!' : 'Approaching budget limit'}
        </p>
      )}
    </div>
  );
}
