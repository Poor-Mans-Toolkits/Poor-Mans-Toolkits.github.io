/**
 * Smart Batcher Module
 * Splits subtitles into batches for efficient API processing
 */

/**
 * @typedef {import('./parser.js').SubtitleEntry} SubtitleEntry
 */

/**
 * Batch configuration
 * @typedef {Object} BatchConfig
 * @property {number} maxEntriesPerBatch - Maximum number of entries per batch
 * @property {number} contextOverlap - Number of previous entries to include for context
 */

/**
 * Batch object
 * @typedef {Object} Batch
 * @property {number} index - Batch index (0-based)
 * @property {SubtitleEntry[]} entries - Subtitle entries in this batch
 * @property {SubtitleEntry[]} contextEntries - Previous entries for translation context
 * @property {number} startIndex - Start index in original entries array
 * @property {number} endIndex - End index in original entries array
 */

/**
 * Default batch configuration
 * Conservative settings for optimal translation quality
 */
export const DEFAULT_CONFIG = {
    maxEntriesPerBatch: 50,
    contextOverlap: 3
};

/**
 * Estimate token count for a string
 * Rough estimation: ~4 characters per token for English
 * @param {string} text - Text to estimate tokens for
 * @returns {number} Estimated token count
 */
export function estimateTokens(text) {
    // More conservative estimate for multilingual content
    return Math.ceil(text.length / 3);
}

/**
 * Calculate estimated tokens for a batch
 * @param {SubtitleEntry[]} entries - Entries to calculate tokens for
 * @returns {number} Estimated token count
 */
export function calculateBatchTokens(entries) {
    let total = 0;
    for (const entry of entries) {
        // Include timestamp and text
        total += estimateTokens(`${entry.startTime} --> ${entry.endTime}`);
        total += estimateTokens(entry.text);
        total += 10; // Overhead for formatting
    }
    return total;
}

/**
 * Create batches from subtitle entries
 * @param {SubtitleEntry[]} entries - All subtitle entries
 * @param {number} batchSize - Number of entries per batch
 * @returns {Batch[]} Array of batch objects
 */
export function createBatches(entries, batchSize = DEFAULT_CONFIG.maxEntriesPerBatch) {
    const batches = [];
    const totalEntries = entries.length;
    
    if (totalEntries === 0) {
        return batches;
    }
    
    // Ensure batch size is within reasonable bounds
    const actualBatchSize = Math.max(10, Math.min(batchSize, 100));
    
    let currentIndex = 0;
    let batchIndex = 0;
    
    while (currentIndex < totalEntries) {
        const startIndex = currentIndex;
        const endIndex = Math.min(currentIndex + actualBatchSize, totalEntries);
        
        // Get entries for this batch
        const batchEntries = entries.slice(startIndex, endIndex);
        
        // Get context from previous translations (for consistency)
        const contextStart = Math.max(0, startIndex - DEFAULT_CONFIG.contextOverlap);
        const contextEntries = startIndex > 0 
            ? entries.slice(contextStart, startIndex) 
            : [];
        
        batches.push({
            index: batchIndex,
            entries: batchEntries,
            contextEntries,
            startIndex,
            endIndex
        });
        
        currentIndex = endIndex;
        batchIndex++;
    }
    
    return batches;
}

/**
 * Get batch statistics
 * @param {Batch[]} batches - Array of batches
 * @returns {Object} Statistics object
 */
export function getBatchStats(batches) {
    const totalBatches = batches.length;
    const totalEntries = batches.reduce((sum, b) => sum + b.entries.length, 0);
    const avgEntriesPerBatch = totalBatches > 0 ? Math.round(totalEntries / totalBatches) : 0;
    
    // Estimate total tokens
    let estimatedTokens = 0;
    for (const batch of batches) {
        estimatedTokens += calculateBatchTokens(batch.entries);
        estimatedTokens += calculateBatchTokens(batch.contextEntries);
    }
    
    return {
        totalBatches,
        totalEntries,
        avgEntriesPerBatch,
        estimatedTokens
    };
}

/**
 * Format entries for API request
 * Creates a structured format that's easy for the AI to parse
 * @param {SubtitleEntry[]} entries - Entries to format
 * @returns {string} Formatted string for API
 */
export function formatEntriesForAPI(entries) {
    return entries.map(entry => {
        return `[${entry.index}]\n${entry.text}`;
    }).join('\n---\n');
}

/**
 * Format context entries for the API prompt
 * @param {SubtitleEntry[]} contextEntries - Previous entries for context
 * @param {SubtitleEntry[]} translatedContext - Their translations (if available)
 * @returns {string} Formatted context string
 */
export function formatContextForAPI(contextEntries, translatedContext = []) {
    if (contextEntries.length === 0) return '';
    
    const contextPairs = contextEntries.map((entry, i) => {
        const translation = translatedContext[i];
        if (translation) {
            return `Original: ${entry.text}\nTranslation: ${translation.text}`;
        }
        return `Original: ${entry.text}`;
    });
    
    return contextPairs.join('\n\n');
}

/**
 * Parse API response back to entries
 * Expects format: [index]\ntext\n---\n[index]\ntext...
 * @param {string} response - API response text
 * @param {SubtitleEntry[]} originalEntries - Original entries for reference
 * @returns {SubtitleEntry[]} Parsed translated entries
 */
export function parseAPIResponse(response, originalEntries) {
    const translatedEntries = [];
    
    // Split response by separator
    const blocks = response.split(/\n---\n|\n-{3,}\n/);
    
    for (let i = 0; i < blocks.length && i < originalEntries.length; i++) {
        const block = blocks[i].trim();
        if (!block) continue;
        
        const original = originalEntries[i];
        
        // Try to parse [index] format
        const indexMatch = block.match(/^\[(\d+)\]\n?([\s\S]*)/);
        
        let translatedText;
        if (indexMatch) {
            translatedText = indexMatch[2].trim();
        } else {
            // Fallback: use entire block as translation
            translatedText = block;
        }
        
        // Create translated entry preserving timing
        translatedEntries.push({
            index: original.index,
            startTime: original.startTime,
            endTime: original.endTime,
            text: translatedText
        });
    }
    
    // Handle case where response has fewer entries than expected
    // Fill remaining with original text (marked as untranslated)
    while (translatedEntries.length < originalEntries.length) {
        const original = originalEntries[translatedEntries.length];
        translatedEntries.push({
            index: original.index,
            startTime: original.startTime,
            endTime: original.endTime,
            text: original.text
        });
    }
    
    return translatedEntries;
}

/**
 * Merge translated batches back into a single array
 * @param {Array<SubtitleEntry[]>} translatedBatches - Array of translated batch entries
 * @returns {SubtitleEntry[]} Merged entries array
 */
export function mergeBatches(translatedBatches) {
    return translatedBatches.flat();
}

/**
 * Create a progress tracker for batch processing
 * @param {number} totalBatches - Total number of batches
 * @returns {Object} Progress tracker object
 */
export function createProgressTracker(totalBatches) {
    let completedBatches = 0;
    let completedEntries = 0;
    let totalEntries = 0;
    
    return {
        /**
         * Set total entries count
         * @param {number} total - Total entries
         */
        setTotalEntries(total) {
            totalEntries = total;
        },
        
        /**
         * Mark a batch as completed
         * @param {number} entriesInBatch - Number of entries in completed batch
         */
        completeBatch(entriesInBatch) {
            completedBatches++;
            completedEntries += entriesInBatch;
        },
        
        /**
         * Get current progress
         * @returns {Object} Progress information
         */
        getProgress() {
            const percent = totalBatches > 0 
                ? Math.round((completedBatches / totalBatches) * 100) 
                : 0;
            
            return {
                completedBatches,
                totalBatches,
                completedEntries,
                totalEntries,
                percent
            };
        },
        
        /**
         * Check if processing is complete
         * @returns {boolean} True if all batches completed
         */
        isComplete() {
            return completedBatches >= totalBatches;
        },
        
        /**
         * Reset the tracker
         */
        reset() {
            completedBatches = 0;
            completedEntries = 0;
        }
    };
}
