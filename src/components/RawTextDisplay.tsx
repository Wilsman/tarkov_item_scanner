import React from 'react';

interface RawTextDisplayProps {
  ocrWords: Array<{
    text: string;
    bbox: { x0: number; y0: number; x1: number; y1: number };
  }>;
}

const RawTextDisplay: React.FC<RawTextDisplayProps> = ({ ocrWords }) => {
  const rawText = ocrWords.map(word => word.text).join(' ');

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
        Raw OCR Text
      </h3>
      <div className="bg-gray-50 dark:bg-gray-700 rounded p-4">
        <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">
          {rawText}
        </pre>
      </div>
    </div>
  );
};

export default RawTextDisplay;
