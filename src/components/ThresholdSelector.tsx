import React from 'react';
import { LootThreshold, THRESHOLD_CONFIG } from '../types/loot';

interface ThresholdSelectorProps {
  threshold: LootThreshold;
  onThresholdChange: (threshold: LootThreshold) => void;
}

export const ThresholdSelector: React.FC<ThresholdSelectorProps> = ({
  threshold,
  onThresholdChange,
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
        Loot Value Threshold
      </h3>
      <div className="space-y-2">
        {Object.entries(THRESHOLD_CONFIG).map(([key, config]) => (
          <div key={key} className="flex items-center">
            <input
              id={`threshold-${key}`}
              name="loot-threshold"
              type="radio"
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 dark:bg-gray-700"
              checked={threshold === key}
              onChange={() => onThresholdChange(key as LootThreshold)}
            />
            <label
              htmlFor={`threshold-${key}`}
              className="ml-3 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              {config.label} - {config.time} hours
              {key === 'quest' && ` (${(THRESHOLD_CONFIG.quest.chance * 100)}% for ${THRESHOLD_CONFIG.quest.altTime}h)`}
            </label>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        Items will be processed based on their value and the selected threshold.
      </p>
    </div>
  );
};


