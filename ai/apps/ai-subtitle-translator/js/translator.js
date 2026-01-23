/**
 * Gemini Translator Module
 * Handles communication with Google Gemini API for translations
 */

import { formatEntriesForAPI, formatContextForAPI, parseAPIResponse } from './batcher.js';

/**
 * @typedef {import('./parser.js').SubtitleEntry} SubtitleEntry
 * @typedef {import('./batcher.js').Batch} Batch
 */

/**
 * Gemini API configuration
 */
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
// Using gemini-2.0-flash as it's more stable. Change to 'gemini-1.5-flash' if issues persist.
const GEMINI_MODEL = 'gemini-2.0-flash';

/**
 * Language names mapping for prompts
 */
const LANGUAGE_NAMES = {
    persian: 'Persian (Farsi)',
    arabic: 'Arabic',
    spanish: 'Spanish',
    french: 'French',
    german: 'German',
    italian: 'Italian',
    portuguese: 'Portuguese',
    russian: 'Russian',
    chinese: 'Simplified Chinese',
    japanese: 'Japanese',
    korean: 'Korean',
    turkish: 'Turkish',
    hindi: 'Hindi'
};

/**
 * Get the full language name for prompts
 * @param {string} langCode - Language code
 * @returns {string} Full language name
 */
function getLanguageName(langCode) {
    return LANGUAGE_NAMES[langCode] || langCode;
}

/**
 * Create the translation prompt for Gemini
 * @param {SubtitleEntry[]} entries - Entries to translate
 * @param {string} targetLang - Target language code
 * @param {SubtitleEntry[]} contextEntries - Previous entries for context
 * @param {SubtitleEntry[]} translatedContext - Previous translations
 * @returns {string} The prompt string
 */
function createTranslationPrompt(entries, targetLang, contextEntries = [], translatedContext = []) {
    const langName = getLanguageName(targetLang);

    let prompt = `You are a professional subtitle translator. Translate the following English subtitles to ${langName}.

CRITICAL RULES:
1. Translate ONLY the text, preserving the exact format
2. Keep the [number] markers exactly as they appear
3. Maintain the same number of subtitle entries
4. Use natural, conversational ${langName} appropriate for subtitles
5. Keep translations concise to fit on screen
6. Preserve any speaker labels or sound descriptions in brackets
7. Do NOT add any explanations or notes
8. Separate each translated entry with "---" on its own line

`;

    // Add context if available
    if (contextEntries.length > 0) {
        const contextStr = formatContextForAPI(contextEntries, translatedContext);
        prompt += `PREVIOUS CONTEXT (for consistency):
${contextStr}

`;
    }

    prompt += `SUBTITLES TO TRANSLATE:
${formatEntriesForAPI(entries)}

TRANSLATED SUBTITLES (in ${langName}):`;

    return prompt;
}

// Current model (can be changed at runtime)
let currentModel = GEMINI_MODEL;

/**
 * Set the model to use
 * @param {string} model - Model name
 */
export function setModel(model) {
    currentModel = model;
    console.log(`Model set to: ${model}`);
}

/**
 * Get the current model
 * @returns {string} Current model name
 */
export function getModel() {
    return currentModel;
}

/**
 * Call the Gemini API
 * @param {string} apiKey - Gemini API key
 * @param {string} prompt - The prompt to send
 * @returns {Promise<string>} The response text
 */
async function callGeminiAPI(apiKey, prompt) {
    const url = `${GEMINI_API_BASE}/${currentModel}:generateContent?key=${apiKey}`;

    const requestBody = {
        contents: [{
            parts: [{
                text: prompt
            }]
        }],
        generationConfig: {
            temperature: 0.3, // Lower temperature for more consistent translations
            topP: 0.8,
            topK: 40,
            maxOutputTokens: 8192
        },
        safetySettings: [
            {
                category: 'HARM_CATEGORY_HARASSMENT',
                threshold: 'BLOCK_NONE'
            },
            {
                category: 'HARM_CATEGORY_HATE_SPEECH',
                threshold: 'BLOCK_NONE'
            },
            {
                category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                threshold: 'BLOCK_NONE'
            },
            {
                category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                threshold: 'BLOCK_NONE'
            }
        ]
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || `HTTP ${response.status}`;

        if (response.status === 400) {
            throw new Error(`Invalid request: ${errorMessage}`);
        } else if (response.status === 401 || response.status === 403) {
            throw new Error('Invalid API key. Please check your Gemini API key.');
        } else if (response.status === 429) {
            throw new Error('Rate limit exceeded. Please wait a moment and try again.');
        } else if (response.status >= 500) {
            throw new Error('Gemini API server error. Please try again later.');
        }

        throw new Error(`API error: ${errorMessage}`);
    }

    const data = await response.json();

    // Log raw response for debugging
    console.log('Gemini API response:', JSON.stringify(data, null, 2));

    // Check for blocked content
    if (data.promptFeedback?.blockReason) {
        throw new Error(`Content blocked: ${data.promptFeedback.blockReason}`);
    }

    // Extract text from response
    const candidates = data.candidates;
    if (!candidates || candidates.length === 0) {
        // Check if there's feedback about why
        const feedback = data.promptFeedback;
        if (feedback) {
            throw new Error(`No response from Gemini API. Feedback: ${JSON.stringify(feedback)}`);
        }
        throw new Error('No response from Gemini API - empty candidates');
    }

    // Check if candidate was blocked
    const candidate = candidates[0];
    if (candidate.finishReason === 'SAFETY') {
        const safetyRatings = candidate.safetyRatings?.map(r => `${r.category}: ${r.probability}`).join(', ');
        throw new Error(`Response blocked by safety filter: ${safetyRatings || 'unknown reason'}`);
    }

    if (candidate.finishReason === 'RECITATION') {
        throw new Error('Response blocked due to recitation/copyright concerns');
    }

    const content = candidate.content;
    if (!content || !content.parts || content.parts.length === 0) {
        // Return more details about what we got
        throw new Error(`Empty response from Gemini API. Finish reason: ${candidate.finishReason || 'unknown'}`);
    }

    return content.parts[0].text;
}

/**
 * Translate a batch of subtitles
 * @param {string} apiKey - Gemini API key
 * @param {Batch} batch - Batch to translate
 * @param {string} targetLang - Target language code
 * @param {SubtitleEntry[]} translatedContext - Previous translations for context
 * @returns {Promise<SubtitleEntry[]>} Translated entries
 */
export async function translateBatch(apiKey, batch, targetLang, translatedContext = []) {
    const prompt = createTranslationPrompt(
        batch.entries,
        targetLang,
        batch.contextEntries,
        translatedContext
    );

    const response = await callGeminiAPI(apiKey, prompt);

    // Parse the response back to entries
    const translatedEntries = parseAPIResponse(response, batch.entries);

    return translatedEntries;
}

/**
 * Translate a batch with exponential backoff retry
 * @param {string} apiKey - Gemini API key
 * @param {Batch} batch - Batch to translate
 * @param {string} targetLang - Target language code
 * @param {SubtitleEntry[]} translatedContext - Previous translations for context
 * @param {number} maxRetries - Maximum number of retries
 * @param {AbortSignal} [signal] - Optional abort signal
 * @param {Function} [onWaiting] - Callback when waiting for retry
 * @returns {Promise<SubtitleEntry[]>} Translated entries
 */
async function translateBatchWithRetry(apiKey, batch, targetLang, translatedContext, maxRetries = 5, signal, onWaiting) {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        // Check for abort
        if (signal?.aborted) {
            throw new Error('Translation cancelled');
        }

        try {
            const translatedEntries = await translateBatch(
                apiKey,
                batch,
                targetLang,
                translatedContext
            );
            return translatedEntries;
        } catch (error) {
            lastError = error;

            // Retry on rate limit OR empty response errors
            const isRetryable =
                error.message.includes('Rate limit') ||
                error.message.includes('429') ||
                error.message.includes('Too Many') ||
                error.message.includes('Empty response') ||
                error.message.includes('empty candidates') ||
                error.message.includes('No response from Gemini');

            if (!isRetryable) {
                throw error;
            }

            console.log(`Retryable error: ${error.message}`);

            if (attempt < maxRetries) {
                // Much longer exponential backoff: 15s, 30s, 60s, 120s, 240s
                const baseDelay = 15000;
                const backoffDelay = baseDelay * Math.pow(2, attempt);
                const jitter = Math.random() * 2000;
                const totalDelay = backoffDelay + jitter;

                const waitSeconds = Math.round(totalDelay / 1000);
                console.log(`Rate limited. Waiting ${waitSeconds}s before retry (attempt ${attempt + 1}/${maxRetries})...`);

                if (onWaiting) {
                    onWaiting(waitSeconds, attempt + 1, maxRetries);
                }

                await delay(totalDelay);
            }
        }
    }

    throw lastError;
}

/**
 * Translate all batches with progress tracking
 * @param {string} apiKey - Gemini API key
 * @param {Batch[]} batches - All batches to translate
 * @param {string} targetLang - Target language code
 * @param {Function} onProgress - Progress callback (completedBatches, totalBatches, currentBatchEntries, statusText)
 * @param {AbortSignal} [signal] - Optional abort signal
 * @param {Function} [onLog] - Log callback (type, message, details, batchInfo)
 * @param {Function} [onBatchComplete] - Called after each batch with all translated entries so far
 * @param {number} [startFromBatch=0] - Batch index to start/resume from
 * @param {SubtitleEntry[]} [existingEntries=[]] - Already translated entries when resuming
 * @returns {Promise<SubtitleEntry[]>} All translated entries
 */
export async function translateAllBatches(apiKey, batches, targetLang, onProgress, signal, onLog, onBatchComplete, startFromBatch = 0, existingEntries = []) {
    const allTranslatedEntries = [...existingEntries];

    // Much longer delay between batches (4 seconds) to stay under rate limits
    // Gemini free tier: ~15 requests per minute = 1 request per 4 seconds
    const BATCH_DELAY = 4000;

    // Log if resuming
    if (startFromBatch > 0 && onLog) {
        onLog('response', `Resuming from batch ${startFromBatch + 1}`, `${existingEntries.length} subtitles already translated`);
    }

    for (let i = startFromBatch; i < batches.length; i++) {
        // Check for abort
        if (signal?.aborted) {
            throw new Error('Translation cancelled');
        }

        const batch = batches[i];
        const batchNum = `${i + 1}/${batches.length}`;

        // Get context from previously translated entries
        const contextStart = Math.max(0, allTranslatedEntries.length - 3);
        const translatedContext = allTranslatedEntries.slice(contextStart);

        // Update status to show we're translating
        if (onProgress) {
            onProgress(i, batches.length, batch.entries.length, `Translating batch ${i + 1} of ${batches.length}...`);
        }

        // Log request
        if (onLog) {
            const sampleText = batch.entries.slice(0, 3).map(e => `[${e.index}] ${e.text}`).join('\n');
            onLog('request', `Sending ${batch.entries.length} subtitles to Gemini`, sampleText, batchNum);
        }

        try {
            // Translate the batch with retry logic
            const translatedEntries = await translateBatchWithRetry(
                apiKey,
                batch,
                targetLang,
                translatedContext,
                5, // maxRetries
                signal,
                (waitSeconds, attempt, maxRetries) => {
                    // Update UI to show waiting status
                    if (onProgress) {
                        onProgress(i, batches.length, 0, `Rate limited. Waiting ${waitSeconds}s... (retry ${attempt}/${maxRetries})`);
                    }
                    // Log waiting
                    if (onLog) {
                        onLog('waiting', `Rate limited - waiting ${waitSeconds}s (attempt ${attempt}/${maxRetries})`, null, batchNum);
                    }
                }
            );

            // Log response
            if (onLog) {
                const sampleTranslation = translatedEntries.slice(0, 3).map(e => `[${e.index}] ${e.text}`).join('\n');
                onLog('response', `Received ${translatedEntries.length} translated subtitles`, sampleTranslation, batchNum);
            }

            // Add to results
            allTranslatedEntries.push(...translatedEntries);

            // Save progress after each successful batch
            if (onBatchComplete) {
                onBatchComplete(i + 1, allTranslatedEntries);
            }

            // Report progress
            if (onProgress) {
                onProgress(i + 1, batches.length, batch.entries.length, `Completed batch ${i + 1} of ${batches.length}`);
            }

        } catch (error) {
            // Save progress before throwing so user can resume
            if (onBatchComplete) {
                onBatchComplete(i, allTranslatedEntries, true); // true = failed
            }
            throw error;
        }

        // Delay between batches to avoid rate limiting
        if (i < batches.length - 1) {
            // Show waiting message
            if (onProgress) {
                onProgress(i + 1, batches.length, 0, `Waiting before next batch...`);
            }
            await delay(BATCH_DELAY);
        }
    }

    return allTranslatedEntries;
}

/**
 * Validate API key by making a simple test request
 * @param {string} apiKey - API key to validate
 * @returns {Promise<boolean>} True if valid
 */
export async function validateApiKey(apiKey) {
    if (!apiKey || apiKey.trim().length === 0) {
        return false;
    }

    try {
        const url = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: 'Say "OK" if you receive this.'
                    }]
                }],
                generationConfig: {
                    maxOutputTokens: 10
                }
            })
        });

        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Delay helper
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
