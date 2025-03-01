import React from 'react';

interface ProcessingOverlayProps {
  isLoading: boolean;
  progress: number;
}

const ProcessingOverlay: React.FC<ProcessingOverlayProps> = ({
  isLoading,
  progress,
}) => {
  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4">
        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4 dark:bg-gray-700">
          <div
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 dark:border-blue-400"></div>
          <span className="mt-2 text-gray-700 dark:text-gray-300">
            {progress < 100
              ? `Processing image... ${Math.round(progress)}%`
              : "Finalizing results..."}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ProcessingOverlay;
