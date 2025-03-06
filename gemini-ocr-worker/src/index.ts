/**
 * Gemini OCR Worker for Tarkov Item Scanner
 *
 * This worker processes images using Google's Gemini 2.0 API to detect and count
 * Escape from Tarkov game items in screenshots.
 */

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import dotenv from 'dotenv';

// Load environment variables from .env file when running locally
dotenv.config();

// For local development, get API key from process.env
const localApiKey = process.env.GEMINI_API_KEY;

export interface Env {
	GEMINI_API_KEY?: string;
}

interface BoundingBox {
	x0: number;
	y0: number;
	x1: number;
	y1: number;
}

interface WordWithBBox {
	text: string;
	bbox: BoundingBox;
}

interface OcrResult {
	text: string;
	words: WordWithBBox[];
}

/**
 * Process an image with Gemini 2.0 to detect Escape from Tarkov items
 */
async function processImageWithGemini(imageData: string, apiKey: string): Promise<OcrResult> {
	try {
		// Handle the image data
		let base64Data: string;

		if (imageData.startsWith('data:')) {
			// Image is already in base64 data URL format
			const parts = imageData.split(',');
			if (parts.length < 2) {
				throw new Error('Invalid data URL format');
			}
			base64Data = parts[1];
		} else if (imageData.match(/^[A-Za-z0-9+/=]+$/)) {
			// Image is already in base64 format without the data URL prefix
			base64Data = imageData;
		} else {
			throw new Error('Invalid image data format. Expected base64 or data URL.');
		}

		// Validate that we have base64 data
		if (!base64Data) {
			console.error('Failed to extract base64 data from image');
			throw new Error('Failed to extract base64 data from image');
		}

		console.log('Base64 data length:', base64Data.length);

		// Initialize the Gemini API client
		const genAI = new GoogleGenerativeAI(apiKey);

		// Get the model with system instruction
		const model = genAI.getGenerativeModel({
			model: 'gemini-2.0-pro-exp-02-05',
			systemInstruction:
				'You are an expert in Escape from Tarkov items. Your task is to precisely count the quantity of each item in the image. ONLY return a JSON object where keys are exact item names and values are the precise count of those items. For example: {"RBattery": 3, "Powerbank": 1}. Follow these rules strictly:\n1. Count each item individually and verify the count multiple times\n2. Only include items that are clearly visible in the image\n3. Use exact item names as they appear in-game\n4. Return only integer values representing the exact count\n5. Do not include any explanatory text or descriptions\n6. If an item stack shows a number, use that number as the count',
		});

		// Configure generation parameters
		const generationConfig = {
			temperature: 1,
			topP: 0.95,
			topK: 40,
			maxOutputTokens: 8192,
			responseMimeType: 'text/plain',
		};

		// Create a chat session with history
		const chatSession = model.startChat({
			generationConfig,
			history: [
				{
					role: 'user',
					parts: [
						{
							text: 'count the game items and only return the names and quantities',
						},
					],
				},
				{
					role: 'model',
					parts: [
						{
							text: "I'll analyze the image and count the game items, returning only names and quantities in JSON format.",
						},
					],
				},
			],
		});

		// Send the message with the image
		const parts = [
			{
				inlineData: {
					mimeType: 'image/jpeg',
					data: base64Data,
				},
			},
			{
				text: 'count the game items and only return the names and quantities',
			},
		];

		const result = await chatSession.sendMessage(parts);
		const responseText = result.response.text();
		console.log('Gemini raw response:', responseText);

		// Try to extract JSON from markdown code block if present
		let jsonData: Record<string, number> = {};
		const jsonMatch = responseText.match(/```(?:json)?\s*({[\s\S]*?})\s*```/);
		if (jsonMatch) {
			try {
				jsonData = JSON.parse(jsonMatch[1]);
			} catch (e) {
				console.error('Failed to parse JSON from code block:', e);
			}
		} else {
			// If not in code block, try to find JSON directly
			const directJsonMatch = responseText.match(/{[\s\S]*?}/);
			if (directJsonMatch) {
				try {
					jsonData = JSON.parse(directJsonMatch[0]);
				} catch (e) {
					console.error('Failed to parse direct JSON:', e);
				}
			}
		}

		// If JSON parsing failed, try to extract key-value pairs
		if (Object.keys(jsonData).length === 0) {
			// Try to parse space-separated key-value pairs (e.g., "RBattery: 3 Powerbank: 1")
			const itemRegex = /"?([^":]*)"\s*:\s*(\d+)/g;
			let match;
			while ((match = itemRegex.exec(responseText)) !== null) {
				const [, key, value] = match;
				jsonData[key.trim()] = parseInt(value.trim(), 10);
			}

			// If still no data, try line by line
			if (Object.keys(jsonData).length === 0) {
				const lines = responseText.split('\n');
				lines.forEach((line) => {
					const match = line.match(/"?([^":]*)"\s*:\s*(\d+)/);
					if (match) {
						const [, key, value] = match;
						jsonData[key.trim()] = parseInt(value.trim(), 10);
					}
				});
			}
		}

		console.log('Parsed JSON data:', jsonData);

		// Convert the JSON to the format expected by processOcrText
		let textOutput = '';
		const words: WordWithBBox[] = [];

		Object.entries(jsonData).forEach(([key, value], index) => {
			// Map common abbreviations to full item names for better matching
			const itemName = key;
			const quantity = value;

			// Format the text to include the quantity in a way that processOcrText can parse
			const text = `${itemName}: ${quantity}`;
			textOutput += text + '\n';

			// Create a dummy bounding box since we don't have actual coordinates
			words.push({
				text,
				bbox: {
					x0: 10,
					y0: 10 + index * 20,
					x1: 200,
					y1: 30 + index * 20,
				},
			});
		});

		return {
			text: textOutput,
			words,
		};
	} catch (error) {
		console.error('Error processing image with Gemini:', error);
		throw error;
	}
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		console.log(`Received ${request.method} request to ${request.url}`);
		
		// Handle CORS preflight requests
		if (request.method === 'OPTIONS') {
			console.log('Handling OPTIONS request (CORS preflight)');
			return new Response(null, {
				headers: {
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
					'Access-Control-Allow-Headers': 'Content-Type, Authorization',
					'Access-Control-Max-Age': '86400',
				},
			});
		}

		if (request.method === 'GET' && request.url.endsWith('/health')) {
			console.log('Handling health check request');
			return handleHealthCheck();
		}
		
		// Only allow POST requests
		if (request.method !== 'POST') {
			console.log(`Method ${request.method} not allowed`);
			return new Response('Method not allowed', { 
				status: 405,
				headers: {
					'Access-Control-Allow-Origin': '*',
					'Content-Type': 'application/json'
				}
			});
		}

		try {
			// Get the API key from environment variables
			const apiKey = env.GEMINI_API_KEY;
			if (!apiKey) {
				console.error('Gemini API key not configured');
				return new Response('Gemini API key not configured', {
					status: 500,
					headers: { 
						'Content-Type': 'application/json',
						'Access-Control-Allow-Origin': '*'
					},
				});
			}

			// Parse the request body
			console.log('Parsing request body');
			let requestData;
			try {
				requestData = (await request.json()) as { imageData: string };
			} catch (error) {
				console.error('Error parsing request JSON:', error);
				return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
					status: 400,
					headers: { 
						'Content-Type': 'application/json',
						'Access-Control-Allow-Origin': '*'
					},
				});
			}

			if (!requestData.imageData) {
				console.error('Missing image data in request');
				return new Response('Missing image data', {
					status: 400,
					headers: { 
						'Content-Type': 'application/json',
						'Access-Control-Allow-Origin': '*'
					},
				});
			}

			console.log(`Received image data of length: ${requestData.imageData.length}`);
			
			// Process the image with Gemini
			console.log('Processing image with Gemini');
			const result = await processImageWithGemini(requestData.imageData, apiKey);
			console.log('Gemini processing complete');

			// Return the results
			return new Response(JSON.stringify(result), {
				headers: { 
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*'
				},
			});
		} catch (error) {
			console.error('Worker error:', error);
			return new Response(
				JSON.stringify({
					error: error instanceof Error ? error.message : 'Unknown error',
					stack: error instanceof Error ? error.stack : undefined
				}),
				{
					status: 500,
					headers: { 
						'Content-Type': 'application/json',
						'Access-Control-Allow-Origin': '*'
					},
				}
			);
		}
	},
} satisfies ExportedHandler<Env>;

function handleHealthCheck(): Response | PromiseLike<Response> {
	return new Response('OK', { 
		status: 200,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Content-Type': 'text/plain'
		}
	});
}
