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
    file: null,
    fileName: '',
    fileFormat: 'srt',
    parsedSubtitle: null,
    translatedSubtitle: null,
    isTranslating: false,
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

    // API Key Modal
    apiKeyModal: document.getElementById('apiKeyModal'),
    modalApiKey: document.getElementById('modalApiKey'),
    toggleModalApiKey: document.getElementById('toggleModalApiKey'),
    modalStatus: document.getElementById('modalStatus'),
    validateKeyBtn: document.getElementById('validateKeyBtn'),
    skipKeyBtn: document.getElementById('skipKeyBtn'),

    themeToggle: document.getElementById('themeToggle')
};

// ============================================
// Local Storage
// ============================================

const STORAGE_KEY = 'subtranslator_apikey';
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
    elements.translateBtn.disabled = !hasFile || state.isTranslating;
}

function setTranslating(translating) {
    state.isTranslating = translating;
    elements.translateBtn.classList.toggle('loading', translating);
    updateTranslateButton();

    // Disable/enable inputs during translation
    elements.targetLang.disabled = translating;
    elements.batchSize.disabled = translating;
    elements.modelSelect.disabled = translating;
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
// File Handling
// ============================================

function handleFile(file) {
    // Validate file type
    const validTypes = ['.srt', '.vtt'];
    const fileName = file.name.toLowerCase();
    const isValid = validTypes.some(ext => fileName.endsWith(ext));

    if (!isValid) {
        showToast('Please upload an SRT or VTT subtitle file.');
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
    state.file = null;
    state.fileName = '';
    state.parsedSubtitle = null;
    state.translatedSubtitle = null;

    elements.dropzone.hidden = false;
    elements.fileInfo.hidden = true;
    elements.fileInput.value = '';

    resetUI();
    hideResumeBanner();
    updateTranslateButton();
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
            `Target language: ${elements.targetLang.options[elements.targetLang.selectedIndex].text}\nBatch size: ${batchSize}\nModel: ${selectedModel}`);
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
    // API Key header button
    elements.apiKeyStatus.addEventListener('click', showApiKeyModal);

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

    // Load saved API key
    state.apiKey = loadApiKey();

    // Setup event listeners
    setupEventListeners();

    // Initial UI state
    updateApiKeyIndicator();
    updateTranslateButton();

    // Show API key modal if no key is saved
    if (!state.apiKey) {
        showApiKeyModal();
    }

    console.log('SubTranslator initialized');
}

// Start the app
init();
