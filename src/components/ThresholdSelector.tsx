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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
        Loot Value Threshold
      </h3>
      <div className="space-y-3">
        {(['high-value', 'quest'] as LootThreshold[]).map((key) => (
          <label key={key} className="flex items-center space-x-3 cursor-pointer">
            <input
              type="radio"
              name="threshold"
              value={key}
              checked={threshold === key}
              onChange={(e) => onThresholdChange(e.target.value as LootThreshold)}
              className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {THRESHOLD_CONFIG[key].label}
              {key === 'quest' && ` (${(THRESHOLD_CONFIG.quest.chance * 100)}% for ${THRESHOLD_CONFIG.quest.altTime}h)`}
            </span>
          </label>
        ))}
      </div>
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        Items will be processed based on their value and the selected threshold.
      </p>
    </div>
  );
};


