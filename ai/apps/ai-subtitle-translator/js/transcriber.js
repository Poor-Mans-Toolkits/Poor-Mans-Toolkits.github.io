/**
 * ElevenLabs Transcriber Module
 * Sends extracted audio to the ElevenLabs Speech-to-Text (Scribe) API and
 * returns subtitles in SRT format.
 *
 * The batch endpoint exposes permissive CORS headers, so it can be called
 * directly from the browser using the xi-api-key header (same client-side trust
 * model as the existing Gemini key).
 */
(function (g) {
    'use strict';

    const ELEVENLABS_STT_URL = 'https://api.elevenlabs.io/v1/speech-to-text';

    function pad2(n) { return String(n).padStart(2, '0'); }
    function pad3(n) { return String(n).padStart(3, '0'); }

    /**
     * Convert seconds (float) to an SRT timestamp: HH:MM:SS,mmm
     */
    function secondsToSrtTime(totalSeconds) {
        let t = Number(totalSeconds);
        if (!isFinite(t) || t < 0) t = 0;
        const ms = Math.round((t - Math.floor(t)) * 1000);
        let whole = Math.floor(t);
        const h = Math.floor(whole / 3600);
        whole -= h * 3600;
        const m = Math.floor(whole / 60);
        const s = whole - m * 60;
        // Guard against rounding ms up to 1000.
        if (ms >= 1000) {
            return `${pad2(h)}:${pad2(m)}:${pad2(s + 1)},000`;
        }
        return `${pad2(h)}:${pad2(m)}:${pad2(s)},${pad3(ms)}`;
    }

    /**
     * Decode a base64 string to UTF-8 text.
     */
    function decodeBase64Utf8(str) {
        try {
            const binary = atob(str);
            const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
            return new TextDecoder('utf-8').decode(bytes);
        } catch (e) {
            try { return atob(str); } catch (e2) { return str; }
        }
    }

    /**
     * Fallback SRT builder: group word-level timestamps into readable cues.
     * @param {Array} words - ElevenLabs words array (text/start/end/type).
     * @param {number} [maxDuration=4] - Max seconds per cue.
     * @param {number} [maxChars=84] - Max characters per cue.
     * @returns {string} SRT text
     */
    function buildSrtFromWords(words, maxDuration = 4, maxChars = 84) {
        const cues = [];
        let current = null;

        for (const w of (words || [])) {
            if (!w) continue;
            if (w.type && w.type !== 'word') continue; // skip spacing / audio_event
            const text = (w.text || '').trim();
            if (!text) continue;

            const start = typeof w.start === 'number' ? w.start : (current ? current.end : 0);
            const end = typeof w.end === 'number' ? w.end : start;

            if (!current) {
                current = { start, end, text };
                continue;
            }

            const candidate = current.text + ' ' + text;
            const duration = end - current.start;

            if (candidate.length > maxChars || duration > maxDuration) {
                cues.push(current);
                current = { start, end, text };
            } else {
                current.text = candidate;
                current.end = end;
            }
        }
        if (current) cues.push(current);

        return cues
            .map((c, i) => `${i + 1}\n${secondsToSrtTime(c.start)} --> ${secondsToSrtTime(c.end)}\n${c.text}`)
            .join('\n\n');
    }

    /**
     * Extract a human-readable error message from a failed response.
     */
    async function readError(response) {
        try {
            const data = await response.json();
            let detail = data && (data.detail || data.message || data.error);
            if (detail && typeof detail === 'object') {
                detail = detail.message || JSON.stringify(detail);
            }
            return detail ? String(detail) : JSON.stringify(data);
        } catch (e) {
            try { return await response.text(); } catch (e2) { return ''; }
        }
    }

    /**
     * Transcribe an audio blob to SRT using ElevenLabs Scribe.
     * @param {string} apiKey - ElevenLabs API key.
     * @param {Blob} audioBlob - The extracted audio.
     * @param {Object} [opts] - { model, fileName, languageCode }
     * @param {Function} [onLog] - (type, message, details) logging callback.
     * @returns {Promise<string>} SRT text
     */
    async function transcribeToSRT(apiKey, audioBlob, opts = {}, onLog) {
        if (!apiKey || !apiKey.trim()) {
            throw new Error('ElevenLabs API key is required.');
        }
        if (!audioBlob || !audioBlob.size) {
            throw new Error('No audio to transcribe.');
        }

        const model = opts.model || 'scribe_v1';
        const fileName = opts.fileName || 'audio.mp3';

        const form = new FormData();
        form.append('file', audioBlob, fileName);
        form.append('model_id', model);
        form.append('tag_audio_events', 'false');
        // ElevenLabs requires diarization + word timestamps whenever
        // additional_formats is requested. The exported SRT contains no speaker
        // labels, so diarize only satisfies that API requirement.
        form.append('diarize', 'true');
        form.append('timestamps_granularity', 'word');
        // Ask the API to export ready-made SRT so we can reuse the parser.
        form.append('additional_formats', JSON.stringify([{ format: 'srt' }]));
        if (opts.languageCode) form.append('language_code', opts.languageCode);

        if (onLog) {
            onLog('request', 'Sending audio to ElevenLabs Scribe',
                `Model: ${model}\nSize: ${(audioBlob.size / (1024 * 1024)).toFixed(2)} MB`);
        }

        let response;
        try {
            response = await fetch(ELEVENLABS_STT_URL, {
                method: 'POST',
                headers: { 'xi-api-key': apiKey.trim() },
                body: form
            });
        } catch (err) {
            throw new Error('Network error contacting ElevenLabs. Check your connection. (' + err.message + ')');
        }

        if (!response.ok) {
            const detail = await readError(response);
            if (response.status === 401) {
                throw new Error('Invalid ElevenLabs API key. Please check your key.');
            } else if (response.status === 422) {
                throw new Error('ElevenLabs could not process the audio: ' + String(detail).slice(0, 300));
            } else if (response.status === 429) {
                throw new Error('ElevenLabs rate limit or quota exceeded. Please try again later.');
            }
            throw new Error(`ElevenLabs error ${response.status}: ${String(detail).slice(0, 300)}`);
        }

        const data = await response.json();

        // Prefer the ready-made SRT from additional_formats.
        const formats = Array.isArray(data.additional_formats) ? data.additional_formats : [];
        const srtFormat = formats.find((f) => f && (f.requested_format === 'srt' || f.file_extension === 'srt')) || formats[0];

        let srtText = '';
        if (srtFormat && srtFormat.content) {
            srtText = srtFormat.is_base64_encoded ? decodeBase64Utf8(srtFormat.content) : srtFormat.content;
        } else if (data.words && data.words.length) {
            srtText = buildSrtFromWords(data.words);
        } else if (data.text) {
            srtText = `1\n00:00:00,000 --> 00:00:05,000\n${data.text}`;
        }

        if (!srtText || !srtText.trim()) {
            throw new Error('ElevenLabs returned no transcription. The audio may be silent or unsupported.');
        }

        if (onLog) {
            const lang = data.language_code ? ` (detected language: ${data.language_code})` : '';
            const cueCount = (srtText.match(/-->/g) || []).length;
            onLog('response', `Transcription received${lang}`, `${cueCount} subtitle cues generated`);
        }

        return srtText;
    }

    const ns = g.ST = g.ST || {};
    Object.assign(ns, {
        transcribeToSRT,
        buildSrtFromWords
    });
})(typeof globalThis !== 'undefined' ? globalThis : window);
