# Gemini OCR Worker for Tarkov Item Scanner

This Cloudflare Worker processes images using Google's Gemini 2.0 API to detect and count Escape from Tarkov game items in screenshots.

## Setup and Deployment

### Prerequisites

- Node.js and npm installed
- Cloudflare account
- Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)

### Local Development

1. Install dependencies:
   ```
   npm install
   ```

2. Set up your Gemini API key as a secret:
   ```
   npx wrangler secret put GEMINI_API_KEY
   ```

3. Start the development server:
   ```
   npm run dev
   ```

   This will start a local server at http://localhost:8787

### Deployment

1. Make sure your Gemini API key is set as a secret:
   ```
   npx wrangler secret put GEMINI_API_KEY
   ```

2. Deploy to Cloudflare Workers:
   ```
   npm run deploy
   ```

3. After deployment, update the worker URL in the main application's `App.tsx` file:
   ```typescript
   const workerUrl = isLocalDev 
     ? "http://localhost:8787"
     : "https://your-worker-name.your-account.workers.dev"; // Replace with your actual worker URL
   ```

## API Usage

The worker exposes a single POST endpoint that accepts JSON with the following structure:

```json
{
  "imageData": "base64-encoded-image-data-or-data-url"
}
```

The response will be JSON with the following structure:

```json
{
  "text": "ItemName1: 3\nItemName2: 1\n",
  "words": [
    {
      "text": "ItemName1: 3",
      "bbox": { "x0": 10, "y0": 10, "x1": 200, "y1": 30 }
    },
    {
      "text": "ItemName2: 1",
      "bbox": { "x0": 10, "y0": 30, "x1": 200, "y1": 50 }
    }
  ]
}
```

## Error Handling

The worker will return appropriate HTTP status codes for different error scenarios:

- 400: Missing or invalid image data
- 405: Method not allowed (only POST is supported)
- 500: Server error (e.g., API key not configured, Gemini API error)

Error responses will include a JSON body with an error message:

```json
{
  "error": "Error message details"
}
```
