/**
 * SubTranslator - Main Application
 * Wires together all modules and handles UI interactions
 */

const ST = window.ST;

// ============================================
// State Management
// ============================================

const state = {
    apiKey: '',
    elevenLabsKey: '',
    file: null,
    fileName: '',
    fileFormat: 'srt',
    parsedSubtitle: null,
    translatedSubtitle: null,
    isTranslating: false,
    isProcessingVideo: false,
    videoMode: false,
    abortController: null
};

// ============================================
// DOM Elements
// ============================================

const elements = {
    // API Key (header indicator)
    apiKeyStatus: document.getElementById('apiKeyStatus'),
    apiKeyLabel: document.getElementById('apiKeyLabel'),

    // File Upload
    dropzone: document.getElementById('dropzone'),
    fileInput: document.getElementById('fileInput'),
    fileInfo: document.getElementById('fileInfo'),
    fileName: document.getElementById('fileName'),
    fileSize: document.getElementById('fileSize'),
    removeFile: document.getElementById('removeFile'),

    // Settings
    targetLang: document.getElementById('targetLang'),
    batchSize: document.getElementById('batchSize'),
    modelSelect: document.getElementById('modelSelect'),
    sttModel: document.getElementById('sttModel'),

    // Language Picker
    langPicker: document.getElementById('langPicker'),
    langPickerTrigger: document.getElementById('langPickerTrigger'),
    langPickerValue: document.getElementById('langPickerValue'),
    langPickerDropdown: document.getElementById('langPickerDropdown'),
    langPickerSearch: document.getElementById('langPickerSearch'),
    langPickerList: document.getElementById('langPickerList'),

    // Video Processing stepper
    videoStepsCard: document.getElementById('videoStepsCard'),

    // Translate Button
    translateBtn: document.getElementById('translateBtn'),

    // Event Log
    logCard: document.getElementById('logCard'),
    logContainer: document.getElementById('logContainer'),
    clearLog: document.getElementById('clearLog'),

    // Progress
    progressCard: document.getElementById('progressCard'),
    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText'),
    progressPercent: document.getElementById('progressPercent'),
    batchProgress: document.getElementById('batchProgress'),
    subtitleProgress: document.getElementById('subtitleProgress'),

    // Preview
    previewCard: document.getElementById('previewCard'),
    originalPreview: document.getElementById('originalPreview'),
    translatedPreview: document.getElementById('translatedPreview'),
    tabBtns: document.querySelectorAll('.tab-btn'),

    // Download
    downloadCard: document.getElementById('downloadCard'),
    downloadStats: document.getElementById('downloadStats'),
    downloadBtn: document.getElementById('downloadBtn'),

    // Toast
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toastMessage'),
    toastClose: document.getElementById('toastClose'),

    // API Key Modal (Gemini)
    apiKeyModal: document.getElementById('apiKeyModal'),
    modalApiKey: document.getElementById('modalApiKey'),
    toggleModalApiKey: document.getElementById('toggleModalApiKey'),
    modalStatus: document.getElementById('modalStatus'),
    validateKeyBtn: document.getElementById('validateKeyBtn'),
    skipKeyBtn: document.getElementById('skipKeyBtn'),

    // ElevenLabs (Speech-to-Text) key + modal
    elevenLabsKeyStatus: document.getElementById('elevenLabsKeyStatus'),
    elevenLabsKeyLabel: document.getElementById('elevenLabsKeyLabel'),
    elevenLabsModal: document.getElementById('elevenLabsModal'),
    modalElevenLabsKey: document.getElementById('modalElevenLabsKey'),
    toggleElevenLabsKey: document.getElementById('toggleElevenLabsKey'),
    elevenLabsModalStatus: document.getElementById('elevenLabsModalStatus'),
    saveElevenLabsKeyBtn: document.getElementById('saveElevenLabsKey'),
    skipElevenLabsKeyBtn: document.getElementById('skipElevenLabsKey'),

    themeToggle: document.getElementById('themeToggle')
};

// ============================================
// Local Storage
// ============================================

const STORAGE_KEY = 'subtranslator_apikey';
const ELEVENLABS_STORAGE_KEY = 'subtranslator_elevenlabs_apikey';
const PROGRESS_KEY = 'subtranslator_progress';
const THEME_KEY = 'subtranslator_theme';

function getStoredTheme() {
    try {
        const t = localStorage.getItem(THEME_KEY);
        if (t === 'light' || t === 'dark') return t;
    } catch (e) { /* ignore */ }
    return 'dark';
}

function applyTheme(theme) {
    const next = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
        localStorage.setItem(THEME_KEY, next);
    } catch (e) {
        console.warn('Could not save theme preference');
    }
    const toggle = document.getElementById('themeToggle');
    if (toggle) {
        toggle.setAttribute('aria-pressed', next === 'light' ? 'true' : 'false');
        toggle.title = next === 'light' ? 'Switch to dark theme' : 'Switch to hand-drawn light theme';
    }
}

function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    applyTheme(cur === 'light' ? 'dark' : 'light');
}

function saveApiKey(key) {
    try {
        localStorage.setItem(STORAGE_KEY, key);
    } catch (e) {
        console.warn('Could not save API key to localStorage');
    }
}

function loadApiKey() {
    try {
        return localStorage.getItem(STORAGE_KEY) || '';
    } catch (e) {
        return '';
    }
}

function saveElevenLabsKey(key) {
    try {
        localStorage.setItem(ELEVENLABS_STORAGE_KEY, key);
    } catch (e) {
        console.warn('Could not save ElevenLabs API key to localStorage');
    }
}

function loadElevenLabsKey() {
    try {
        return localStorage.getItem(ELEVENLABS_STORAGE_KEY) || '';
    } catch (e) {
        return '';
    }
}

/**
 * Save translation progress to localStorage
 */
function saveProgress(data) {
    try {
        localStorage.setItem(PROGRESS_KEY, JSON.stringify({
            ...data,
            savedAt: Date.now()
        }));
    } catch (e) {
        console.warn('Could not save progress to localStorage');
    }
}

/**
 * Load saved translation progress
 */
function loadProgress() {
    try {
        const saved = localStorage.getItem(PROGRESS_KEY);
        if (saved) {
            return JSON.parse(saved);
        }
    } catch (e) {
        console.warn('Could not load progress from localStorage');
    }
    return null;
}

/**
 * Clear saved progress
 */
function clearProgress() {
    try {
        localStorage.removeItem(PROGRESS_KEY);
    } catch (e) {
        console.warn('Could not clear progress from localStorage');
    }
}

// ============================================
// Toast Notifications
// ============================================

let toastTimeout = null;

function showToast(message, duration = 5000) {
    elements.toastMessage.textContent = message;
    elements.toast.hidden = false;

    // Trigger reflow for animation
    elements.toast.offsetHeight;
    elements.toast.classList.add('show');

    // Auto-hide after duration
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(hideToast, duration);
}

function hideToast() {
    elements.toast.classList.remove('show');
    setTimeout(() => {
        elements.toast.hidden = true;
    }, 400);
}

// ============================================
// Event Log
// ============================================

function formatTime() {
    const now = new Date();
    return now.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

function addLogEntry(type, message, details = null, batchInfo = null) {
    elements.logCard.hidden = false;

    const entry = document.createElement('div');
    entry.className = 'log-entry';

    let badgeClass = type;
    let badgeText = type.charAt(0).toUpperCase() + type.slice(1);

    let html = `
        <div class="log-entry-header">
            <span class="log-time">${formatTime()}</span>
            <span class="log-badge ${badgeClass}">${badgeText}</span>
            ${batchInfo ? `<span class="log-batch">Batch ${batchInfo}</span>` : ''}
        </div>
        <div class="log-content"><strong>${message}</strong></div>
    `;

    if (details) {
        // Truncate details if too long
        const truncatedDetails = details.length > 500
            ? details.substring(0, 500) + '...\n[truncated]'
            : details;
        html += `<div class="log-content preview">${escapeHtml(truncatedDetails)}</div>`;
    }

    entry.innerHTML = html;
    elements.logContainer.appendChild(entry);

    // Auto-scroll to bottom
    elements.logContainer.scrollTop = elements.logContainer.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function clearLog() {
    elements.logContainer.innerHTML = '';
}

function showLog() {
    elements.logCard.hidden = false;
}

// ============================================
// UI State Updates
// ============================================

function updateTranslateButton() {
    const hasFile = state.parsedSubtitle !== null;
    elements.translateBtn.disabled = !hasFile || state.isTranslating || state.isProcessingVideo;
}

function setTranslating(translating) {
    state.isTranslating = translating;
    elements.translateBtn.classList.toggle('loading', translating);
    updateTranslateButton();

    // Disable/enable inputs during translation
    elements.langPicker.classList.toggle('disabled', translating);
    if (translating && elements.langPicker.classList.contains('open')) {
        closeLangPicker();
    }
    elements.batchSize.disabled = translating;
    elements.modelSelect.disabled = translating;
    if (elements.sttModel) elements.sttModel.disabled = translating;
    elements.dropzone.style.pointerEvents = translating ? 'none' : 'auto';
}

function updateProgress(completedBatches, totalBatches, completedEntries, totalEntries, statusText = null) {
    const percent = totalBatches > 0 ? Math.round((completedBatches / totalBatches) * 100) : 0;

    elements.progressFill.style.width = `${percent}%`;
    elements.progressPercent.textContent = `${percent}%`;
    elements.progressText.textContent = statusText || (completedBatches < totalBatches
        ? `Translating batch ${completedBatches + 1} of ${totalBatches}...`
        : 'Finalizing...');
    elements.batchProgress.textContent = `${completedBatches} / ${totalBatches}`;
    elements.subtitleProgress.textContent = `${completedEntries} / ${totalEntries}`;

    // Mirror translation progress onto the video stepper (step 3) when a video
    // import is in play.
    if (state.videoMode) {
        const v3 = document.getElementById('vstep3');
        const s = v3 && v3.getAttribute('data-state');
        if (v3 && s !== 'done' && s !== 'error') {
            setVideoStep(3, 'active', statusText || `Translating... ${percent}%`, percent);
        }
    }
}

function showProgress() {
    elements.progressCard.hidden = false;
}

function hideProgress() {
    elements.progressCard.hidden = true;
}

function showPreview() {
    if (state.parsedSubtitle) {
        elements.originalPreview.textContent = ST.createPreview(state.parsedSubtitle.entries, 15);
    }
    if (state.translatedSubtitle) {
        elements.translatedPreview.textContent = ST.createPreview(state.translatedSubtitle.entries, 15);
    }
    elements.previewCard.hidden = false;
}

function showDownload() {
    if (state.translatedSubtitle) {
        const totalEntries = state.translatedSubtitle.entries.length;
        elements.downloadStats.textContent = `${totalEntries} subtitles translated successfully`;
    }
    elements.downloadCard.hidden = false;
    requestAnimationFrame(() => {
        elements.downloadBtn.focus({ preventScroll: false });
        elements.downloadCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
}

function resetUI() {
    hideProgress();
    elements.previewCard.hidden = true;
    elements.downloadCard.hidden = true;
    state.translatedSubtitle = null;
}

// ============================================
// Video Processing Stepper
// ============================================

function showVideoSteps() {
    if (elements.videoStepsCard) elements.videoStepsCard.hidden = false;
}

function hideVideoSteps() {
    if (elements.videoStepsCard) elements.videoStepsCard.hidden = true;
}

function resetVideoSteps() {
    [1, 2, 3].forEach((n) => {
        setVideoStep(n, 'pending', 'Waiting', 0);
        stopIndeterminate(n);
    });
}

/**
 * Update a single step's visual state.
 * @param {number} n - Step number (1-3)
 * @param {string} stateStr - pending | active | ready | done | error
 * @param {string|null} statusText
 * @param {number|null} percent
 */
function setVideoStep(n, stateStr, statusText, percent) {
    const stepEl = document.getElementById('vstep' + n);
    const statusEl = document.getElementById('vstep' + n + 'Status');
    const fillEl = document.getElementById('vstep' + n + 'Fill');
    if (stepEl) stepEl.setAttribute('data-state', stateStr);
    if (statusEl && statusText != null) statusEl.textContent = statusText;
    if (fillEl && percent != null) {
        fillEl.style.width = Math.max(0, Math.min(100, percent)) + '%';
    }
}

function startIndeterminate(n) {
    const bar = document.querySelector('#vstep' + n + ' .vstep-bar');
    if (bar) bar.classList.add('indeterminate');
}

function stopIndeterminate(n) {
    const bar = document.querySelector('#vstep' + n + ' .vstep-bar');
    if (bar) bar.classList.remove('indeterminate');
}

// ============================================
// API Key Modal
// ============================================

function showApiKeyModal() {
    elements.modalApiKey.value = '';
    elements.modalStatus.hidden = true;
    elements.modalStatus.className = 'modal-status';
    elements.validateKeyBtn.disabled = false;
    elements.apiKeyModal.classList.add('visible');
}

function hideApiKeyModal() {
    elements.apiKeyModal.classList.remove('visible');
}

function updateApiKeyIndicator() {
    const hasKey = state.apiKey.trim().length > 0;
    elements.apiKeyLabel.textContent = hasKey ? 'API KEY SET' : 'NO API KEY';
    elements.apiKeyStatus.classList.toggle('active', hasKey);
}

function handleSaveApiKey() {
    const key = elements.modalApiKey.value.trim();
    if (!key) {
        elements.modalStatus.textContent = 'Please enter an API key.';
        elements.modalStatus.className = 'modal-status error';
        elements.modalStatus.hidden = false;
        return;
    }

    state.apiKey = key;
    saveApiKey(key);
    updateApiKeyIndicator();
    updateTranslateButton();
    elements.modalStatus.textContent = 'Saved locally in your browser.';
    elements.modalStatus.className = 'modal-status success';
    elements.modalStatus.hidden = false;
    setTimeout(hideApiKeyModal, 600);
}

// ============================================
// ElevenLabs (Speech-to-Text) API Key Modal
// ============================================

function showElevenLabsModal() {
    elements.modalElevenLabsKey.value = '';
    elements.elevenLabsModalStatus.hidden = true;
    elements.elevenLabsModalStatus.className = 'modal-status';
    elements.saveElevenLabsKeyBtn.disabled = false;
    elements.elevenLabsModal.classList.add('visible');
    requestAnimationFrame(() => elements.modalElevenLabsKey.focus());
}

function hideElevenLabsModal() {
    elements.elevenLabsModal.classList.remove('visible');
}

function updateElevenLabsIndicator() {
    const hasKey = state.elevenLabsKey.trim().length > 0;
    elements.elevenLabsKeyLabel.textContent = hasKey ? 'STT KEY SET' : 'NO STT KEY';
    elements.elevenLabsKeyStatus.classList.toggle('active', hasKey);
}

function handleSaveElevenLabsKey() {
    const key = elements.modalElevenLabsKey.value.trim();
    if (!key) {
        elements.elevenLabsModalStatus.textContent = 'Please enter an API key.';
        elements.elevenLabsModalStatus.className = 'modal-status error';
        elements.elevenLabsModalStatus.hidden = false;
        return;
    }

    state.elevenLabsKey = key;
    saveElevenLabsKey(key);
    updateElevenLabsIndicator();
    elements.elevenLabsModalStatus.textContent = 'Saved locally in your browser.';
    elements.elevenLabsModalStatus.className = 'modal-status success';
    elements.elevenLabsModalStatus.hidden = false;
    setTimeout(hideElevenLabsModal, 600);
}

// ============================================
// File Handling
// ============================================

function isVideoFile(file) {
    const name = (file.name || '').toLowerCase();
    const videoExts = ['.mp4', '.mkv', '.mov', '.webm', '.avi', '.m4v', '.wmv', '.flv', '.mpeg', '.mpg', '.3gp', '.ts', '.ogv', '.m2ts', '.mts'];
    if (videoExts.some(ext => name.endsWith(ext))) return true;
    if (file.type && file.type.startsWith('video/')) return true;
    return false;
}

function handleFile(file) {
    // Video files go through the extract -> transcribe -> translate pipeline
    if (isVideoFile(file)) {
        processVideo(file);
        return;
    }

    // Validate file type
    const validTypes = ['.srt', '.vtt'];
    const fileName = file.name.toLowerCase();
    const isValid = validTypes.some(ext => fileName.endsWith(ext));

    if (!isValid) {
        showToast('Please upload an SRT, VTT, or video file.');
        return;
    }

    // Read file
    const reader = new FileReader();

    reader.onload = (e) => {
        const content = e.target.result;

        try {
            const parsed = ST.parseSubtitle(content);

            if (parsed.entries.length === 0) {
                showToast('No valid subtitles found in the file.');
                return;
            }

            // Update state
            state.file = file;
            state.fileName = file.name;
            state.fileFormat = parsed.format;
            state.parsedSubtitle = parsed;
            state.videoMode = false;

            // A plain subtitle upload hides any leftover video stepper
            hideVideoSteps();
            resetVideoSteps();

            // Update UI
            elements.fileName.textContent = file.name;
            elements.fileSize.textContent = `${ST.formatFileSize(file.size)} • ${parsed.entries.length} subtitles • ${parsed.format.toUpperCase()}`;
            elements.dropzone.hidden = true;
            elements.fileInfo.hidden = false;

            // Show preview
            showPreview();

            // Reset previous translation
            resetUI();
            showPreview();

            updateTranslateButton();

            // Check for saved progress for this file
            checkForSavedProgress();
        } catch (error) {
            showToast('Error parsing subtitle file. Please check the file format.');
            console.error('Parse error:', error);
        }
    };

    reader.onerror = () => {
        showToast('Error reading file. Please try again.');
    };

    reader.readAsText(file);
}

function removeFile() {
    if (state.isProcessingVideo) {
        showToast('Please wait for video processing to finish.');
        return;
    }

    state.file = null;
    state.fileName = '';
    state.parsedSubtitle = null;
    state.translatedSubtitle = null;
    state.videoMode = false;

    elements.dropzone.hidden = false;
    elements.fileInfo.hidden = true;
    elements.fileInput.value = '';

    hideVideoSteps();
    resetVideoSteps();
    resetUI();
    hideResumeBanner();
    updateTranslateButton();
}

// ============================================
// Video Import Pipeline
// ============================================

/**
 * Handle a dropped/selected video: extract audio, transcribe to SRT via
 * ElevenLabs, then hand off to the existing translation flow.
 * @param {File} file
 */
async function processVideo(file) {
    if (state.isProcessingVideo || state.isTranslating) {
        return;
    }

    // Require an ElevenLabs key for transcription
    if (!state.elevenLabsKey.trim()) {
        showToast('Add your ElevenLabs API key to transcribe video.');
        showElevenLabsModal();
        return;
    }

    state.isProcessingVideo = true;
    state.videoMode = true;
    state.file = file;
    state.fileName = file.name;
    state.fileFormat = 'srt';
    state.parsedSubtitle = null;
    state.translatedSubtitle = null;

    // Swap the dropzone for the file info row
    elements.fileName.textContent = file.name;
    elements.fileSize.textContent = `${ST.formatFileSize(file.size)} • VIDEO`;
    elements.dropzone.hidden = true;
    elements.fileInfo.hidden = false;

    // Reset prior outputs and show the stepper
    resetUI();
    hideResumeBanner();
    resetVideoSteps();
    showVideoSteps();
    updateTranslateButton();

    // Fresh log for this run
    clearLog();
    showLog();
    addLogEntry('request', `Importing video: ${file.name}`, ST.formatFileSize(file.size));

    try {
        // ---- Step 1: Extract audio ----
        setVideoStep(1, 'active', 'Loading audio engine...', 0);
        const { blob: audioBlob, ext } = await ST.extractAudio(
            file,
            (pct) => setVideoStep(1, 'active', `Extracting... ${pct}%`, pct),
            (status) => setVideoStep(1, 'active', status)
        );
        setVideoStep(1, 'done', `Audio ready (${ST.formatFileSize(audioBlob.size)})`, 100);
        addLogEntry('response', 'Audio extracted', `Format: ${ext} • ${ST.formatFileSize(audioBlob.size)}`);

        // ---- Step 2: Transcribe with ElevenLabs ----
        setVideoStep(2, 'active', 'Transcribing with ElevenLabs...', null);
        startIndeterminate(2);
        const sttModelValue = elements.sttModel ? elements.sttModel.value : 'scribe_v1';
        const srtText = await ST.transcribeToSRT(
            state.elevenLabsKey,
            audioBlob,
            { model: sttModelValue, fileName: `audio.${ext}` },
            (type, message, details) => addLogEntry(type, message, details)
        );
        stopIndeterminate(2);
        setVideoStep(2, 'done', 'Transcript ready', 100);

        // Parse the SRT exactly like an uploaded subtitle file
        const parsed = ST.parseSubtitle(srtText);
        if (!parsed.entries.length) {
            throw new Error('Transcription produced no subtitles.');
        }
        state.parsedSubtitle = parsed;
        state.fileFormat = parsed.format;
        const base = file.name.replace(/\.[^.]+$/, '');
        state.fileName = `${base}.${parsed.format}`;
        elements.fileSize.textContent = `${parsed.entries.length} subtitles • ${parsed.format.toUpperCase()} • from video`;

        showPreview();
        switchPreviewTab('original');
        updateTranslateButton();

        // ---- Step 3: Translate (as usual) ----
        if (state.apiKey.trim()) {
            setVideoStep(3, 'active', 'Translating...', 0);
            // startTranslation marks step 3 done/error via the videoMode hooks
            await startTranslation();
        } else {
            setVideoStep(3, 'ready', 'Add your Gemini key, then press Translate', 0);
            addLogEntry('response', 'Transcript ready to translate', 'Add a Gemini API key and press "Translate Subtitles".');
            showApiKeyModal();
        }
    } catch (err) {
        console.error('Video processing error:', err);
        stopIndeterminate(2);
        const activeStep = document.querySelector('.vstep[data-state="active"]');
        if (activeStep) {
            const n = Number(activeStep.id.replace('vstep', ''));
            setVideoStep(n, 'error', (err && err.message) ? err.message : 'Failed', null);
        }
        addLogEntry('error', 'Video processing failed', (err && err.message) ? err.message : String(err));
        showToast((err && err.message) ? err.message : 'Video processing failed.');
    } finally {
        state.isProcessingVideo = false;
        updateTranslateButton();
    }
}

// ============================================
// Translation
// ============================================

async function startTranslation(resumeData = null) {
    if (!state.parsedSubtitle || !state.apiKey) return;

    const targetLang = elements.targetLang.value;
    const batchSize = parseInt(elements.batchSize.value, 10) || 100;
    const selectedModel = elements.modelSelect.value;

    // Set the model
    ST.setModel(selectedModel);

    // Create batches
    const batches = ST.createBatches(state.parsedSubtitle.entries, batchSize);
    const stats = ST.getBatchStats(batches);

    // Resume settings
    let startFromBatch = 0;
    let existingEntries = [];
    let completedEntries = 0;

    if (resumeData) {
        startFromBatch = resumeData.completedBatches;
        existingEntries = resumeData.translatedEntries || [];
        completedEntries = existingEntries.length;
    }

    // Setup abort controller
    state.abortController = new AbortController();

    // Show progress
    setTranslating(true);
    showProgress();
    updateProgress(startFromBatch, stats.totalBatches, completedEntries, stats.totalEntries);

    // Clear and show log
    if (!resumeData) {
        clearLog();
    }
    showLog();

    if (resumeData) {
        addLogEntry('response', `Resuming translation from batch ${startFromBatch + 1}`,
            `${completedEntries} subtitles already translated\n${stats.totalEntries - completedEntries} remaining\nModel: ${selectedModel}`);
    } else {
        addLogEntry('request', `Starting translation: ${stats.totalEntries} subtitles in ${stats.totalBatches} batches`,
            `Target language: ${elements.langPickerValue.textContent}\nBatch size: ${batchSize}\nModel: ${selectedModel}`);
    }

    try {
        // Translate all batches
        const translatedEntries = await ST.translateAllBatches(
            state.apiKey,
            batches,
            targetLang,
            (completedBatches, totalBatches, batchEntries, statusText) => {
                if (batchEntries > 0) {
                    completedEntries += batchEntries;
                }
                updateProgress(completedBatches, totalBatches, completedEntries, stats.totalEntries, statusText);
            },
            state.abortController.signal,
            // Log callback
            (type, message, details, batchInfo) => {
                addLogEntry(type, message, details, batchInfo);
            },
            // Save progress callback
            (completedBatches, allEntries, failed = false) => {
                saveProgress({
                    fileName: state.fileName,
                    fileFormat: state.fileFormat,
                    targetLang,
                    batchSize,
                    totalBatches: stats.totalBatches,
                    completedBatches,
                    totalEntries: stats.totalEntries,
                    translatedEntries: allEntries,
                    originalEntries: state.parsedSubtitle.entries,
                    header: state.parsedSubtitle.header,
                    failed
                });

                if (!failed) {
                    addLogEntry('response', `Progress saved (${completedBatches}/${stats.totalBatches} batches)`, null);
                }
            },
            startFromBatch,
            existingEntries
        );

        // Create translated subtitle object
        state.translatedSubtitle = {
            format: state.parsedSubtitle.format,
            header: state.parsedSubtitle.header,
            entries: translatedEntries
        };

        // Clear saved progress on success
        clearProgress();

        // Update UI
        updateProgress(stats.totalBatches, stats.totalBatches, stats.totalEntries, stats.totalEntries);

        // Log completion
        addLogEntry('response', `Translation complete!`, `Successfully translated ${stats.totalEntries} subtitles`);

        // Mark the video stepper's final step as done (if this came from a video)
        if (state.videoMode) {
            setVideoStep(3, 'done', 'Translation complete', 100);
        }

        // Show results (download first so it sits under Translate and stays visible)
        setTimeout(() => {
            hideProgress();
            showDownload();
            showPreview();
            switchPreviewTab('translated');
        }, 150);

    } catch (error) {
        console.error('Translation error:', error);
        addLogEntry('error', 'Translation failed - progress saved', error.message + '\n\nYou can resume from where it stopped.');
        showToast(error.message || 'Translation failed. Progress saved - you can resume.');
        hideProgress();

        if (state.videoMode) {
            setVideoStep(3, 'error', 'Translation failed - see log', 0);
        }

        // Check if we have saved progress and show resume button
        checkForSavedProgress();
    } finally {
        setTranslating(false);
        state.abortController = null;
    }
}

/**
 * Check for saved progress and show resume option
 */
function checkForSavedProgress() {
    const saved = loadProgress();

    if (saved && saved.translatedEntries && saved.translatedEntries.length > 0) {
        // Check if it's for the same file
        const isSameFile = saved.fileName === state.fileName;

        if (isSameFile && saved.completedBatches < saved.totalBatches) {
            showResumeOption(saved);
        }
    }
}

/**
 * Show resume option UI
 */
function showResumeOption(saved) {
    const resumeInfo = `${saved.completedBatches}/${saved.totalBatches} batches (${saved.translatedEntries.length} subtitles)`;

    // Create resume banner if it doesn't exist
    let resumeBanner = document.getElementById('resumeBanner');
    if (!resumeBanner) {
        resumeBanner = document.createElement('div');
        resumeBanner.id = 'resumeBanner';
        resumeBanner.className = 'resume-banner';
        resumeBanner.innerHTML = `
            <div class="resume-content">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
                    <path d="M21 3v5h-5"/>
                </svg>
                <div class="resume-text">
                    <strong>Resume available</strong>
                    <span id="resumeInfo"></span>
                </div>
            </div>
            <div class="resume-actions">
                <button type="button" class="btn-resume" id="resumeBtn">Resume</button>
                <button type="button" class="btn-discard" id="discardBtn">Discard</button>
            </div>
        `;

        // Insert after translate button
        elements.translateBtn.parentNode.insertBefore(resumeBanner, elements.translateBtn.nextSibling);

        // Add event listeners
        document.getElementById('resumeBtn').addEventListener('click', () => {
            const savedProgress = loadProgress();
            if (savedProgress) {
                hideResumeBanner();
                startTranslation(savedProgress);
            }
        });

        document.getElementById('discardBtn').addEventListener('click', () => {
            clearProgress();
            hideResumeBanner();
        });
    }

    document.getElementById('resumeInfo').textContent = resumeInfo;
    resumeBanner.hidden = false;
}

/**
 * Hide resume banner
 */
function hideResumeBanner() {
    const resumeBanner = document.getElementById('resumeBanner');
    if (resumeBanner) {
        resumeBanner.hidden = true;
    }
}

// ============================================
// Download
// ============================================

function downloadTranslation() {
    if (!state.translatedSubtitle) return;

    const content = ST.generateSubtitle(state.translatedSubtitle);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });

    // Create filename
    const originalName = state.fileName;
    const dotIndex = originalName.lastIndexOf('.');
    const baseName = dotIndex > 0 ? originalName.substring(0, dotIndex) : originalName;
    const extension = state.fileFormat === 'vtt' ? '.vtt' : '.srt';
    const targetLang = elements.targetLang.value;
    const newFileName = `${baseName}_${targetLang}${extension}`;

    // Create download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = newFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ============================================
// Preview Tabs
// ============================================

function switchPreviewTab(tab) {
    elements.tabBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    elements.originalPreview.hidden = tab !== 'original';
    elements.translatedPreview.hidden = tab !== 'translated';
}

// ============================================
// Event Listeners
// ============================================

function setupEventListeners() {
    // API Key header buttons
    elements.apiKeyStatus.addEventListener('click', showApiKeyModal);
    elements.elevenLabsKeyStatus.addEventListener('click', showElevenLabsModal);

    // File Upload - Dropzone
    elements.dropzone.addEventListener('click', () => {
        elements.fileInput.click();
    });

    elements.dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.dropzone.classList.add('drag-over');
    });

    elements.dropzone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        elements.dropzone.classList.remove('drag-over');
    });

    elements.dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.dropzone.classList.remove('drag-over');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });

    elements.fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });

    elements.removeFile.addEventListener('click', removeFile);

    // Translate (show modal if no key)
    elements.translateBtn.addEventListener('click', () => {
        if (!state.apiKey.trim()) {
            showApiKeyModal();
            return;
        }
        startTranslation();
    });

    // API Key Modal
    elements.validateKeyBtn.addEventListener('click', handleSaveApiKey);
    elements.skipKeyBtn.addEventListener('click', hideApiKeyModal);
    elements.toggleModalApiKey.addEventListener('click', () => {
        const input = elements.modalApiKey;
        input.type = input.type === 'password' ? 'text' : 'password';
    });
    elements.modalApiKey.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSaveApiKey();
    });
    elements.apiKeyModal.addEventListener('click', (e) => {
        if (e.target === elements.apiKeyModal) hideApiKeyModal();
    });

    // ElevenLabs Key Modal
    elements.saveElevenLabsKeyBtn.addEventListener('click', handleSaveElevenLabsKey);
    elements.skipElevenLabsKeyBtn.addEventListener('click', hideElevenLabsModal);
    elements.toggleElevenLabsKey.addEventListener('click', () => {
        const input = elements.modalElevenLabsKey;
        input.type = input.type === 'password' ? 'text' : 'password';
    });
    elements.modalElevenLabsKey.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSaveElevenLabsKey();
    });
    elements.elevenLabsModal.addEventListener('click', (e) => {
        if (e.target === elements.elevenLabsModal) hideElevenLabsModal();
    });

    if (elements.themeToggle) {
        elements.themeToggle.addEventListener('click', toggleTheme);
    }

    // Preview Tabs
    elements.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            switchPreviewTab(btn.dataset.tab);
        });
    });

    // Download
    elements.downloadBtn.addEventListener('click', downloadTranslation);

    // Clear Log
    elements.clearLog.addEventListener('click', clearLog);

    // Toast
    elements.toastClose.addEventListener('click', hideToast);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (elements.apiKeyModal.classList.contains('visible')) {
                hideApiKeyModal();
            } else if (elements.elevenLabsModal.classList.contains('visible')) {
                hideElevenLabsModal();
            } else if (state.isTranslating && state.abortController) {
                state.abortController.abort();
            }
        }
    });
}

// ============================================
// Initialization
// ============================================

function init() {
    applyTheme(getStoredTheme());

    // Load saved API keys
    state.apiKey = loadApiKey();
    state.elevenLabsKey = loadElevenLabsKey();

    // Setup event listeners
    setupEventListeners();

    // Initial UI state
    updateApiKeyIndicator();
    updateElevenLabsIndicator();
    updateTranslateButton();

    // Show API key modal if no key is saved
    if (!state.apiKey) {
        showApiKeyModal();
    }

    // Initialize language picker
    initLangPicker();

    console.log('SubTranslator initialized');
}

// Start the app
init();

// ============================================
// Language Picker
// ============================================

const ALL_LANGUAGES = [
    { value: 'afrikaans',    label: 'Afrikaans',    native: 'Afrikaans' },
    { value: 'albanian',     label: 'Albanian',     native: 'Shqip' },
    { value: 'amharic',      label: 'Amharic',      native: 'አማርኛ' },
    { value: 'arabic',       label: 'Arabic',       native: 'العربية' },
    { value: 'armenian',     label: 'Armenian',     native: 'Հայերեն' },
    { value: 'assamese',     label: 'Assamese',     native: 'অসমীয়া' },
    { value: 'azerbaijani',  label: 'Azerbaijani',  native: 'Azərbaycanca' },
    { value: 'basque',       label: 'Basque',       native: 'Euskara' },
    { value: 'belarusian',   label: 'Belarusian',   native: 'Беларуская' },
    { value: 'bengali',      label: 'Bengali',      native: 'বাংলা' },
    { value: 'bosnian',      label: 'Bosnian',      native: 'Bosanski' },
    { value: 'bulgarian',    label: 'Bulgarian',    native: 'Български' },
    { value: 'burmese',      label: 'Burmese',      native: 'မြန်မာ' },
    { value: 'catalan',      label: 'Catalan',      native: 'Català' },
    { value: 'cebuano',      label: 'Cebuano',      native: 'Cebuano' },
    { value: 'chinese',      label: 'Chinese (Simplified)', native: '简体中文' },
    { value: 'chinese_traditional', label: 'Chinese (Traditional)', native: '繁體中文' },
    { value: 'corsican',     label: 'Corsican',     native: 'Corsu' },
    { value: 'croatian',     label: 'Croatian',     native: 'Hrvatski' },
    { value: 'czech',        label: 'Czech',        native: 'Čeština' },
    { value: 'danish',       label: 'Danish',       native: 'Dansk' },
    { value: 'dutch',        label: 'Dutch',        native: 'Nederlands' },
    { value: 'esperanto',    label: 'Esperanto',    native: 'Esperanto' },
    { value: 'estonian',     label: 'Estonian',     native: 'Eesti' },
    { value: 'filipino',     label: 'Filipino',     native: 'Tagalog' },
    { value: 'finnish',      label: 'Finnish',      native: 'Suomi' },
    { value: 'french',       label: 'French',       native: 'Français' },
    { value: 'galician',     label: 'Galician',     native: 'Galego' },
    { value: 'georgian',     label: 'Georgian',     native: 'ქართული' },
    { value: 'german',       label: 'German',       native: 'Deutsch' },
    { value: 'greek',        label: 'Greek',        native: 'Ελληνικά' },
    { value: 'gujarati',     label: 'Gujarati',     native: 'ગુજરાતી' },
    { value: 'haitian_creole', label: 'Haitian Creole', native: 'Kreyòl Ayisyen' },
    { value: 'hausa',        label: 'Hausa',        native: 'Hausa' },
    { value: 'hawaiian',     label: 'Hawaiian',     native: 'ʻŌlelo Hawaiʻi' },
    { value: 'hebrew',       label: 'Hebrew',       native: 'עברית' },
    { value: 'hindi',        label: 'Hindi',        native: 'हिन्दी' },
    { value: 'hmong',        label: 'Hmong',        native: 'Hmoob' },
    { value: 'hungarian',    label: 'Hungarian',    native: 'Magyar' },
    { value: 'icelandic',    label: 'Icelandic',    native: 'Íslenska' },
    { value: 'igbo',         label: 'Igbo',         native: 'Igbo' },
    { value: 'indonesian',   label: 'Indonesian',   native: 'Bahasa Indonesia' },
    { value: 'irish',        label: 'Irish',        native: 'Gaeilge' },
    { value: 'italian',      label: 'Italian',      native: 'Italiano' },
    { value: 'japanese',     label: 'Japanese',     native: '日本語' },
    { value: 'javanese',     label: 'Javanese',     native: 'Basa Jawa' },
    { value: 'kannada',      label: 'Kannada',      native: 'ಕನ್ನಡ' },
    { value: 'kazakh',       label: 'Kazakh',       native: 'Қазақ' },
    { value: 'khmer',        label: 'Khmer',        native: 'ខ្មែរ' },
    { value: 'kinyarwanda',  label: 'Kinyarwanda',  native: 'Ikinyarwanda' },
    { value: 'korean',       label: 'Korean',       native: '한국어' },
    { value: 'kurdish',      label: 'Kurdish',      native: 'Kurdî' },
    { value: 'kyrgyz',       label: 'Kyrgyz',       native: 'Кыргызча' },
    { value: 'lao',          label: 'Lao',          native: 'ລາວ' },
    { value: 'latin',        label: 'Latin',        native: 'Latina' },
    { value: 'latvian',      label: 'Latvian',      native: 'Latviešu' },
    { value: 'lithuanian',   label: 'Lithuanian',   native: 'Lietuvių' },
    { value: 'luxembourgish', label: 'Luxembourgish', native: 'Lëtzebuergesch' },
    { value: 'macedonian',   label: 'Macedonian',   native: 'Македонски' },
    { value: 'malagasy',     label: 'Malagasy',     native: 'Malagasy' },
    { value: 'malay',        label: 'Malay',        native: 'Bahasa Melayu' },
    { value: 'malayalam',    label: 'Malayalam',     native: 'മലയാളം' },
    { value: 'maltese',      label: 'Maltese',      native: 'Malti' },
    { value: 'maori',        label: 'Maori',        native: 'Te Reo Māori' },
    { value: 'marathi',      label: 'Marathi',      native: 'मराठी' },
    { value: 'mongolian',    label: 'Mongolian',    native: 'Монгол' },
    { value: 'nepali',       label: 'Nepali',       native: 'नेपाली' },
    { value: 'norwegian',    label: 'Norwegian',    native: 'Norsk' },
    { value: 'odia',         label: 'Odia',         native: 'ଓଡ଼ିଆ' },
    { value: 'pashto',       label: 'Pashto',       native: 'پښتو' },
    { value: 'persian',      label: 'Persian',      native: 'فارسی' },
    { value: 'polish',       label: 'Polish',       native: 'Polski' },
    { value: 'portuguese',   label: 'Portuguese',   native: 'Português' },
    { value: 'punjabi',      label: 'Punjabi',      native: 'ਪੰਜਾਬੀ' },
    { value: 'romanian',     label: 'Romanian',     native: 'Română' },
    { value: 'russian',      label: 'Russian',      native: 'Русский' },
    { value: 'samoan',       label: 'Samoan',       native: 'Gagana Sāmoa' },
    { value: 'scots_gaelic',  label: 'Scots Gaelic', native: 'Gàidhlig' },
    { value: 'serbian',      label: 'Serbian',      native: 'Српски' },
    { value: 'sesotho',      label: 'Sesotho',      native: 'Sesotho' },
    { value: 'shona',        label: 'Shona',        native: 'ChiShona' },
    { value: 'sindhi',       label: 'Sindhi',       native: 'سنڌي' },
    { value: 'sinhala',      label: 'Sinhala',      native: 'සිංහල' },
    { value: 'slovak',       label: 'Slovak',       native: 'Slovenčina' },
    { value: 'slovenian',    label: 'Slovenian',    native: 'Slovenščina' },
    { value: 'somali',       label: 'Somali',       native: 'Soomaali' },
    { value: 'spanish',      label: 'Spanish',      native: 'Español' },
    { value: 'sundanese',    label: 'Sundanese',    native: 'Basa Sunda' },
    { value: 'swahili',      label: 'Swahili',      native: 'Kiswahili' },
    { value: 'swedish',      label: 'Swedish',      native: 'Svenska' },
    { value: 'tajik',        label: 'Tajik',        native: 'Тоҷикӣ' },
    { value: 'tamil',        label: 'Tamil',        native: 'தமிழ்' },
    { value: 'tatar',        label: 'Tatar',        native: 'Татар' },
    { value: 'telugu',       label: 'Telugu',       native: 'తెలుగు' },
    { value: 'thai',         label: 'Thai',         native: 'ไทย' },
    { value: 'turkish',      label: 'Turkish',      native: 'Türkçe' },
    { value: 'turkmen',      label: 'Turkmen',      native: 'Türkmen' },
    { value: 'ukrainian',    label: 'Ukrainian',    native: 'Українська' },
    { value: 'urdu',         label: 'Urdu',         native: 'اردو' },
    { value: 'uyghur',       label: 'Uyghur',       native: 'ئۇيغۇرچە' },
    { value: 'uzbek',        label: 'Uzbek',        native: 'Oʻzbek' },
    { value: 'vietnamese',   label: 'Vietnamese',   native: 'Tiếng Việt' },
    { value: 'welsh',        label: 'Welsh',        native: 'Cymraeg' },
    { value: 'xhosa',        label: 'Xhosa',       native: 'isiXhosa' },
    { value: 'yiddish',      label: 'Yiddish',      native: 'ייִדיש' },
    { value: 'yoruba',       label: 'Yoruba',       native: 'Yorùbá' },
    { value: 'zulu',         label: 'Zulu',         native: 'isiZulu' },
];

const RECENT_LANGS_KEY = 'st_recent_langs';
const MAX_RECENT = 5;

function getRecentLangs() {
    try {
        return JSON.parse(localStorage.getItem(RECENT_LANGS_KEY)) || [];
    } catch { return []; }
}

function pushRecentLang(value) {
    let recent = getRecentLangs().filter(v => v !== value);
    recent.unshift(value);
    if (recent.length > MAX_RECENT) recent = recent.slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_LANGS_KEY, JSON.stringify(recent));
}

function getLangDisplay(lang) {
    return `${lang.label} (${lang.native})`;
}

function openLangPicker() {
    elements.langPicker.classList.add('open');
    elements.langPickerSearch.value = '';
    renderLangList('');
    // Focus search after animation
    requestAnimationFrame(() => elements.langPickerSearch.focus());
}

function closeLangPicker() {
    elements.langPicker.classList.remove('open');
    _langFocusIdx = -1;
}

let _langFocusIdx = -1;

function renderLangList(query) {
    const list = elements.langPickerList;
    const current = elements.targetLang.value;
    const recent = getRecentLangs();
    const q = query.trim().toLowerCase();

    // Filter languages
    const filtered = ALL_LANGUAGES.filter(lang =>
        !q ||
        lang.label.toLowerCase().includes(q) ||
        lang.native.toLowerCase().includes(q) ||
        lang.value.toLowerCase().includes(q)
    );

    // Split into recent and others
    const recentLangs = [];
    const otherLangs = [];
    for (const lang of filtered) {
        if (recent.includes(lang.value)) {
            recentLangs.push(lang);
        } else {
            otherLangs.push(lang);
        }
    }
    // Sort recent by recency order
    recentLangs.sort((a, b) => recent.indexOf(a.value) - recent.indexOf(b.value));

    list.innerHTML = '';
    _langFocusIdx = -1;

    if (filtered.length === 0) {
        list.innerHTML = '<div class="lang-picker-empty">No languages found</div>';
        return;
    }

    if (recentLangs.length > 0) {
        const sectionEl = document.createElement('div');
        sectionEl.className = 'lang-picker-section';
        sectionEl.textContent = 'Recent';
        list.appendChild(sectionEl);

        for (const lang of recentLangs) {
            list.appendChild(createLangItem(lang, current, true));
        }

        if (otherLangs.length > 0) {
            const divider = document.createElement('div');
            divider.className = 'lang-picker-divider';
            list.appendChild(divider);
        }
    }

    if (otherLangs.length > 0) {
        if (recentLangs.length > 0) {
            const sectionEl = document.createElement('div');
            sectionEl.className = 'lang-picker-section';
            sectionEl.textContent = 'All Languages';
            list.appendChild(sectionEl);
        }

        for (const lang of otherLangs) {
            list.appendChild(createLangItem(lang, current, false));
        }
    }
}

function createLangItem(lang, currentValue, isRecent) {
    const item = document.createElement('div');
    item.className = 'lang-picker-item';
    if (lang.value === currentValue) item.classList.add('active');
    item.dataset.value = lang.value;

    let inner = `<span class="lang-label">${lang.label}</span>`;
    if (isRecent) {
        inner += `<span class="lang-recent-badge">recent</span>`;
    }
    inner += `<span class="lang-native">${lang.native}</span>`;
    item.innerHTML = inner;

    item.addEventListener('click', () => selectLang(lang));
    return item;
}

function selectLang(lang) {
    elements.targetLang.value = lang.value;
    elements.langPickerValue.textContent = getLangDisplay(lang);
    pushRecentLang(lang.value);
    closeLangPicker();
}

function getVisibleItems() {
    return Array.from(elements.langPickerList.querySelectorAll('.lang-picker-item'));
}

function setFocusedItem(idx) {
    const items = getVisibleItems();
    items.forEach(el => el.classList.remove('focused'));
    if (idx >= 0 && idx < items.length) {
        items[idx].classList.add('focused');
        items[idx].scrollIntoView({ block: 'nearest' });
    }
    _langFocusIdx = idx;
}

function initLangPicker() {
    // Restore saved language from recent
    const recent = getRecentLangs();
    if (recent.length > 0) {
        const savedLang = ALL_LANGUAGES.find(l => l.value === recent[0]);
        if (savedLang) {
            elements.targetLang.value = savedLang.value;
            elements.langPickerValue.textContent = getLangDisplay(savedLang);
        }
    }

    // Toggle dropdown
    elements.langPickerTrigger.addEventListener('click', () => {
        if (elements.langPicker.classList.contains('disabled')) return;
        if (elements.langPicker.classList.contains('open')) {
            closeLangPicker();
        } else {
            openLangPicker();
        }
    });

    // Search filtering
    elements.langPickerSearch.addEventListener('input', (e) => {
        renderLangList(e.target.value);
    });

    // Keyboard navigation inside search
    elements.langPickerSearch.addEventListener('keydown', (e) => {
        const items = getVisibleItems();
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setFocusedItem(Math.min(_langFocusIdx + 1, items.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setFocusedItem(Math.max(_langFocusIdx - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (_langFocusIdx >= 0 && _langFocusIdx < items.length) {
                items[_langFocusIdx].click();
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closeLangPicker();
            elements.langPickerTrigger.focus();
        }
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
        if (!elements.langPicker.contains(e.target)) {
            closeLangPicker();
        }
    });

    // Close on Escape (global, extend existing handler)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && elements.langPicker.classList.contains('open')) {
            closeLangPicker();
        }
    });
}
