import React from "react";
import { Scan, Trash2, Eye, EyeOff, Calculator } from "lucide-react";

interface ActionButtonsProps {
  onScan: () => void;
  onClear: () => void;
  onOptimize: () => void;
  showOcrHighlights: boolean;
  onToggleOcrHighlights: () => void;
  isLoading: boolean;
  hasResults: boolean;
  hasImage: boolean;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({
  onScan,
  onClear,
  onOptimize,
  showOcrHighlights,
  onToggleOcrHighlights,
  isLoading,
  hasResults,
  hasImage,
}) => {
  return (
    <div className="flex flex-wrap gap-2 justify-center mt-4">
      <button
        onClick={onScan}
        disabled={!hasImage || isLoading}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
      >
        <Scan className="h-5 w-5" />
        Scan Image
      </button>

      <button
        onClick={onClear}
        disabled={!hasImage && !hasResults}
        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
      >
        <Trash2 className="h-5 w-5" />
        RESET
      </button>


      {hasResults && (
        <button
          onClick={onToggleOcrHighlights}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
        >
          {showOcrHighlights ? (
            <>
              <EyeOff className="h-5 w-5" />
              Hide OCR
            </>
          ) : (
            <>
              <Eye className="h-5 w-5" />
              Show OCR
            </>
          )}
        </button>
      )}
      
      <div className="w-full mt-2 flex justify-center">
        <button
          onClick={onOptimize}
          disabled={!hasResults}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          <Calculator className="h-5 w-5" />
          Find Optimal Items For Cultist Circle
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
