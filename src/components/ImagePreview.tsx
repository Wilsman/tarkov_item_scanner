import React from 'react';

interface ImagePreviewProps {
  uploadedImage: string;
  imgRef: React.RefObject<HTMLImageElement>;
  ocrWords: Array<{
    text: string;
    bbox: { x0: number; y0: number; x1: number; y1: number };
  }>;
  naturalSize: { width: number; height: number };
}

const ImagePreview: React.FC<ImagePreviewProps> = ({
  uploadedImage,
  imgRef,
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
        Uploaded Image
      </h2>
      <div className="relative inline-block w-full">
        <img
          ref={imgRef}
          src={uploadedImage}
          alt="Uploaded screenshot"
          className="max-w-full h-auto border border-gray-300 dark:border-gray-600 rounded-lg"
          style={{ maxHeight: "600px" }}
        />
      </div>
    </div>
  );
};

export default ImagePreview;
