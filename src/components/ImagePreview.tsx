import React from 'react';

interface ImagePreviewProps {
  uploadedImage: string;
  imgRef: React.RefObject<HTMLImageElement>;
  ocrWords: Array<{
    text: string;
    bbox: { x0: number; y0: number; x1: number; y1: number };
  }>;
  showOcrHighlights: boolean;
  naturalSize: { width: number; height: number };
}

const ImagePreview: React.FC<ImagePreviewProps> = ({
  uploadedImage,
  imgRef,
  ocrWords,
  showOcrHighlights,
  naturalSize,
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
        Uploaded Image with OCR Results
      </h2>
      <div className="relative inline-block w-full">
        <img
          ref={imgRef}
          src={uploadedImage}
          alt="Uploaded screenshot"
          className="max-w-full h-auto border border-gray-300 dark:border-gray-600 rounded-lg"
          style={{ maxHeight: "600px" }}
        />
        {showOcrHighlights &&
          ocrWords.map((word, index) => {
            // If we don't yet know the natural size, skip drawing
            if (!naturalSize.width || !naturalSize.height) {
              return null;
            }
            // The actual displayed size
            const displayedWidth = imgRef.current?.clientWidth || 1;
            const displayedHeight = imgRef.current?.clientHeight || 1;

            // Scale factors for bounding boxes
            const scaleX = displayedWidth / naturalSize.width;
            const scaleY = displayedHeight / naturalSize.height;

            const x0 = word.bbox.x0 * scaleX;
            const y0 = word.bbox.y0 * scaleY;
            const w = (word.bbox.x1 - word.bbox.x0) * scaleX;
            const h = (word.bbox.y1 - word.bbox.y0) * scaleY;

            return (
              <div
                key={index}
                className="absolute border-2 border-green-500 bg-green-500 bg-opacity-20"
                style={{
                  left: `${x0}px`,
                  top: `${y0}px`,
                  width: `${w}px`,
                  height: `${h}px`,
                  zIndex: 10,
                }}
                title={word.text}
              />
            );
          })}
      </div>
    </div>
  );
};

export default ImagePreview;
