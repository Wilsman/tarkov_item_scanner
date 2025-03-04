import React, { useState } from "react";
import { Moon, Sun } from "lucide-react";
// import { TesseractSettings } from '../App';
import { useTheme } from "../contexts/ThemeContext";

interface SettingsPanelProps {
  ocrMethod: "tesseract" | "cleanTesseract" | "googleVision" | "gemini";
  toggleOcrMethod: (
    method: "tesseract" | "cleanTesseract" | "googleVision" | "gemini"
  ) => void;
  googleVisionApiKey: string;
  setGoogleVisionApiKey: (key: string) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  ocrMethod,
  toggleOcrMethod,
  googleVisionApiKey,
  setGoogleVisionApiKey,
}) => {
  const { theme, toggleTheme } = useTheme();
  const [testingGemini, setTestingGemini] = useState(false);
  const [geminiTestResult, setGeminiTestResult] = useState<string | null>(null);

  const testGeminiWorker = async () => {
    setTestingGemini(true);
    setGeminiTestResult(null);
    
    try {
      // Get the worker URL
      const isLocalDev = import.meta.env.DEV;
      const workerUrl = isLocalDev
        ? "http://127.0.0.1:8787" // Local development URL
        : import.meta.env.VITE_GEMINI_WORKER_URL ||
          "https://gemini-ocr-worker.cultistcircle.workers.dev"; // Production URL
      
      console.log("Testing Gemini worker at:", workerUrl);
      
      // Test the health endpoint
      const response = await fetch(`${workerUrl}/health`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      if (response.ok) {
        setGeminiTestResult("Connection successful! Worker is online.");
      } else {
        const errorText = await response.text();
        setGeminiTestResult(`Connection failed: ${response.status} ${response.statusText} - ${errorText}`);
      }
    } catch (error) {
      console.error("Error testing Gemini worker:", error);
      setGeminiTestResult(`Connection error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setTestingGemini(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          Settings
        </h3>
        <button
          onClick={toggleTheme}
          className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200"
          aria-label="Toggle dark mode"
        >
          {theme === "dark" ? (
            <Sun className="h-5 w-5 text-gray-900 dark:text-white" />
          ) : (
            <Moon className="h-5 w-5 text-gray-900 dark:text-white" />
          )}
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
            OCR Method
          </label>
          <div className="space-y-2">
            <div className="flex items-center">
              <input
                type="radio"
                id="gemini"
                name="ocr-method"
                value="gemini"
                checked={ocrMethod === "gemini"}
                onChange={() => toggleOcrMethod("gemini")}
                className="form-radio text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-600"
              />
              <label
                htmlFor="gemini"
                className="ml-2 text-gray-700 dark:text-gray-300"
              >
                Gemini 2.0 (API)
              </label>
            </div>
            <div className="flex items-center">
              <input
                type="radio"
                id="clean-tesseract"
                name="ocr-method"
                value="cleanTesseract"
                checked={ocrMethod === "cleanTesseract"}
                onChange={() => toggleOcrMethod("cleanTesseract")}
                className="form-radio text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-600"
              />
              <label
                htmlFor="clean-tesseract"
                className="ml-2 text-gray-700 dark:text-gray-300"
              >
                Tesseract (local)
              </label>
            </div>
            <div className="flex items-center">
              <input
                type="radio"
                id="google-vision"
                name="ocr-method"
                value="googleVision"
                checked={ocrMethod === "googleVision"}
                onChange={() => toggleOcrMethod("googleVision")}
                className="form-radio text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-600"
              />
              <label
                htmlFor="google-vision"
                className="ml-2 text-gray-700 dark:text-gray-300"
              >
                Google Cloud Vision (API)
              </label>
            </div>
          </div>
        </div>

        {ocrMethod === "googleVision" && (
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Google Vision API Key
            </label>
            <div className="flex items-center space-x-2">
              <span className="text-gray-500 dark:text-gray-400">
                {googleVisionApiKey
                  ? `${googleVisionApiKey.substring(
                      0,
                      4
                    )}...${googleVisionApiKey.substring(
                      googleVisionApiKey.length - 4
                    )}`
                  : "No API key set"}
              </span>
              <button
                onClick={() => {
                  const key = prompt("Enter Google Vision API Key");
                  if (key !== null) {
                    setGoogleVisionApiKey(key);
                  }
                }}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors duration-200"
              >
                {googleVisionApiKey ? "Change" : "Set API Key"}
              </button>
            </div>
          </div>
        )}

        {ocrMethod === "gemini" && (
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Gemini Worker Connection
            </label>
            <div className="flex flex-col space-y-2">
              <button
                onClick={testGeminiWorker}
                disabled={testingGemini}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors duration-200"
              >
                {testingGemini ? "Testing..." : "Test Connection"}
              </button>
              
              {geminiTestResult && (
                <div className={`mt-2 p-2 rounded ${geminiTestResult.includes("successful") ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                  {geminiTestResult}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPanel;
