import React from "react";
import { Trash2, Calculator } from "lucide-react";

interface ActionButtonsProps {
  onScan: () => void;
  onClear: () => void;
  onOptimize: () => void;
  isLoading: boolean;
  hasResults: boolean;
  hasImage: boolean;
  optimizeCooldown?: boolean;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({
  onClear,
  onOptimize,
  hasResults,
  hasImage,
  optimizeCooldown = false,
}) => {
  return (
    <div className="flex flex-wrap gap-2 justify-center mt-4">
      <button
        onClick={onClear}
        disabled={!hasImage && !hasResults}
        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
      >
        <Trash2 className="h-5 w-5" />
        RESET
      </button>
      
      <div className="w-full mt-2 flex justify-center">
        <button
          onClick={onOptimize}
          disabled={!hasResults || optimizeCooldown}
          className={`flex items-center gap-2 px-4 py-2 text-white rounded-md transition-colors ${optimizeCooldown ? 'bg-gray-500 cursor-not-allowed' : 'bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 disabled:cursor-not-allowed'}`}
        >
          <Calculator className="h-5 w-5" />
          {optimizeCooldown ? 'Cooldown (3s)...' : 'Find Optimal Items For Cultist Circle'}
        </button>
        <div className="flex items-center ml-2">
          <div className="w-1 h-1 bg-gray-500 rounded-full mx-2"></div>
          <span className="text-sm text-gray-600 dark:text-gray-400 max-w-xs">
            Calculates the optimal combination of items worth at least 400,000 roubles. Rewards include high-value items (14h cooldown) or a 25% chance of Quest/Hideout items (6h cooldown).
          </span>
        </div>
      </div>
    </div>
  );
};

export default ActionButtons;
