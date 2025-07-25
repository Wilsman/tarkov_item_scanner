/**
 * Gemini OCR Worker for Tarkov Item Scanner
 *
 * This worker processes images using Google's Gemini 2.0 API to detect and count
 * Escape from Tarkov game items in screenshots.
 */

import dotenv from 'dotenv';

// Load environment variables from .env file when running locally
dotenv.config();

// For local development, get API key from process.env
// const localApiKey = process.env.OPENROUTER_API_KEY;

export interface Env {
	OPENROUTER_API_KEY?: string;
}

// OpenRouter API types
interface OpenAIChatCompletionRequest {
	model: string;
	messages: Array<{
		role: 'user' | 'assistant' | 'system';
		content: Array<{
			type: 'text' | 'image_url';
			text?: string;
			image_url?: { url: string };
		}>;
	}>;
	max_tokens?: number;
	response_format?: { type: 'json_object' };
}

interface OpenAIChatCompletionResponse {
	choices: Array<{
		message: {
			content: string | null;
		};
	}>;
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

// Helper function to delay execution
function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Process an image with OpenRouter API to detect Escape from Tarkov items
 */
async function processImageWithOpenRouter(imageData: string, apiKey: string): Promise<OcrResult> {
	const maxRetries = 5;
	const initialDelayMs = 5000;
	let lastError: Error | null = null;

	// Handle the image data
	let dataUrl: string;

	if (imageData.startsWith('data:')) {
		// Image is already in data URL format
		dataUrl = imageData;
	} else if (imageData.match(/^[A-Za-z0-9+/=]+$/)) {
		// Image is in base64 format without the data URL prefix
		dataUrl = `data:image/jpeg;base64,${imageData}`;
	} else {
		throw new Error('Invalid image data format. Expected base64 or data URL.');
	}

	console.log('Image data URL length:', dataUrl.length);

	// Prepare the prompt for Tarkov item detection
	const prompt =
		'You are an expert in Escape from Tarkov items. Your task is to precisely count the quantity of each item in the image. ONLY return a JSON object where keys are exact item names and values are the precise count of those items. For example: {"RBattery": 3, "Powerbank": 1}. Follow these rules strictly:\n1. Count each item individually and verify the count multiple times\n2. Only include items that are clearly visible in the image\n3. Use exact item names as they appear in-game\n4. Return only integer values representing the exact count\n5. Do not include any explanatory text or descriptions\n6. If an item stack shows a number, use that number as the count';

	// Prepare the OpenRouter API request
	const requestData: OpenAIChatCompletionRequest = {
		// model: 'google/gemini-2.0-flash-exp:free',
		model: 'mistralai/mistral-small-3.2-24b-instruct:free',
		messages: [
			{
				role: 'user',
				content: [
					{ type: 'text', text: prompt },
					{ type: 'image_url', image_url: { url: dataUrl } },
				],
			},
		],
		max_tokens: 1000,
		response_format: { type: 'json_object' },
	};

	// Retry loop with exponential backoff
	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			console.log('Sending request to OpenRouter API...');
			console.log(`Attempt ${attempt} of ${maxRetries}...`);

			// Make the API call to OpenRouter
			const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${apiKey}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(requestData),
			});

			console.log('API Response Status:', response.status);

			// Handle rate limiting (429) with retry
			if (response.status === 429) {
				const retryAfter = response.headers.get('retry-after')
					? parseInt(response.headers.get('retry-after')!, 10) * 1000
					: Math.min(initialDelayMs * Math.pow(2, attempt - 1), 60000);

				console.warn(`Rate limited. Waiting ${retryAfter}ms before retry...`);
				await delay(retryAfter);
				continue;
			}

			// Handle other error statuses
			if (response.status >= 400) {
				throw new Error(`OpenRouter API error: ${response.status} - ${response.statusText}`);
			}

			const result: OpenAIChatCompletionResponse = await response.json();
			const responseText = result.choices?.[0]?.message?.content || '';
			console.log('OpenRouter raw response:', responseText);

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
			lastError = error as Error;
			console.error(`Attempt ${attempt} failed:`, error);

			// If we have retries left, wait before the next attempt
			if (attempt < maxRetries) {
				const delayMs = initialDelayMs * Math.pow(2, attempt - 1);
				console.log(`Retrying in ${delayMs}ms...`);
				await delay(delayMs);
			}
		}
	}

	// If we've exhausted all retries, throw the last error
	throw lastError || new Error('Failed to process image after multiple attempts');
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
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
					'Content-Type': 'application/json',
				},
			});
		}

		try {
			// Get the API key from environment variables
			const apiKey = env.OPENROUTER_API_KEY;
			if (!apiKey) {
				console.error('OpenRouter API key not configured');
				return new Response('OpenRouter API key not configured', {
					status: 500,
					headers: {
						'Content-Type': 'application/json',
						'Access-Control-Allow-Origin': '*',
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
						'Access-Control-Allow-Origin': '*',
					},
				});
			}

			if (!requestData.imageData) {
				console.error('Missing image data in request');
				return new Response('Missing image data', {
					status: 400,
					headers: {
						'Content-Type': 'application/json',
						'Access-Control-Allow-Origin': '*',
					},
				});
			}

			console.log(`Received image data of length: ${requestData.imageData.length}`);

			// Process the image with OpenRouter
			console.log('Processing image with OpenRouter');
			const result = await processImageWithOpenRouter(requestData.imageData, apiKey);
			console.log('OpenRouter processing complete');

			// Return the results
			return new Response(JSON.stringify(result), {
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*',
				},
			});
		} catch (error) {
			console.error('Worker error:', error);
			return new Response(
				JSON.stringify({
					error: error instanceof Error ? error.message : 'Unknown error',
					stack: error instanceof Error ? error.stack : undefined,
				}),
				{
					status: 500,
					headers: {
						'Content-Type': 'application/json',
						'Access-Control-Allow-Origin': '*',
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
			'Content-Type': 'text/plain',
		},
	});
}
