import React from 'react';
import { Item } from '../App';

interface ActionButtonsProps {
  setUploadedImage: (image: string | null) => void;
  setItemList: React.Dispatch<React.SetStateAction<Item[]>>;
  setOcrWords: React.Dispatch<React.SetStateAction<Array<{
    text: string;
    bbox: { x0: number; y0: number; x1: number; y1: number };
  }>>>;
  showOcrHighlights: boolean;
  setShowOcrHighlights: (show: boolean) => void;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({
  setUploadedImage,
  setItemList,
  setOcrWords,
  showOcrHighlights,
  setShowOcrHighlights,
}) => {
  const handleReset = () => {
    setUploadedImage(null);
    setItemList([]);
    setOcrWords([]);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <label className="inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={showOcrHighlights}
              onChange={() => setShowOcrHighlights(!showOcrHighlights)}
              className="sr-only peer"
            />
            <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            <span className="ml-3 text-sm font-medium text-gray-900 dark:text-white">
              Show OCR Highlights
            </span>
          </label>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors duration-200"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActionButtons;
