import React from 'react';

interface UsageRingProps {
  used: number;
  total: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
  sublabel?: string;
}

export function UsageRing({
  used,
  total,
  size = 100,
  strokeWidth = 8,
  color = '#5c7cfa',
  label,
  sublabel,
}: UsageRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percent = total > 0 ? Math.min(used / total, 1) : 0;
  const offset = circumference * (1 - percent);

  // Color based on usage level
  const ringColor =
    percent >= 0.9 ? '#ef4444' :
    percent >= 0.75 ? '#f59e0b' :
    color;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-gray-200 dark:text-gray-800"
        />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="transition-all duration-500 ease-out"
        />
        {/* Center text */}
        <text
          x={size / 2}
          y={size / 2 - 4}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-gray-900 dark:fill-gray-100 text-sm font-semibold"
          fontSize={size * 0.18}
        >
          {Math.round(percent * 100)}%
        </text>
        <text
          x={size / 2}
          y={size / 2 + 12}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-gray-500 dark:fill-gray-400"
          fontSize={size * 0.1}
        >
          {label || ''}
        </text>
      </svg>
      {sublabel && (
        <span className="text-xs text-gray-500 dark:text-gray-400">{sublabel}</span>
      )}
    </div>
  );
}
