// Configuration for OCR services

// Set this to your deployed Cloud Run URL
// If you're using an existing Cloud Run instance, replace this with your URL
export const EASYOCR_CLOUD_FUNCTION_URL = process.env.NODE_ENV === 'production' 
  ? 'https://easyocr-421898904754.us-central1.run.app' // Replace with your actual Cloud Run URL
  : 'http://127.0.0.1:5000/api/ocr';

// Helper function to get the appropriate EasyOCR endpoint
export function getEasyOCREndpoint(): string {
  return EASYOCR_CLOUD_FUNCTION_URL;
}
