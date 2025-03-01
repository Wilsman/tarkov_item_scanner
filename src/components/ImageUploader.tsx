import React from 'react';

interface ImageUploaderProps {
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  isDragging: boolean;
  setIsDragging: (dragging: boolean) => void;
  isCtrlPressed: boolean;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({
  onFileUpload,
  isDragging,
  setIsDragging,
  isCtrlPressed,
}) => {
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const event = {
        target: {
          files: files,
        },
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      onFileUpload(event);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
        Upload your inventory screenshot
      </label>
      <div className="flex items-center justify-center w-full">
        <label
          className={`flex flex-col w-full h-32 border-2 border-dashed rounded-lg cursor-pointer ${
            isDragging
              ? "border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-gray-700"
              : isCtrlPressed
              ? "border-green-500 bg-green-50 dark:border-green-500 dark:bg-gray-700"
              : "border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
          } transition-colors duration-200`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <svg
              className="w-10 h-10 text-gray-500 dark:text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              ></path>
            </svg>
            <p className="mb-1 text-sm text-gray-600 dark:text-gray-400">
              <span className="font-semibold">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">PNG, JPG, or JPEG</p>
            <p className={`text-xs mt-1 ${isCtrlPressed ? "font-bold text-green-500" : "text-gray-500 dark:text-gray-400"}`}>
              <span className="font-semibold">Or press Ctrl+V</span> to paste from clipboard
            </p>
          </div>
          <input
            type="file"
            className="hidden"
            accept="image/*"
            onChange={onFileUpload}
          />
        </label>
      </div>
    </div>
  );
};

export default ImageUploader;
