// Simple script to create a .env file
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envContent = `# Tarkov Item Scanner Environment Variables
# Generated on ${new Date().toISOString()}

# Gemini API Key - Get from https://makersuite.google.com/app/apikey
VITE_GEMINI_API_KEY=

# Google Vision API Key - Get from Google Cloud Console
VITE_GOOGLE_VISION_API_KEY=
`;

const envPath = path.join(__dirname, '.env');

// Check if .env already exists
if (fs.existsSync(envPath)) {
  console.log('\x1b[33m%s\x1b[0m', '.env file already exists. Rename or delete it first to create a new one.');
} else {
  // Write the .env file
  fs.writeFileSync(envPath, envContent);
  console.log('\x1b[32m%s\x1b[0m', '.env file created successfully!');
  console.log('\x1b[36m%s\x1b[0m', 'Edit the file to add your API keys.');
}
