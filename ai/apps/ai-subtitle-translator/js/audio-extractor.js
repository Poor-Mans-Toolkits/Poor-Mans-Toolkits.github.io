/**
 * Audio Extractor Module
 * Extracts audio from a video file entirely in the browser using ffmpeg.wasm.
 *
 * Uses the single-threaded @ffmpeg/core build loaded through blob URLs, so it
 * needs no COOP/COEP cross-origin-isolation headers and works on GitHub Pages.
 *
 * Note: ffmpeg.wasm spawns a Web Worker, which browsers block on the file://
 * protocol. Video import therefore requires serving the app over http(s).
 */
(function (g) {
    'use strict';

    const CORE_VER = '0.12.10';
    // Only the big core/wasm come from the CDN; the ffmpeg.js + 814.ffmpeg.js worker
    // are vendored locally (see index.html) so the worker is same-origin/classic.
    const CORE_BASE = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${CORE_VER}/dist/umd`;

    let _ffmpeg = null;
    let _loadPromise = null;

    /**
     * Whether the ffmpeg UMD global is present (CDN script loaded).
     * Note: we deliberately do NOT depend on @ffmpeg/util's UMD build, because
     * its bundle references CommonJS require()/exports and throws when loaded via
     * a plain <script> tag. The two helpers we need are implemented below.
     * @returns {boolean}
     */
    function isFFmpegAvailable() {
        return typeof g.FFmpegWASM !== 'undefined' && !!(g.FFmpegWASM && g.FFmpegWASM.FFmpeg);
    }

    /**
     * An ffmpeg exec return code of 0 / undefined / null is treated as success.
     */
    function isOkCode(code) {
        return code === 0 || code === undefined || code === null;
    }

    /**
     * Fetch a (cross-origin) resource and expose it as a same-origin blob URL.
     * This is what lets the worker/core/wasm be loaded without CORS errors.
     */
    async function toBlobURL(url, mimeType) {
        const resp = await fetch(url);
        if (!resp.ok) {
            throw new Error(`Failed to download ${url} (HTTP ${resp.status})`);
        }
        const buf = await resp.arrayBuffer();
        return URL.createObjectURL(new Blob([buf], { type: mimeType }));
    }

    /**
     * Read a File/Blob (or URL) into a Uint8Array for ffmpeg.writeFile().
     */
    async function fileToUint8Array(file) {
        if (file instanceof Uint8Array) return file;
        if (typeof Blob !== 'undefined' && file instanceof Blob) {
            return new Uint8Array(await file.arrayBuffer());
        }
        if (typeof file === 'string') {
            const resp = await fetch(file);
            return new Uint8Array(await resp.arrayBuffer());
        }
        throw new Error('Unsupported input for audio extraction.');
    }

    /**
     * Lazy-load (once) and return the shared ffmpeg instance.
     * @param {(msg: string) => void} [onStatus]
     * @returns {Promise<object>}
     */
    async function getFFmpeg(onStatus) {
        if (_ffmpeg) return _ffmpeg;
        if (_loadPromise) return _loadPromise;

        if (!isFFmpegAvailable()) {
            throw new Error('Audio engine failed to load. Serve the app over http(s) and check your internet connection.');
        }

        _loadPromise = (async () => {
            const ffmpeg = new g.FFmpegWASM.FFmpeg();
            if (onStatus) onStatus('Loading audio engine (~31MB, first time only)...');

            // We intentionally do NOT pass classWorkerURL. Passing it makes ffmpeg
            // create a *module* worker, in which `importScripts` is unavailable, so
            // the UMD worker can't load the core (it throws "Cannot find module").
            // By omitting it, ffmpeg creates a *classic* worker from its vendored,
            // same-origin 814.ffmpeg.js, which loads the core via importScripts.
            // The core/wasm are fetched from the CDN and handed over as same-origin
            // blob URLs so importScripts/fetch inside the worker have no CORS issues.
            await ffmpeg.load({
                coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
                wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm')
            });

            _ffmpeg = ffmpeg;
            return ffmpeg;
        })();

        try {
            return await _loadPromise;
        } catch (err) {
            // Allow a later retry if loading failed (e.g. transient network).
            _loadPromise = null;
            const onFile = (typeof location !== 'undefined' && location.protocol === 'file:');
            const hint = onFile
                ? ' Opening index.html directly (file://) blocks the audio engine — serve the app over http(s) (GitHub Pages or a local server).'
                : ' Check your internet connection and try again.';
            throw new Error('Audio engine failed to load.' + hint + ' (' + (err && err.message ? err.message : err) + ')');
        }
    }

    /**
     * Extract an audio-only track from a video file.
     * Produces a small mono 16kHz MP3 (good for speech-to-text); falls back to
     * WAV if the core lacks an MP3 encoder.
     *
     * @param {File|Blob} file - The source video file.
     * @param {(percent: number) => void} [onProgress] - 0..100 progress.
     * @param {(msg: string) => void} [onStatus] - Human-readable status updates.
     * @returns {Promise<{blob: Blob, ext: string}>}
     */
    async function extractAudio(file, onProgress, onStatus) {
        const ffmpeg = await getFFmpeg(onStatus);

        const safeName = (file.name || 'video').replace(/[^\w.\-]/g, '_');
        const inName = 'input_' + safeName;

        const progressHandler = (evt) => {
            const p = evt && evt.progress;
            if (onProgress && typeof p === 'number' && isFinite(p)) {
                onProgress(Math.max(0, Math.min(99, Math.round(p * 100))));
            }
        };

        if (onStatus) onStatus('Reading video file...');
        await ffmpeg.writeFile(inName, await fileToUint8Array(file));

        ffmpeg.on('progress', progressHandler);

        let data = null;
        let outName = 'audio.mp3';
        let mimeType = 'audio/mpeg';

        try {
            if (onStatus) onStatus('Extracting audio...');

            // Primary: audio only (-vn), downmix to mono, 16kHz, ~64kbps MP3.
            let code = -1;
            try {
                code = await ffmpeg.exec(['-i', inName, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '64k', outName]);
            } catch (e) {
                code = -1;
            }

            if (isOkCode(code)) {
                try {
                    data = await ffmpeg.readFile(outName);
                } catch (e) {
                    data = null;
                }
            }

            // Fallback: 16kHz mono WAV (PCM is always available in any build).
            if (!data) {
                if (onStatus) onStatus('Extracting audio (WAV fallback)...');
                outName = 'audio.wav';
                mimeType = 'audio/wav';
                try {
                    await ffmpeg.exec(['-i', inName, '-vn', '-ac', '1', '-ar', '16000', outName]);
                } catch (e) {
                    /* readFile below will throw a clear error if this failed */
                }
                data = await ffmpeg.readFile(outName);
            }
        } finally {
            try { ffmpeg.off('progress', progressHandler); } catch (e) { /* ignore */ }
            // Best-effort cleanup of the in-memory filesystem.
            try { await ffmpeg.deleteFile(inName); } catch (e) { /* ignore */ }
            try { await ffmpeg.deleteFile(outName); } catch (e) { /* ignore */ }
        }

        if (!data || !data.buffer || data.byteLength === 0) {
            throw new Error('Could not extract audio from this video. The file may be corrupt or use an unsupported codec.');
        }

        if (onProgress) onProgress(100);

        return {
            blob: new Blob([data.buffer], { type: mimeType }),
            ext: outName.split('.').pop()
        };
    }

    const ns = g.ST = g.ST || {};
    Object.assign(ns, {
        extractAudio,
        isFFmpegAvailable
    });
})(typeof globalThis !== 'undefined' ? globalThis : window);
