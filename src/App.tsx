import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { Database, Scan, AlertCircle } from "lucide-react";
import { findOptimalItems } from "./lib/itemOptimizer";
import { ItemData } from "./data/items";
import { ThemeProvider } from "./contexts/ThemeContext";

// Components
import ImageUploader from "./components/ImageUploader";
import ImagePreview from "./components/ImagePreview";
import SettingsPanel from "./components/SettingsPanel";
import ResultsTable from "./components/ResultsTable";
import ProcessingOverlay from "./components/ProcessingOverlay";
// import RawTextDisplay from "./components/RawTextDisplay";
import ActionButtons from "./components/ActionButtons";

interface Item {
  id: string;
  name: string;
  shortName: string;
  iconLink?: string;
  wikiLink?: string;
  imageLink?: string;
  gridImageLink?: string;
  quantity: number;
  basePrice: number;
  avg24hPrice: number | null;
}

const processOcrText = (ocrText: string, items: ItemData[]): Item[] => {
  console.log("Processing OCR results...");
  // Split by newlines to process each line separately
  const lines = ocrText.split("\n").filter((line) => line.trim().length > 0);
  console.log(`Found ${lines.length} text lines to process`);

  // Process each line to extract item information
  const detectedItems = new Map<string, Item>();

  // Process each line for structured format, e.g. "RBattery: 3"
  for (const line of lines) {
    // Try to match pattern like "ItemName: Quantity"
    const quantityMatch = line.match(/([^:]+):\s*(\d+)/);
    if (quantityMatch) {
      const [, itemName, quantityStr] = quantityMatch;
      const quantity = parseInt(quantityStr, 10);
      const cleanedItemName = itemName.trim();

      // Try to find the item in the items list using exact match
      let foundItem = false;
      for (const item of items) {
        if (cleanedItemName.toLowerCase() === item.shortName.toLowerCase()) {
          updateDetectedItems(detectedItems, item, quantity);
          foundItem = true;
          break;
        }
      }

      // If we couldn't find the item in our database, create a placeholder item
      if (!foundItem && quantity > 0) {
        const placeholderId = `unknown-${cleanedItemName}`;
        updateDetectedItems(
          detectedItems,
          {
            id: placeholderId,
            name: cleanedItemName,
            shortName: cleanedItemName,
            basePrice: 0,
            avg24hPrice: null,
          },
          quantity
        );
      }

      // Skip further processing for this line since we've handled it
      continue;
    }

    // If no quantity pattern found, fall back to word-by-word processing
    const words = line.split(/\s+/).filter((word) => word.length > 0);
    for (const word of words) {
      const cleanedWord = word.replace(/[^\w]/g, "").toLowerCase();
      if (cleanedWord.length < 2) continue; // Skip very short words

      for (const item of items) {
        // Check for an exact match after stripping spaces
        if (cleanedWord === item.shortName.toLowerCase().replace(/\s+/g, "")) {
          updateDetectedItems(detectedItems, item);
          break;
        }
      }
    }
  }

  console.log(`Detected ${detectedItems.size} unique items`);
  return Array.from(detectedItems.values());
};

const updateDetectedItems = (
  detectedItems: Map<string, Item>,
  itemData: ItemData,
  quantity = 1
) => {
  if (detectedItems.has(itemData.id)) {
    const existingItem = detectedItems.get(itemData.id)!;
    existingItem.quantity += quantity;
  } else {
    detectedItems.set(itemData.id, {
      id: itemData.id,
      name: itemData.name,
      shortName: itemData.shortName,
      iconLink: itemData.iconLink,
      wikiLink: itemData.wikiLink,
      imageLink: itemData.imageLink,
      gridImageLink: itemData.gridImageLink,
      basePrice: itemData.basePrice,
      quantity,
      avg24hPrice: itemData.avg24hPrice,
    });
  }
};

const processImageWithGemini = async (
  imageData: string | File,
  onProgress: (progress: number) => void
): Promise<{
  text: string;
  words: Array<{
    text: string;
    bbox: { x0: number; y0: number; x1: number; y1: number };
  }>;
}> => {
  try {
    onProgress(10);
    console.log("Starting Gemini image processing");

    // Convert File to base64 if needed
    let base64Data: string;
    if (imageData instanceof File) {
      console.log("Converting File to base64");
      base64Data = await fileToBase64(imageData);
      console.log(`Converted file to base64 (length: ${base64Data.length})`);
    } else if (
      typeof imageData === "string" &&
      (imageData.startsWith("blob:") || imageData.startsWith("http"))
    ) {
      console.log("Converting URL to base64");
      // Handle URL objects by fetching and converting to base64
      const response = await fetch(imageData);
      const blob = await response.blob();
      base64Data = await fileToBase64(new File([blob], "image.jpg"));
      console.log(`Converted URL to base64 (length: ${base64Data.length})`);
    } else {
      // Already a base64 string
      console.log("Using provided base64 data");
      base64Data = imageData as string;
    }

    onProgress(20);

    // Determine the worker URL based on the environment
    const isLocalDev = import.meta.env.DEV;
    const workerUrl = isLocalDev
      ? "http://127.0.0.1:8787" // Local development URL
      : import.meta.env.VITE_GEMINI_WORKER_URL ||
        "https://gemini-ocr-worker.cultistcircle.workers.dev"; // Production URL

    console.log("Using worker URL:", workerUrl);
    onProgress(30);

    // Prepare the request payload
    const payload = {
      imageData: base64Data,
    };
    console.log(
      `Sending request to worker with payload size: ${
        JSON.stringify(payload).length
      }`
    );

    // Send the image data to the worker
    console.log("Sending request to Gemini worker");
    const response = await fetch(workerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    console.log(
      `Received response from worker: ${response.status} ${response.statusText}`
    );

    onProgress(70);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Worker error response:", errorText);

      let errorMessage = response.statusText;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error || response.statusText;
      } catch (e) {
        // If parsing fails, use the raw text
        errorMessage = errorText || response.statusText;
      }
      throw new Error(`Worker error: ${errorMessage} (${response.status})`);
    }

    // Parse the response
    console.log("Parsing worker response");
    const result = await response.json();
    console.log("Worker response parsed successfully");

    onProgress(100);

    return result;
  } catch (error) {
    console.error("Error processing image with Gemini worker:", error);
    throw error;
  }
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64Data = result.split(",")[1];
      resolve(base64Data);
    };
    reader.onerror = (error) => {
      console.error("Error converting file to base64:", error);
      reject(error);
    };
  });
};

const AppContent: React.FC = () => {
  const [itemData, setItemData] = useState<ItemData[]>([]);
  const [itemList, setItemList] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [ocrMethod, setOcrMethod] = useState<"gemini">(() => {
    const savedMethod = localStorage.getItem("ocrMethod");
    return (savedMethod as "gemini") || "gemini";
  });
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [ocrWords, setOcrWords] = useState<
    Array<{
      text: string;
      bbox: { x0: number; y0: number; x1: number; y1: number };
    }>
  >([]);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Item | null;
    direction: "ascending" | "descending";
  }>({ key: null, direction: "ascending" });
  const [isDragging, setIsDragging] = useState(false);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const [showOptimized, setShowOptimized] = useState(false);
  const [optimizedItems, setOptimizedItems] = useState<Item[]>([]);

  // For scaling bounding boxes
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });

  // Capture the *natural* size of the image once it's loaded
  useEffect(() => {
    if (!imgRef.current) return;

    const handleLoad = () => {
      if (!imgRef.current) return;
      setNaturalSize({
        width: imgRef.current.naturalWidth,
        height: imgRef.current.naturalHeight,
      });
    };

    const currentImg = imgRef.current;
    currentImg.addEventListener("load", handleLoad);

    return () => {
      currentImg.removeEventListener("load", handleLoad);
    };
  }, [uploadedImage]);

  useEffect(() => {
    const loadItemData = async () => {
      console.log("🔍 Loading item data...");
      try {
        const importedData = await import("./data/item_data.json");
        const items = importedData.default.data.items;
        console.log(
          `✅ Item data loaded successfully. Found ${items.length} items.`
        );
        setItemData(items);
      } catch (error) {
        console.error("❌ Failed to load item data:", error);
      }
    };
    loadItemData();
  }, []);

  const toggleOcrMethod = useCallback(
    (method: "gemini") => {
      setOcrMethod(method);
      localStorage.setItem("ocrMethod", method);
    },
    []
  );

  const requestSort = (key: string) => {
    let direction: "ascending" | "descending" = "ascending";
    if (sortConfig?.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    console.log(`🔄 Sorting items by ${key} in ${direction} order`);
    setSortConfig({ key: key as keyof Item, direction });
  };

  const sortedItems = useMemo(() => {
    const sortableItems = [...itemList];
    if (sortConfig?.key) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key!];
        const bValue = b[sortConfig.key!];
        if (aValue != null && bValue != null) {
          if (aValue < bValue) {
            return sortConfig.direction === "ascending" ? -1 : 1;
          }
          if (aValue > bValue) {
            return sortConfig.direction === "ascending" ? 1 : -1;
          }
        }
        return 0;
      });
    }
    return sortableItems;
  }, [itemList, sortConfig]);

  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      setIsLoading(true);
      setProgress(0);
      setError(null);
      setOcrWords([]);
      try {
        const imageUrl = URL.createObjectURL(file);
        setUploadedImage(imageUrl);

        const extractedText = await processImageWithGemini(file, (progress) =>
          setProgress(progress)
        );
        console.log("OCR text extracted:", extractedText.text);
        const items = processOcrText(extractedText.text, itemData);
        console.log("Detected items:", items);
        setItemList(items);
        setOcrWords(extractedText.words);
      } catch (err) {
        console.error("Error processing image:", err);
        setError(
          err instanceof Error
            ? err.message
            : "An unknown error occurred while processing the image."
        );
        setItemList([]);
      } finally {
        setIsLoading(false);
        setProgress(0);
        event.target.value = "";
      }
    },
    [itemData]
  );

  const handleClipboardPaste = useCallback(
    async (event: ClipboardEvent) => {
      // Check if we have image data in the clipboard
      const items = event.clipboardData?.items;
      if (!items) return;

      // Find the first image item in the clipboard
      let imageItem = null;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          imageItem = items[i];
          break;
        }
      }

      // If no image found in clipboard, do nothing
      if (!imageItem) return;

      // Get the image as a file
      const file = imageItem.getAsFile();
      if (!file) return;

      // Process the image
      setIsLoading(true);
      setProgress(0);
      setError(null);
      setOcrWords([]);
      try {
        const imageUrl = URL.createObjectURL(file);
        setUploadedImage(imageUrl);

        const extractedText = await processImageWithGemini(file, (progress) =>
          setProgress(progress)
        );
        console.log("OCR text extracted:", extractedText.text);
        const items = processOcrText(extractedText.text, itemData);
        console.log("Detected items:", items);
        setItemList(items);
        setOcrWords(extractedText.words);
      } catch (err) {
        console.error("Error processing image:", err);
        setError(
          err instanceof Error
            ? err.message
            : "An unknown error occurred while processing the image."
        );
        setItemList([]);
      } finally {
        setIsLoading(false);
        setProgress(0);
      }
    },
    [itemData]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    document.addEventListener("paste", handleClipboardPaste);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Control") {
        setIsCtrlPressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Control") {
        setIsCtrlPressed(false);
      }
    };

    const handleBlur = () => {
      setIsCtrlPressed(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("paste", handleClipboardPaste);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [handleClipboardPaste]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.type.startsWith("image/")) {
          // Create a synthetic event object to reuse handleFileUpload
          const syntheticEvent = {
            target: {
              files: [file],
              value: "",
            },
          } as unknown as React.ChangeEvent<HTMLInputElement>;

          handleFileUpload(syntheticEvent);
        }
      }
    },
    [handleFileUpload]
  );

  const [optimizeCooldown, setOptimizeCooldown] = useState(false);

  const handleOptimize = useCallback(() => {
    if (optimizeCooldown) return;
    
    setOptimizeCooldown(true);
    
    try {
      const optimizationResult = findOptimalItems(itemList);
      setOptimizedItems(optimizationResult.selected);
      setShowOptimized(true);
    } finally {
      
      // Set a 5-second cooldown
      setTimeout(() => {
        setOptimizeCooldown(false);
      }, 3000);
    }
  }, [itemList, optimizeCooldown]);

  const handleClear = useCallback(() => {
    setUploadedImage(null);
    setItemList([]);
    setOcrWords([]);
    setError(null);
    setOptimizedItems([]);
    setShowOptimized(false);
  }, []);

  const handleUseExample = useCallback(async () => {
    setIsLoading(true);
    setProgress(0);
    setError(null);
    setOcrWords([]);
    try {
      const exampleImage = "/screenshot1.png";
      setUploadedImage(exampleImage);

      const response = await fetch(exampleImage);
      const blob = await response.blob();
      const file = new File([blob], "screenshot1.png", { type: "image/png" });

      const extractedText = await processImageWithGemini(file, (progress) =>
        setProgress(progress)
      );
      console.log("OCR text extracted:", extractedText.text);
      const items = processOcrText(extractedText.text, itemData);
      console.log("Detected items:", items);
      setItemList(items);
      setOcrWords(extractedText.words);
    } catch (err) {
      console.error("Error processing image:", err);
      setError(
        err instanceof Error
          ? err.message
          : "An unknown error occurred while processing the image."
      );
      setItemList([]);
    } finally {
      setIsLoading(false);
      setProgress(0);
    }
  }, [itemData]);

  return (
    <div
      className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Scan className="w-8 h-8 text-blue-600 dark:text-blue-400 mr-3" />
              <h1 className="text-xl font-bold">Tarkov Inventory Scanner</h1>
            </div>
            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
              <Database className="w-4 h-4 mr-1" />
              <span>Gemini OCR</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {!uploadedImage ? (
              <ImageUploader
                onFileUpload={handleFileUpload}
                isDragging={isDragging}
                setIsDragging={setIsDragging}
                isCtrlPressed={isCtrlPressed}
                onUseExample={handleUseExample}
              />
            ) : (
              <>
                <ImagePreview
                  uploadedImage={uploadedImage}
                  imgRef={imgRef}
                  ocrWords={ocrWords}
                  naturalSize={naturalSize}
                />
                <ActionButtons
                  onScan={() => {
                    // Re-scan the current image
                    if (uploadedImage) {
                      setIsLoading(true);
                      setProgress(0);
                      setError(null);
                      setOcrWords([]);
                      
                      // Create a synthetic event to reuse existing scan logic
                      const fetchImage = async () => {
                        try {
                          const response = await fetch(uploadedImage);
                          const blob = await response.blob();
                          const file = new File([blob], "image.png", { type: "image/png" });
                          
                          const extractedText = await processImageWithGemini(file, (p) => setProgress(p));
                          console.log("OCR text extracted:", extractedText.text);
                          const items = processOcrText(extractedText.text, itemData);
                          console.log("Detected items:", items);
                          setItemList(items);
                          setOcrWords(extractedText.words);
                        } catch (err) {
                          console.error("Error processing image:", err);
                          setError(err instanceof Error ? err.message : "An unknown error occurred");
                          setItemList([]);
                        } finally {
                          setIsLoading(false);
                          setProgress(0);
                        }
                      };
                      
                      fetchImage();
                    }
                  }}
                  onClear={() => handleClear()}
                  onOptimize={handleOptimize}
                  isLoading={isLoading}
                  hasResults={itemList.length > 0}
                  hasImage={!!uploadedImage}
                  optimizeCooldown={optimizeCooldown}
                />

                {error && (
                  <div className="bg-red-100 dark:bg-red-900 border-l-4 border-red-500 text-red-700 dark:text-red-200 p-4 rounded">
                    <div className="flex items-center">
                      <AlertCircle className="w-5 h-5 mr-2" />
                      <p>{error}</p>
                    </div>
                    <button
                      className="text-sm text-red-600 dark:text-red-300 mt-2 underline"
                      onClick={() => setError(null)}
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {itemList.length > 0 && (
                  <>
                    {/* <RawTextDisplay ocrWords={ocrWords} /> */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                        {showOptimized ? "Optimized Items" : "Detected Items"}
                      </h3>
                      <ResultsTable
                        items={showOptimized ? optimizedItems : sortedItems}
                        sortConfig={sortConfig}
                        requestSort={requestSort}
                      />
                      {showOptimized && (
                        <button
                          onClick={() => setShowOptimized(false)}
                          className="mt-4 text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Show All Items
                        </button>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          <div className="space-y-6">
            <SettingsPanel
              ocrMethod={ocrMethod}
              toggleOcrMethod={toggleOcrMethod}
            />

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Tips
              </h3>
              <ul className="list-disc list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li>Use high-resolution screenshots for better results</li>
                <li>Ensure item names are clearly visible</li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-white dark:bg-gray-800 fixed bottom-0 left-0 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            Tarkov Inventory Scanner - Not affiliated with Battlestate Games
          </p>
        </div>
      </footer>

      <ProcessingOverlay isLoading={isLoading} progress={progress} />
    </div>
  );
};

const App = () => {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
};

export default App;
