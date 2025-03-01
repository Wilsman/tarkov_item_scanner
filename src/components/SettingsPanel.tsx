import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { TesseractSettings } from '../App';
import { useTheme } from '../contexts/ThemeContext';

interface SettingsPanelProps {
  ocrMethod: "tesseract" | "cleanTesseract" | "googleVision";
  toggleOcrMethod: (method: "tesseract" | "cleanTesseract" | "googleVision") => void;
  googleVisionApiKey: string;
  showApiKeyInput: boolean;
  toggleApiKeyInput: () => void;
  saveApiKey: (key: string) => void;
  tesseractSettings: TesseractSettings;
  setTesseractSettings: React.Dispatch<React.SetStateAction<TesseractSettings>>;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  ocrMethod,
  toggleOcrMethod,
  googleVisionApiKey,
  showApiKeyInput,
  toggleApiKeyInput,
  saveApiKey,
  tesseractSettings,
  setTesseractSettings,
}) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Settings</h3>
        <button
          onClick={toggleTheme}
          className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200"
          aria-label="Toggle dark mode"
        >
          {theme === 'dark' ? (
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
                id="tesseract"
                name="ocr-method"
                value="tesseract"
                checked={ocrMethod === "tesseract"}
                onChange={() => toggleOcrMethod("tesseract")}
                className="form-radio text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-600"
              />
              <label htmlFor="tesseract" className="ml-2 text-gray-700 dark:text-gray-300">
                Tesseract (Advanced)
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
              <label htmlFor="clean-tesseract" className="ml-2 text-gray-700 dark:text-gray-300">
                Tesseract (Simple)
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
              <label htmlFor="google-vision" className="ml-2 text-gray-700 dark:text-gray-300">
                Google Cloud Vision (API)
              </label>
            </div>
          </div>
        </div>

        {ocrMethod === "googleVision" && (
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              API Key
            </label>
            {showApiKeyInput ? (
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={googleVisionApiKey}
                  onChange={(e) => saveApiKey(e.target.value)}
                  placeholder="Enter Google Vision API Key"
                  className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600"
                />
                <button
                  onClick={() => saveApiKey(googleVisionApiKey)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200"
                >
                  Save
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <span className="text-gray-500 dark:text-gray-400">
                  {googleVisionApiKey
                    ? `${googleVisionApiKey.substring(0, 4)}...${googleVisionApiKey.substring(
                        googleVisionApiKey.length - 4
                      )}`
                    : "No API key set"}
                </span>
                <button
                  onClick={toggleApiKeyInput}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors duration-200"
                >
                  {googleVisionApiKey ? "Change" : "Set API Key"}
                </button>
              </div>
            )}
          </div>
        )}

        {ocrMethod === "tesseract" && (
          <div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Tesseract Settings
            </h4>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Page Segmentation Mode
                </label>
                <select
                  className="w-full mt-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600"
                  value={tesseractSettings.tessedit_pageseg_mode}
                  onChange={(e) =>
                    setTesseractSettings((prev) => ({
                      ...prev,
                      tessedit_pageseg_mode: e.target.value,
                    }))
                  }
                >
                  <option value="6">Uniform text block</option>
                  <option value="3">Column</option>
                  <option value="4">Single block</option>
                  <option value="5">Single column</option>
                  <option value="7">Single line</option>
                  <option value="8">Single word</option>
                  <option value="9">Single word in circle</option>
                  <option value="10">Single character</option>
                  <option value="11">Sparse text</option>
                  <option value="12">Sparse text with OSD</option>
                  <option value="13">Raw line</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  OCR Engine Mode
                </label>
                <select
                  className="w-full mt-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600"
                  value={tesseractSettings.tessedit_ocr_engine_mode}
                  onChange={(e) =>
                    setTesseractSettings((prev) => ({
                      ...prev,
                      tessedit_ocr_engine_mode: e.target.value,
                    }))
                  }
                >
                  <option value="0">Legacy engine</option>
                  <option value="1">Neural nets LSTM</option>
                  <option value="2">Legacy + LSTM</option>
                  <option value="3">Default</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Create HOCR
                </label>
                <select
                  className="w-full mt-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600"
                  value={tesseractSettings.tessjs_create_hocr}
                  onChange={(e) =>
                    setTesseractSettings((prev) => ({
                      ...prev,
                      tessjs_create_hocr: e.target.value,
                    }))
                  }
                >
                  <option value="0">Disabled</option>
                  <option value="1">Enabled</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Create TSV
                </label>
                <select
                  className="w-full mt-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600"
                  value={tesseractSettings.tessjs_create_tsv}
                  onChange={(e) =>
                    setTesseractSettings((prev) => ({
                      ...prev,
                      tessjs_create_tsv: e.target.value,
                    }))
                  }
                >
                  <option value="0">Disabled</option>
                  <option value="1">Enabled</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPanel;
