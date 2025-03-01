import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { ArrowUpDown, Moon, Sun } from "lucide-react";
import { createWorker, createScheduler, Scheduler, Worker } from "tesseract.js";
import { ItemData } from "./data/items";

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
          ["LEDX", ["ledx", "led", "edx"]],
          ["GPU", ["gpu", "gpx"]],
          ["SSD", ["ssd", "sso"]],
          ["CPU", ["cpu"]],
          ["CPU fan", ["cpufan", "cpu fan"]],
          ["Lion", ["lion"]],
          ["Roler", ["roler"]],
          ["M.parts", ["mparts", "m.parts"]],
          ["Diary", ["diary"]],
          ["Hose", ["hose"]],
          ["Helix", ["helix"]],
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

      ctx.drawImage(img, 0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, width, height);
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = width;
      tempCanvas.height = height;
      const tempCtx = tempCanvas.getContext("2d");
      if (!tempCtx) {
        reject(new Error("Could not get temporary canvas context"));
        return;
      }
      tempCtx.putImageData(imageData, 0, 0);

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

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
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
  console.log("Processing image with Clean Tesseract.js...");
  try {
    onProgress(10);
    // Convert file to data URL
    const reader = new FileReader();
    const imageData = await new Promise<string>((resolve) => {
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.readAsDataURL(file);
    });
    onProgress(20);

    // Create a worker - in newer versions, workers come pre-loaded with language data
    const worker = await createWorker("eng");

    // Log progress manually at key points
    onProgress(50);

    // Recognize text directly (no need for load, loadLanguage, or initialize)
    const response = await worker.recognize(imageData);
    onProgress(90);

    // Format words to match the expected output format
    const words = response.data.words.map(
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
    );

    // Terminate worker
    await worker.terminate();

    onProgress(95);
    console.log("Clean Tesseract.js OCR completed");
    return { text: response.data.text, words };
  } catch (error) {
    console.error("Clean Tesseract.js OCR failed:", error);
    throw error;
  }
};

const processImageWithTesseract = async (
  file: File,
  onProgress: (progress: number) => void,
  tesseractSettings: TesseractSettings
): Promise<{
  text: string;
  words: Array<{
    text: string;
    bbox: { x0: number; y0: number; x1: number; y1: number };
  }>;
}> => {
  console.log("Processing image with Tesseract.js...");
  try {
    if (!scheduler) {
      scheduler = await initTesseract();
    }
    onProgress(10);
    // Reuse fileToBase64 helper instead of duplicating FileReader logic
    const imageUrl = await fileToBase64(file);
    onProgress(20);
    console.log("Preprocessing image...");
    const processedImageUrl = await preprocessImage(imageUrl);
    onProgress(40);

    console.log("Recognizing text with Tesseract.js...");
    const result = await scheduler.addJob(
      "recognize",
      processedImageUrl,
      {
        tessedit_pageseg_mode: tesseractSettings.tessedit_pageseg_mode,
        tessedit_ocr_engine_mode: tesseractSettings.tessedit_ocr_engine_mode,
        tessjs_create_hocr: tesseractSettings.tessjs_create_hocr,
        tessjs_create_tsv: tesseractSettings.tessjs_create_tsv,
        tessedit_char_whitelist:
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-.,/\\()[]{}:;\"'?!@#$%^&*+=<>~` ",
      } as TesseractJobOptions,
      {}
    );

    onProgress(95);
    const words = result.data.words.map((word: TesseractWord) => ({
      text: word.text,
      bbox: {
        x0: word.bbox.x0,
        y0: word.bbox.y0,
        x1: word.bbox.x1,
        y1: word.bbox.y1,
      },
    }));

    console.log("Tesseract.js OCR completed");
    return { text: result.data.text, words };
  } catch (error) {
    console.error("Tesseract.js OCR failed:", error);
    throw error;
  }
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

interface TesseractWord {
  text: string;
  bbox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
}

interface TesseractSettings {
  tessedit_pageseg_mode: string;
  tessedit_ocr_engine_mode: string;
  tessjs_create_hocr: string;
  tessjs_create_tsv: string;
}

interface TesseractJobOptions {
  tessedit_pageseg_mode: string;
  tessedit_ocr_engine_mode: string;
  tessjs_create_hocr: string;
  tessjs_create_tsv: string;
  tessedit_char_whitelist: string;
}

const App = () => {
  const [itemData, setItemData] = useState<ItemData[]>([]);
  const [itemList, setItemList] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(() => {
    const savedMode = localStorage.getItem("darkMode");
    return savedMode !== null
      ? savedMode === "true"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  const [ocrMethod, setOcrMethod] = useState<
    "tesseract" | "cleanTesseract" | "googleVision"
  >(() => {
    const savedMethod = localStorage.getItem("ocrMethod");
    return (
      (savedMethod as "tesseract" | "cleanTesseract" | "googleVision") ||
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
  const [tesseractSettings, setTesseractSettings] = useState<TesseractSettings>(
    {
      tessedit_pageseg_mode: "6",
      tessedit_ocr_engine_mode: "1",
      tessjs_create_hocr: "1",
      tessjs_create_tsv: "1",
    }
  );
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

  const toggleDarkMode = useCallback(() => {
    setDarkMode((prevMode) => {
      const newMode = !prevMode;
      localStorage.setItem("darkMode", newMode.toString());
      return newMode;
    });
  }, []);

  const toggleOcrMethod = useCallback(
    (method: "tesseract" | "cleanTesseract" | "googleVision") => {
      setOcrMethod(method);
      localStorage.setItem("ocrMethod", method);
      if (method === "googleVision" && !googleVisionApiKey) {
        setShowApiKeyInput(true);
      }
    },
    [googleVisionApiKey]
  );

  const saveApiKey = useCallback((key: string) => {
    setGoogleVisionApiKey(key);
    localStorage.setItem("googleVisionApiKey", key);
    setShowApiKeyInput(false);
  }, []);

  const toggleApiKeyInput = useCallback(() => {
    setShowApiKeyInput((prev) => !prev);
  }, []);

  const requestSort = (key: keyof Item) => {
    let direction: "ascending" | "descending" = "ascending";
    if (sortConfig?.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    console.log(`🔄 Sorting items by ${key} in ${direction} order`);
    setSortConfig({ key, direction });
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
            (progress) => setProgress(progress),
            tesseractSettings
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
    [itemData, ocrMethod, googleVisionApiKey, tesseractSettings]
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
            (progress) => setProgress(progress),
            tesseractSettings
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
    [itemData, ocrMethod, googleVisionApiKey, tesseractSettings]
  );

  // Add event listener for clipboard paste
  useEffect(() => {
    document.addEventListener("paste", handleClipboardPaste);

    // Add event listeners for Ctrl key
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

    // Add window blur event to reset Ctrl state
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

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragging(true);
    },
    []
  );

  const handleDragLeave = useCallback(
    (event: React.DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragging(false);
    },
    []
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragging(false);

      if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
        const file = event.dataTransfer.files[0];
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

  const handleRescan = useCallback(async () => {
    if (!uploadedImage) return;
    setIsLoading(true);
    setProgress(0);
    setError(null);
    setOcrWords([]);
    try {
      const file = await fetch(uploadedImage).then((res) => res.blob());
      let extractedText;

      if (ocrMethod === "cleanTesseract") {
        extractedText = await processImageWithCleanTesseract(
          new File([file], "image.png", { type: "image/png" }),
          (progress) => setProgress(progress)
        );
      } else if (ocrMethod === "googleVision") {
        extractedText = await processImageWithGoogleVision(
          new File([file], "image.png", { type: "image/png" }),
          googleVisionApiKey,
          (progress) => setProgress(progress)
        );
      } else {
        extractedText = await processImageWithTesseract(
          new File([file], "image.png", { type: "image/png" }),
          (progress) => setProgress(progress),
          tesseractSettings
        );
      }

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
  }, [
    itemData,
    uploadedImage,
    tesseractSettings,
    ocrMethod,
    googleVisionApiKey,
  ]);

  useEffect(() => {
    return () => {
      void terminateTesseract();
    };
  }, []);

  return (
    <div
      className={`min-h-screen p-8 transition-colors duration-200 ${
        darkMode ? "bg-gray-900 text-gray-100" : "bg-gray-100 text-gray-800"
      }`}
    >
      <div
        className={`max-w-4xl mx-auto rounded-lg shadow-md p-6 ${
          darkMode ? "bg-gray-800" : "bg-white"
        }`}
      >
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Tarkov Stash Scanner</h1>
          <button
            onClick={toggleDarkMode}
            className={`p-2 rounded-full ${
              darkMode
                ? "bg-gray-700 hover:bg-gray-600"
                : "bg-gray-200 hover:bg-gray-300"
            }`}
            aria-label="Toggle dark mode"
          >
            {darkMode ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </button>
        </div>

        <div className="mb-6">
          <label
            className={`block text-sm font-medium mb-2 ${
              darkMode ? "text-gray-300" : "text-gray-700"
            }`}
          >
            Upload your inventory screenshot
          </label>
          <div className="flex items-center justify-center w-full">
            <label
              className={`flex flex-col w-full h-32 border-2 border-dashed rounded-lg cursor-pointer ${
                isDragging
                  ? darkMode
                    ? "border-blue-500 bg-gray-700"
                    : "border-blue-500 bg-blue-50"
                  : isCtrlPressed
                  ? darkMode
                    ? "border-green-500 bg-gray-700"
                    : "border-green-500 bg-green-50"
                  : darkMode
                  ? "border-gray-600 hover:bg-gray-700"
                  : "border-gray-300 hover:bg-gray-50"
              } transition-colors duration-200`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <svg
                  className={`w-10 h-10 ${
                    darkMode ? "text-gray-400" : "text-gray-500"
                  }`}
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
                <p className="mb-1 text-sm">
                  <span className="font-semibold">Click to upload</span> or drag
                  and drop
                </p>
                <p className="text-xs">PNG, JPG, or JPEG</p>
                <p
                  className={`text-xs mt-1 ${
                    isCtrlPressed ? "font-bold text-green-500" : ""
                  }`}
                >
                  <span className="font-semibold">Or press Ctrl+V</span> to
                  paste from clipboard
                </p>
              </div>
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleFileUpload}
              />
            </label>
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between mb-6 gap-4">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-2">
            <label
              className={`block text-sm font-medium ${
                darkMode ? "text-gray-300" : "text-gray-700"
              }`}
            >
              OCR Method:
            </label>
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <input
                  type="radio"
                  id="tesseract"
                  name="ocr-method"
                  value="tesseract"
                  checked={ocrMethod === "tesseract"}
                  onChange={() => toggleOcrMethod("tesseract")}
                  className="mr-2"
                />
                <label
                  htmlFor="tesseract"
                  className={`${darkMode ? "text-gray-300" : "text-gray-700"}`}
                >
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
                  className="mr-2"
                />
                <label
                  htmlFor="clean-tesseract"
                  className={`${darkMode ? "text-gray-300" : "text-gray-700"}`}
                >
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
                  className="mr-2"
                />
                <label
                  htmlFor="google-vision"
                  className={`${darkMode ? "text-gray-300" : "text-gray-700"}`}
                >
                  Google Cloud Vision (API)
                </label>
              </div>
            </div>
          </div>

          {ocrMethod === "googleVision" && (
            <div className="flex flex-col md:flex-row items-start md:items-center gap-2">
              <label
                className={`block text-sm font-medium ${
                  darkMode ? "text-gray-300" : "text-gray-700"
                }`}
              >
                API Key:
              </label>
              <div className="flex items-center">
                {showApiKeyInput ? (
                  <div className="flex">
                    <input
                      type="text"
                      value={googleVisionApiKey}
                      onChange={(e) => setGoogleVisionApiKey(e.target.value)}
                      placeholder="Enter Google Vision API Key"
                      className={`p-2 rounded-lg w-64 ${
                        darkMode
                          ? "bg-gray-700 text-white"
                          : "bg-gray-200 text-gray-800"
                      }`}
                    />
                    <button
                      onClick={() => saveApiKey(googleVisionApiKey)}
                      className="ml-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center">
                    <span
                      className={`${
                        darkMode ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
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
                      onClick={toggleApiKeyInput}
                      className="ml-2 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                    >
                      {googleVisionApiKey ? "Change" : "Set API Key"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {ocrMethod === "tesseract" && (
          <div className="flex flex-col gap-2 p-2 border rounded-lg bg-card">
            <h3 className="text-sm font-semibold">Tesseract Settings</h3>
            <div className="grid grid-cols-1 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium">
                  Page Segmentation Mode
                </label>
                <select
                  className="bg-gray-700 text-gray-200 p-1"
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
              <div className="space-y-1">
                <label className="text-xs font-medium">OCR Engine Mode</label>
                <select
                  className="bg-gray-700 text-gray-200 p-1"
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
              <div className="space-y-1">
                <label className="text-xs font-medium">Create HOCR</label>
                <select
                  className="bg-gray-700 text-gray-200 p-1"
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
              <div className="space-y-1">
                <label className="text-xs font-medium">Create TSV</label>
                <select
                  className="bg-gray-700 text-gray-200 p-1"
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

        <div
          className={`mb-4 p-3 rounded-lg ${
            darkMode ? "bg-gray-800" : "bg-gray-100"
          }`}
        >
          <p
            className={`text-sm ${
              darkMode ? "text-gray-300" : "text-gray-700"
            }`}
          >
            <strong>Note:</strong> Google Cloud Vision API requires an API key
            and may incur charges. You need to{" "}
            <a
              href="https://cloud.google.com/vision/docs/setup"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              set up a Google Cloud account
            </a>{" "}
            and enable the Vision API to get your key.
          </p>
        </div>

        {error && (
          <div
            className={[
              `bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4`,
              darkMode ? "dark:bg-red-900" : "",
            ].join(" ")}
            role="alert"
          >
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {uploadedImage && (
          <div className="mb-6 overflow-auto">
            <h2
              className={`text-xl font-semibold mb-2 ${
                darkMode ? "text-white" : "text-gray-800"
              }`}
            >
              Uploaded Image with OCR Results
            </h2>
            <div className="flex items-center mb-2">
              <label
                className={`inline-flex items-center cursor-pointer ${
                  darkMode ? "text-gray-300" : "text-gray-700"
                }`}
              >
                <input
                  type="checkbox"
                  checked={showOcrHighlights}
                  onChange={() => setShowOcrHighlights(!showOcrHighlights)}
                  className="sr-only peer"
                />
                <div
                  className={`relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600`}
                ></div>
                <span className="ml-3 text-sm font-medium">
                  Show OCR Highlights
                </span>
              </label>
            </div>
            <div className="relative inline-block">
              {/* The ref so we can read naturalWidth/naturalHeight */}
              <img
                ref={imgRef}
                src={uploadedImage}
                alt="Uploaded screenshot"
                className="max-w-full h-auto border border-gray-300 rounded-lg"
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
        )}

        {isLoading ? (
          <div className="flex flex-col justify-center items-center py-10">
            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4 dark:bg-gray-700">
              <div
                className="bg-blue-600 h-2.5 rounded-full"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <div
              className={`animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 ${
                darkMode ? "border-blue-400" : "border-blue-500"
              }`}
            ></div>
            <span
              className={`ml-3 mt-2 ${
                darkMode ? "text-gray-300" : "text-gray-700"
              }`}
            >
              {progress < 100
                ? `Processing image... ${Math.round(progress)}%`
                : "Finalizing results..."}
            </span>
          </div>
        ) : (
          <>
            {itemList.length > 0 ? (
              <div className="overflow-y-auto max-h-[60vh]">
                <table className="w-full border-collapse">
                  <thead
                    className={`sticky top-0 ${
                      darkMode
                        ? "divide-gray-700 text-gray-300"
                        : "divide-gray-200 text-gray-700"
                    }`}
                  >
                    <tr>
                      <th
                        className={`px-4 py-2 text-left cursor-pointer ${
                          darkMode ? "hover:bg-gray-600" : "hover:bg-gray-300"
                        }`}
                        onClick={() => requestSort("name")}
                      >
                        <div className="flex items-center">
                          Item Name
                          <ArrowUpDown className="ml-1 h-4 w-4" />
                        </div>
                      </th>
                      <th
                        className={`px-4 py-2 text-center cursor-pointer ${
                          darkMode ? "hover:bg-gray-600" : "hover:bg-gray-300"
                        }`}
                        onClick={() => requestSort("quantity")}
                      >
                        <div className="flex items-center justify-center">
                          Quantity
                          <ArrowUpDown className="ml-1 h-4 w-4" />
                        </div>
                      </th>
                      <th
                        className={`px-4 py-2 text-right cursor-pointer ${
                          darkMode ? "hover:bg-gray-600" : "hover:bg-gray-300"
                        }`}
                        onClick={() => requestSort("basePrice")}
                      >
                        <div className="flex items-center justify-end">
                          Base Price (₽)
                          <ArrowUpDown className="ml-1 h-4 w-4" />
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedItems.map((item, index) => (
                      <tr
                        key={index}
                        className={
                          index % 2 === 0
                            ? darkMode
                              ? "bg-gray-700"
                              : "bg-gray-50"
                            : darkMode
                            ? "bg-gray-800"
                            : "bg-white"
                        }
                      >
                        <td
                          className={`border px-4 py-2 ${
                            darkMode ? "border-gray-700" : "border-gray-200"
                          }`}
                        >
                          {item.name}
                        </td>
                        <td
                          className={`border px-4 py-2 text-center ${
                            darkMode ? "border-gray-700" : "border-gray-200"
                          }`}
                        >
                          x{item.quantity}
                        </td>
                        <td
                          className={`border px-4 py-2 text-right ${
                            darkMode ? "border-gray-700" : "border-gray-200"
                          }`}
                        >
                          {item.basePrice.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div
                className={`text-center py-10 ${
                  darkMode ? "text-gray-400" : "text-gray-500"
                }`}
              >
                <p>
                  No items detected. Upload an inventory screenshot to scan for
                  items.
                </p>
              </div>
            )}

            {itemList.length > 0 && (
              <div
                className={`mt-6 p-4 rounded-lg ${
                  darkMode ? "bg-gray-700" : "bg-gray-100"
                }`}
              >
                <h2 className="text-xl font-semibold">Summary</h2>
                <p className="font-medium">
                  Total Items:{" "}
                  {itemList.reduce((sum, item) => sum + item.quantity, 0)}
                </p>
                <p className="font-medium">
                  Total Value:{" "}
                  {itemList
                    .reduce(
                      (sum, item) => sum + item.basePrice * item.quantity,
                      0
                    )
                    .toLocaleString()}{" "}
                  ₽
                </p>
                <p
                  className={`text-sm mt-2 ${
                    darkMode ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Note: Some items may have a base price of 0 as they were not
                  found in the database or have special values.
                </p>
              </div>
            )}
          </>
        )}
        <div className="flex justify-center mt-6">
          <button
            onClick={handleRescan}
            className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
            disabled={isLoading || !uploadedImage}
          >
            Rescan
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
