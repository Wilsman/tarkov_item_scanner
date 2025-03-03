import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { Database, Scan, AlertCircle } from "lucide-react";
import { createWorker, createScheduler, Scheduler } from "tesseract.js";
import { ItemData } from "./data/items";
import { ThemeProvider } from "./contexts/ThemeContext";
import { getEasyOCREndpoint } from './config';

// Components
import ImageUploader from "./components/ImageUploader";
import ImagePreview from "./components/ImagePreview";
import SettingsPanel from "./components/SettingsPanel";
import ResultsTable from "./components/ResultsTable";
import ProcessingOverlay from "./components/ProcessingOverlay";
import RawTextDisplay from "./components/RawTextDisplay";
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
}

const processOcrText = (ocrText: string, items: ItemData[]): Item[] => {
  console.log("Processing OCR results...");
  // Split by newlines to process each line separately
  const lines = ocrText.split("\n").filter((line) => line.trim().length > 0);
  console.log(`Found ${lines.length} text lines to process`);

  // Process each line to extract item information
  const detectedItems = new Map<string, Item>();

  for (const line of lines) {
    // Split the line into words and process each word
    const words = line.split(/\s+/).filter((word) => word.length > 0);

    for (const word of words) {
      // Clean the word to remove special characters
      const cleanedWord = word.replace(/[^\w]/g, "").toLowerCase();
      if (cleanedWord.length < 2) continue; // Skip very short words

      // Check against known items
      for (const item of items) {
        // Check for exact match first
        if (cleanedWord === item.shortName.toLowerCase().replace(/\s+/g, "")) {
          updateDetectedItems(detectedItems, item);
          break;
        }

        // Check for common OCR mistakes
        const commonOcrMistakes: [string, string[]][] = [
          // ["LEDX", ["ledx", "led"]],
          // ["GPU", ["gpu", "gpx"]],
          // ["SSD", ["ssd", "sso"]],
          // ["CPU", ["cpu"]],
          // ["CPU fan", ["cpufan", "cpu fan"]],
          // ["Lion", ["lion"]],
          // ["Roler", ["roler"]],
          // ["M.parts", ["mparts", "m.parts"]],
          // ["Diary", ["diary"]],
          // ["Hose", ["hose"]],
          // ["Helix", ["helix"]],
          ["H2O2", ["H202", "h202", "h2o2", "2O2", "1202"]],
          ["MTube", ["MTube", "mtube"]],
          ["RBattery", ["RBattery", "Rattery", "RBattery"]],
        ];

        for (const [correctItem, mistakeVariants] of commonOcrMistakes) {
          if (correctItem.toLowerCase() === item.shortName.toLowerCase()) {
            for (const variant of mistakeVariants) {
              // Improved partial matching - check if the cleaned word contains the variant
              // or if the variant contains the cleaned word (for partial matches like "EDX" in "LEDX")
              if (
                cleanedWord.includes(variant) ||
                variant.includes(cleanedWord)
              ) {
                updateDetectedItems(detectedItems, item);
                break;
              }
            }
          }
        }

        // Check if the word is a substring of the item name (for partial matches)
        // This helps with cases where OCR only captures part of a longer item name
        const simplifiedItemName = item.shortName
          .toLowerCase()
          .replace(/\s+/g, "");
        if (
          simplifiedItemName.includes(cleanedWord) ||
          cleanedWord.includes(simplifiedItemName)
        ) {
          // Only match if the partial match is substantial (at least 50% of the item name)
          if (cleanedWord.length >= simplifiedItemName.length * 0.5) {
            updateDetectedItems(detectedItems, item);
            break;
          }
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
    });
  }
};

const preprocessImage = async (imageUrl: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;
      const MAX_DIMENSION = 2000;

      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = Math.round((height * MAX_DIMENSION) / width);
          width = MAX_DIMENSION;
        } else {
          width = Math.round((width * MAX_DIMENSION) / height);
          height = MAX_DIMENSION;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      // Convert to grayscale
      ctx.drawImage(img, 0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, width, height);
      for (let i = 0; i < imageData.data.length; i += 4) {
        const gray =
          0.3 * imageData.data[i] +
          0.59 * imageData.data[i + 1] +
          0.11 * imageData.data[i + 2];
        imageData.data[i] =
          imageData.data[i + 1] =
          imageData.data[i + 2] =
            gray;
      }
      ctx.putImageData(imageData, 0, 0);
      const processedImageUrl = canvas.toDataURL("image/png");
      resolve(processedImageUrl);
    };

    img.onerror = (error) => {
      reject(error);
    };

    img.src = imageUrl;
  });
};

const processImageWithGoogleVision = async (
  file: File,
  apiKey: string,
  onProgress: (progress: number) => void
): Promise<{
  text: string;
  words: Array<{
    text: string;
    bbox: { x0: number; y0: number; x1: number; y1: number };
  }>;
}> => {
  console.log("Processing image with Google Cloud Vision API...");
  try {
    onProgress(10);
    const base64Image = await fileToBase64(file);
    onProgress(20);

    const requestBody = {
      requests: [
        {
          image: {
            content: base64Image.split(",")[1],
          },
          features: [
            {
              type: "TEXT_DETECTION",
              maxResults: 1,
            },
          ],
        },
      ],
    };

    onProgress(30);
    console.log("Sending request to Google Cloud Vision API...");
    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );
    onProgress(70);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Google Cloud Vision API error: ${response.status} ${errorText}`
      );
    }

    const data = (await response.json()) as VisionAPIResponse;
    onProgress(90);

    if (data.responses?.[0]?.textAnnotations?.[0]) {
      const fullText = data.responses[0].textAnnotations[0].description;
      const words = data.responses[0].textAnnotations
        .slice(1)
        .map((word: TextAnnotation) => ({
          text: word.description,
          bbox: {
            x0: Math.min(...word.boundingPoly.vertices.map((v) => v.x ?? 0)),
            y0: Math.min(...word.boundingPoly.vertices.map((v) => v.y ?? 0)),
            x1: Math.max(...word.boundingPoly.vertices.map((v) => v.x ?? 0)),
            y1: Math.max(...word.boundingPoly.vertices.map((v) => v.y ?? 0)),
          },
        }));
      console.log("Google Cloud Vision API OCR completed");
      return { text: fullText, words };
    } else {
      throw new Error("No text detected in the image");
    }
  } catch (error) {
    console.error("Google Cloud Vision API OCR failed:", error);
    throw error;
  }
};

const processImageWithEasyOCR = async (
  file: File,
  onProgress: (progress: number) => void
): Promise<{
  text: string;
  words: Array<{
    text: string;
    bbox: { x0: number; y0: number; x1: number; y1: number };
  }>;
}> => {
  onProgress(10);
  
  try {
    // Create a FormData object to send the file
    const formData = new FormData();
    formData.append('image', file);
    
    onProgress(30);
    
    // Get the appropriate endpoint from config
    const endpoint = getEasyOCREndpoint();
    
    // Send the image to the EasyOCR server (local or cloud function)
    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    });
    
    onProgress(70);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`EasyOCR server error: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();
    onProgress(90);
    
    // The server already returns data in the expected format
    onProgress(100);
    return data;
  } catch (error) {
    console.error("Error with EasyOCR:", error);
    throw error;
  }
};

const processImageWithCleanTesseract = async (
  file: File,
  onProgress: (progress: number) => void
): Promise<{
  text: string;
  words: Array<{
    text: string;
    bbox: { x0: number; y0: number; x1: number; y1: number };
  }>;
}> => {
  if (!scheduler) {
    console.log("Initializing Tesseract.js scheduler...");
    scheduler = await initTesseract();
  }

  console.log("Starting Clean Tesseract recognition");
  onProgress(10);

  const preprocessedImage = await preprocessImage(URL.createObjectURL(file));
  onProgress(30);

  const result = await scheduler.addJob("recognize", preprocessedImage);
  onProgress(90);

  return {
    text: result.data.text,
    words: result.data.words.map(
      (word: {
        text: string;
        bbox: { x0: number; y0: number; x1: number; y1: number };
      }) => ({
        text: word.text,
        bbox: {
          x0: word.bbox.x0,
          y0: word.bbox.y0,
          x1: word.bbox.x1,
          y1: word.bbox.y1,
        },
      })
    ),
  };
};

const processImageWithTesseract = async (
  file: File,
  onProgress: (progress: number) => void
): Promise<{
  text: string;
  words: Array<{
    text: string;
    bbox: { x0: number; y0: number; x1: number; y1: number };
  }>;
}> => {
  if (!scheduler) {
    console.log("Initializing Tesseract.js scheduler...");
    scheduler = await initTesseract();
  }

  console.log("Starting Tesseract recognition");
  onProgress(10);

  const preprocessedImage = await preprocessImage(URL.createObjectURL(file));
  onProgress(30);

  const result = await scheduler.addJob("recognize", preprocessedImage);
  onProgress(90);

  return {
    text: result.data.text,
    words: result.data.words.map(
      (word: {
        text: string;
        bbox: { x0: number; y0: number; x1: number; y1: number };
      }) => ({
        text: word.text,
        bbox: {
          x0: word.bbox.x0,
          y0: word.bbox.y0,
          x1: word.bbox.x1,
          y1: word.bbox.y1,
        },
      })
    ),
  };
};

let scheduler: Scheduler | null = null;

const initTesseract = async (): Promise<Scheduler> => {
  if (scheduler) return scheduler;
  console.log("Initializing Tesseract.js scheduler...");
  scheduler = createScheduler();
  try {
    // Create workers with language pre-loaded
    const worker1 = await createWorker("eng");
    const worker2 = await createWorker("eng");
    scheduler.addWorker(worker1);
    scheduler.addWorker(worker2);
    console.log("Tesseract.js initialized with 2 workers");
    return scheduler;
  } catch (error) {
    console.error("Failed to initialize Tesseract workers:", error);
    throw error;
  }
};

const terminateTesseract = async (): Promise<void> => {
  if (scheduler) {
    console.log("Terminating Tesseract.js workers...");
    await scheduler.terminate();
    scheduler = null;
    console.log("Tesseract.js workers terminated");
  }
};

interface Vertex {
  x: number;
  y: number;
}

interface BoundingPoly {
  vertices: Vertex[];
}

interface TextAnnotation {
  description: string;
  boundingPoly: BoundingPoly;
}

interface VisionAPIResponse {
  responses: Array<{
    textAnnotations: TextAnnotation[];
  }>;
}

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

const AppContent: React.FC = () => {
  const [itemData, setItemData] = useState<ItemData[]>([]);
  const [itemList, setItemList] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [ocrMethod, setOcrMethod] = useState<
    "tesseract" | "cleanTesseract" | "googleVision" | "easyOCR"
  >(() => {
    const savedMethod = localStorage.getItem("ocrMethod");
    return (
      (savedMethod as "tesseract" | "cleanTesseract" | "googleVision" | "easyOCR") ||
      "tesseract"
    );
  });
  const [googleVisionApiKey, setGoogleVisionApiKey] = useState(
    () => localStorage.getItem("googleVisionApiKey") || ""
  );
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [ocrWords, setOcrWords] = useState<
    Array<{
      text: string;
      bbox: { x0: number; y0: number; x1: number; y1: number };
    }>
  >([]);
  const [showOcrHighlights, setShowOcrHighlights] = useState(true);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Item | null;
    direction: "ascending" | "descending";
  }>({ key: null, direction: "ascending" });
  const [isDragging, setIsDragging] = useState(false);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);

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
    (method: "tesseract" | "cleanTesseract" | "googleVision" | "easyOCR") => {
      setOcrMethod(method);
      localStorage.setItem("ocrMethod", method);
      if (method === "googleVision" && !googleVisionApiKey) {
        setShowApiKeyInput(true);
      }
      // We don't need an API key for the local EasyOCR server
      // if (method === "easyOCR" && !easyOCRApiKey) {
      //   setShowApiKeyInput(true);
      // }
    },
    [googleVisionApiKey]
  );

  const saveApiKey = useCallback((key: string) => {
    if (ocrMethod === "googleVision") {
      setGoogleVisionApiKey(key);
      localStorage.setItem("googleVisionApiKey", key);
    }
    setShowApiKeyInput(false);
  }, [ocrMethod]);

  const toggleApiKeyInput = useCallback(() => {
    setShowApiKeyInput((prev) => !prev);
  }, []);

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

        if (ocrMethod === "googleVision") {
          if (!googleVisionApiKey) {
            throw new Error(
              "Google Cloud Vision API key is required. Please set your API key."
            );
          }

          const extractedText = await processImageWithGoogleVision(
            file,
            googleVisionApiKey,
            (progress) => setProgress(progress)
          );
          console.log("OCR text extracted:", extractedText.text);
          const items = processOcrText(extractedText.text, itemData);
          console.log("Detected items:", items);
          setItemList(items);
          setOcrWords(extractedText.words);
        } else if (ocrMethod === "easyOCR") {
          // No API key required for local server
          // if (!easyOCRApiKey) {
          //   throw new Error(
          //     "EasyOCR API key is required. Please set your API key."
          //   );
          // }

          const extractedText = await processImageWithEasyOCR(
            file,
            (progress) => setProgress(progress)
          );
          console.log("OCR text extracted:", extractedText.text);
          const items = processOcrText(extractedText.text, itemData);
          console.log("Detected items:", items);
          setItemList(items);
          setOcrWords(extractedText.words);
        } else if (ocrMethod === "cleanTesseract") {
          const extractedText = await processImageWithCleanTesseract(
            file,
            (progress) => setProgress(progress)
          );
          console.log("OCR text extracted:", extractedText.text);
          const items = processOcrText(extractedText.text, itemData);
          console.log("Detected items:", items);
          setItemList(items);
          setOcrWords(extractedText.words);
        } else {
          // Default Tesseract
          const extractedText = await processImageWithTesseract(
            file,
            (progress) => setProgress(progress)
          );
          console.log("OCR text extracted:", extractedText.text);
          const items = processOcrText(extractedText.text, itemData);
          console.log("Detected items:", items);
          setItemList(items);
          setOcrWords(extractedText.words);
        }
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
    [itemData, ocrMethod, googleVisionApiKey]
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

        if (ocrMethod === "googleVision") {
          if (!googleVisionApiKey) {
            throw new Error(
              "Google Cloud Vision API key is required. Please set your API key."
            );
          }

          const extractedText = await processImageWithGoogleVision(
            file,
            googleVisionApiKey,
            (progress) => setProgress(progress)
          );
          console.log("OCR text extracted:", extractedText.text);
          const items = processOcrText(extractedText.text, itemData);
          console.log("Detected items:", items);
          setItemList(items);
          setOcrWords(extractedText.words);
        } else if (ocrMethod === "easyOCR") {
          // No API key required for local server
          // if (!easyOCRApiKey) {
          //   throw new Error(
          //     "EasyOCR API key is required. Please set your API key."
          //   );
          // }

          const extractedText = await processImageWithEasyOCR(
            file,
            (progress) => setProgress(progress)
          );
          console.log("OCR text extracted:", extractedText.text);
          const items = processOcrText(extractedText.text, itemData);
          console.log("Detected items:", items);
          setItemList(items);
          setOcrWords(extractedText.words);
        } else if (ocrMethod === "cleanTesseract") {
          const extractedText = await processImageWithCleanTesseract(
            file,
            (progress) => setProgress(progress)
          );
          console.log("OCR text extracted:", extractedText.text);
          const items = processOcrText(extractedText.text, itemData);
          console.log("Detected items:", items);
          setItemList(items);
          setOcrWords(extractedText.words);
        } else {
          // Default Tesseract
          const extractedText = await processImageWithTesseract(
            file,
            (progress) => setProgress(progress)
          );
          console.log("OCR text extracted:", extractedText.text);
          const items = processOcrText(extractedText.text, itemData);
          console.log("Detected items:", items);
          setItemList(items);
          setOcrWords(extractedText.words);
        }
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
    [itemData, ocrMethod, googleVisionApiKey]
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

      if (ocrMethod === "googleVision") {
        if (!googleVisionApiKey) {
          throw new Error(
            "Google Cloud Vision API key is required. Please set your API key."
          );
        }

        const extractedText = await processImageWithGoogleVision(
          file,
          googleVisionApiKey,
          (progress) => setProgress(progress)
        );
        console.log("OCR text extracted:", extractedText.text);
        const items = processOcrText(extractedText.text, itemData);
        console.log("Detected items:", items);
        setItemList(items);
        setOcrWords(extractedText.words);
      } else if (ocrMethod === "easyOCR") {
        // No API key required for local server
        // if (!easyOCRApiKey) {
        //   throw new Error(
        //     "EasyOCR API key is required. Please set your API key."
        //   );
        // }

        const extractedText = await processImageWithEasyOCR(
          file,
          (progress) => setProgress(progress)
        );
        console.log("OCR text extracted:", extractedText.text);
        const items = processOcrText(extractedText.text, itemData);
        console.log("Detected items:", items);
        setItemList(items);
        setOcrWords(extractedText.words);
      } else if (ocrMethod === "cleanTesseract") {
        const extractedText = await processImageWithCleanTesseract(
          file,
          (progress) => setProgress(progress)
        );
        console.log("OCR text extracted:", extractedText.text);
        const items = processOcrText(extractedText.text, itemData);
        console.log("Detected items:", items);
        setItemList(items);
        setOcrWords(extractedText.words);
      } else {
        // Default Tesseract
        const extractedText = await processImageWithTesseract(
          file,
          (progress) => setProgress(progress)
        );
        console.log("OCR text extracted:", extractedText.text);
        const items = processOcrText(extractedText.text, itemData);
        console.log("Detected items:", items);
        setItemList(items);
        setOcrWords(extractedText.words);
      }
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
  }, [itemData, ocrMethod, googleVisionApiKey]);

  useEffect(() => {
    return () => {
      void terminateTesseract();
    };
  }, []);

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
              <span>
                {ocrMethod === "tesseract"
                  ? "Tesseract.js"
                  : ocrMethod === "cleanTesseract"
                  ? "Clean Tesseract"
                  : ocrMethod === "easyOCR"
                  ? "EasyOCR"
                  : "Google Vision"}{" "}
                OCR
              </span>
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
                  showOcrHighlights={showOcrHighlights}
                  naturalSize={naturalSize}
                />
                <ActionButtons
                  setUploadedImage={setUploadedImage}
                  setItemList={setItemList}
                  setOcrWords={setOcrWords}
                  showOcrHighlights={showOcrHighlights}
                  setShowOcrHighlights={setShowOcrHighlights}
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
                    <RawTextDisplay ocrWords={ocrWords} />
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                        Detected Items
                      </h3>
                      <ResultsTable
                        items={sortedItems}
                        sortConfig={sortConfig}
                        requestSort={requestSort}
                      />
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
              googleVisionApiKey={googleVisionApiKey}
              showApiKeyInput={showApiKeyInput}
              toggleApiKeyInput={toggleApiKeyInput}
              saveApiKey={saveApiKey}
            />

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                How It Works
              </h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li>Upload a screenshot of your Tarkov inventory</li>
                <li>Select your preferred OCR method</li>
                <li>Process the image to detect items</li>
                <li>View detected items and their estimated value</li>
                <li>Sort results by name, price, or quantity</li>
                <li>Export results for later reference</li>
              </ol>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Tips
              </h3>
              <ul className="list-disc list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li>Use high-resolution screenshots for better results</li>
                <li>Ensure item names are clearly visible</li>
                <li>Adjust confidence threshold for more/fewer matches</li>
                <li>Google Vision and EasyOCR typically provide better accuracy</li>
                <li>EasyOCR is a good balance between speed and accuracy</li>
                <li>Use dark mode for night-time raiding sessions</li>
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
