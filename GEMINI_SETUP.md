# Setting up Gemini 2.0 for Tarkov Item Scanner

This guide explains how to set up and use the Gemini 2.0 API integration for the Tarkov Item Scanner.

## Prerequisites

1. A Google Cloud account with access to the Gemini API (optional, as the app uses a default API key)

## Using the Default API Key

By default, the Tarkov Item Scanner uses a shared Gemini API key provided through environment variables. You don't need to do anything special to use this default key.

## Using Your Own Gemini API Key (Optional)

If you prefer to use your own API key for privacy or rate limit reasons, follow these steps:

### Getting a Gemini API Key

1. Go to the [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Create a new API key
4. Copy the API key for later use

### Setting up Your API Key

You can set up your own Gemini API key in three ways:

#### Option 1: Using the app settings (recommended)

1. Open the Tarkov Item Scanner app
2. Go to Settings
3. Select "Gemini 2.0 (API)" as the OCR method
4. Click "Override" and enter your Gemini API key when prompted

#### Option 2: Using the .env file (for development)

1. Open the `.env` file in the root directory
2. Add your actual Gemini API key:
   ```
   VITE_GEMINI_API_KEY=your_actual_api_key_here
   ```
3. Restart the development server

#### Option 3: Using Cloudflare Pages environment variables (for production)

If you're deploying the app to Cloudflare Pages:

1. Go to your Cloudflare Pages project settings
2. Navigate to the "Environment variables" section
3. Add a new variable with the name `VITE_GEMINI_API_KEY` and your API key as the value
4. Deploy your application

## Using Gemini in the App

1. Open the Tarkov Item Scanner app
2. Go to Settings
3. Select "Gemini 2.0 (API)" as the OCR method (it should be selected by default)
4. Upload or paste an image to scan items

## How It Works

The Gemini 2.0 integration:

1. Sends your image directly to the Gemini API
2. Uses Gemini's advanced vision capabilities to identify items and their quantities
3. Returns the results in a structured JSON format
4. Displays the detected items in the app's interface

## Troubleshooting

- **API key errors**: If you're using your own key, verify that you've entered it correctly in the app settings or .env file
- **Network errors**: Ensure you have an active internet connection
- **Rate limiting**: The Gemini API has usage limits; if you encounter quota issues, consider using your own API key

## Notes

- Gemini 2.0 is more accurate for item detection than traditional OCR methods but requires an internet connection
- The default API key is shared, so consider using your own key for better reliability during peak usage times
