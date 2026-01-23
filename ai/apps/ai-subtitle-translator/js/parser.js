/**
 * Subtitle Parser Module
 * Handles parsing and generating SRT and VTT subtitle formats
 */

/**
 * Subtitle entry structure
 * @typedef {Object} SubtitleEntry
 * @property {number} index - The subtitle index/number
 * @property {string} startTime - Start timestamp
 * @property {string} endTime - End timestamp
 * @property {string} text - The subtitle text content
 */

/**
 * Parsed subtitle file structure
 * @typedef {Object} ParsedSubtitle
 * @property {string} format - 'srt' or 'vtt'
 * @property {string} header - VTT header (empty for SRT)
 * @property {SubtitleEntry[]} entries - Array of subtitle entries
 */

/**
 * Detect the format of a subtitle file
 * @param {string} content - Raw subtitle file content
 * @returns {'srt' | 'vtt'} The detected format
 */
export function detectFormat(content) {
    const trimmed = content.trim();
    if (trimmed.startsWith('WEBVTT')) {
        return 'vtt';
    }
    return 'srt';
}

/**
 * Parse an SRT file
 * @param {string} content - Raw SRT file content
 * @returns {ParsedSubtitle} Parsed subtitle object
 */
export function parseSRT(content) {
    const entries = [];
    const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Split by double newlines to get blocks
    const blocks = normalizedContent.trim().split(/\n\n+/);
    
    for (const block of blocks) {
        const lines = block.trim().split('\n');
        if (lines.length < 3) continue;
        
        // First line is the index
        const index = parseInt(lines[0].trim(), 10);
        if (isNaN(index)) continue;
        
        // Second line is the timestamp
        const timestampLine = lines[1].trim();
        const timestampMatch = timestampLine.match(
            /(\d{2}:\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,\.]\d{3})/
        );
        
        if (!timestampMatch) continue;
        
        const startTime = timestampMatch[1];
        const endTime = timestampMatch[2];
        
        // Remaining lines are the text
        const text = lines.slice(2).join('\n');
        
        entries.push({
            index,
            startTime,
            endTime,
            text
        });
    }
    
    return {
        format: 'srt',
        header: '',
        entries
    };
}

/**
 * Parse a VTT file
 * @param {string} content - Raw VTT file content
 * @returns {ParsedSubtitle} Parsed subtitle object
 */
export function parseVTT(content) {
    const entries = [];
    const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Split content into header and cues
    const parts = normalizedContent.split(/\n\n+/);
    
    // First part should be the header (WEBVTT line + optional metadata)
    let header = '';
    let startIndex = 0;
    
    if (parts[0].trim().startsWith('WEBVTT')) {
        header = parts[0].trim();
        startIndex = 1;
    }
    
    let cueIndex = 1;
    
    for (let i = startIndex; i < parts.length; i++) {
        const block = parts[i].trim();
        if (!block) continue;
        
        const lines = block.split('\n');
        
        // Find the timestamp line
        let timestampLineIndex = 0;
        let cueId = null;
        
        // Check if first line is a cue identifier (doesn't contain -->)
        if (lines[0] && !lines[0].includes('-->')) {
            cueId = lines[0].trim();
            timestampLineIndex = 1;
        }
        
        if (timestampLineIndex >= lines.length) continue;
        
        const timestampLine = lines[timestampLineIndex];
        const timestampMatch = timestampLine.match(
            /(\d{2}:\d{2}:\d{2}\.\d{3}|\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3}|\d{2}:\d{2}\.\d{3})/
        );
        
        if (!timestampMatch) continue;
        
        const startTime = timestampMatch[1];
        const endTime = timestampMatch[2];
        
        // Remaining lines are the text
        const text = lines.slice(timestampLineIndex + 1).join('\n');
        
        entries.push({
            index: cueId ? parseInt(cueId, 10) || cueIndex : cueIndex,
            startTime,
            endTime,
            text
        });
        
        cueIndex++;
    }
    
    return {
        format: 'vtt',
        header: header || 'WEBVTT',
        entries
    };
}

/**
 * Parse a subtitle file (auto-detect format)
 * @param {string} content - Raw subtitle file content
 * @returns {ParsedSubtitle} Parsed subtitle object
 */
export function parseSubtitle(content) {
    const format = detectFormat(content);
    return format === 'vtt' ? parseVTT(content) : parseSRT(content);
}

/**
 * Generate an SRT file from entries
 * @param {SubtitleEntry[]} entries - Array of subtitle entries
 * @returns {string} Generated SRT content
 */
export function generateSRT(entries) {
    return entries.map((entry, i) => {
        const index = entry.index || i + 1;
        // Ensure timestamps use comma separator for SRT
        const startTime = entry.startTime.replace('.', ',');
        const endTime = entry.endTime.replace('.', ',');
        
        return `${index}\n${startTime} --> ${endTime}\n${entry.text}`;
    }).join('\n\n');
}

/**
 * Generate a VTT file from entries
 * @param {SubtitleEntry[]} entries - Array of subtitle entries
 * @param {string} [header='WEBVTT'] - VTT header
 * @returns {string} Generated VTT content
 */
export function generateVTT(entries, header = 'WEBVTT') {
    const cues = entries.map((entry, i) => {
        const index = entry.index || i + 1;
        // Ensure timestamps use period separator for VTT
        const startTime = entry.startTime.replace(',', '.');
        const endTime = entry.endTime.replace(',', '.');
        
        return `${index}\n${startTime} --> ${endTime}\n${entry.text}`;
    }).join('\n\n');
    
    return `${header}\n\n${cues}`;
}

/**
 * Generate a subtitle file from parsed data
 * @param {ParsedSubtitle} subtitle - Parsed subtitle object with translated entries
 * @returns {string} Generated subtitle content
 */
export function generateSubtitle(subtitle) {
    if (subtitle.format === 'vtt') {
        return generateVTT(subtitle.entries, subtitle.header);
    }
    return generateSRT(subtitle.entries);
}

/**
 * Create a preview of subtitle entries (first N entries)
 * @param {SubtitleEntry[]} entries - Array of subtitle entries
 * @param {number} [count=10] - Number of entries to preview
 * @returns {string} Preview text
 */
export function createPreview(entries, count = 10) {
    const previewEntries = entries.slice(0, count);
    return previewEntries.map((entry, i) => {
        return `[${entry.index || i + 1}] ${entry.startTime} --> ${entry.endTime}\n${entry.text}`;
    }).join('\n\n');
}

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
export function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}
