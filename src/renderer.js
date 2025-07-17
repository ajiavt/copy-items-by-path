// DOM Elements
const sourcePathInput = document.getElementById('sourcePath');
const targetPathInput = document.getElementById('targetPath');
const browseSourceBtn = document.getElementById('browseSource');
const browseTargetBtn = document.getElementById('browseTarget');
const itemsListTextarea = document.getElementById('itemsList');
const ignoreExtensionsCheckbox = document.getElementById('ignoreExtensions');
const startCopyBtn = document.getElementById('startCopy');
const logArea = document.getElementById('logArea');
const buttonText = document.getElementById('buttonText');
const buttonSpinner = document.getElementById('buttonSpinner');

// State
let isCopying = false;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    setupIpcListeners();
    updateStartButtonState();
});

function setupEventListeners() {
    // Browse buttons
    browseSourceBtn.addEventListener('click', () => selectFolder('source'));
    browseTargetBtn.addEventListener('click', () => selectFolder('target'));

    // Input validation
    sourcePathInput.addEventListener('input', updateStartButtonState);
    targetPathInput.addEventListener('input', updateStartButtonState);
    itemsListTextarea.addEventListener('input', updateStartButtonState);

    // Start copy button
    startCopyBtn.addEventListener('click', handleStartCopy);
}

function setupIpcListeners() {
    // Log messages
    window.electronAPI.onLogMessage((event, message) => {
        addLogMessage(message);
    });

    // Progress updates
    window.electronAPI.onProgressUpdate((event, { processed, total }) => {
        buttonText.textContent = `Processing... (${processed}/${total})`;
    });

    // Copy completed
    window.electronAPI.onCopyCompleted(() => {
        isCopying = false;
        buttonText.textContent = 'Start Copy';
        buttonSpinner.classList.add('hidden');
        startCopyBtn.disabled = false;
        updateStartButtonState();
    });
}

async function selectFolder(type) {
    try {
        const folderPath = await window.electronAPI.selectFolder();
        if (folderPath) {
            if (type === 'source') {
                sourcePathInput.value = folderPath;
            } else {
                targetPathInput.value = folderPath;
            }
            updateStartButtonState();
        }
    } catch (error) {
        addLogMessage(`Error selecting folder: ${error.message}`);
    }
}

function updateStartButtonState() {
    const sourcePath = sourcePathInput.value.trim();
    const targetPath = targetPathInput.value.trim();
    const itemsList = itemsListTextarea.value.trim();

    const isValid = sourcePath && targetPath && itemsList && !isCopying;
    startCopyBtn.disabled = !isValid;
}

async function handleStartCopy() {
    if (isCopying) return;

    const sourcePath = sourcePathInput.value.trim();
    const targetPath = targetPathInput.value.trim();
    const itemsList = itemsListTextarea.value.trim();
    const ignoreExtensions = ignoreExtensionsCheckbox.checked;

    if (!sourcePath || !targetPath || !itemsList) {
        addLogMessage('Please fill in all required fields.');
        return;
    }

    isCopying = true;
    startCopyBtn.disabled = true;
    buttonText.textContent = 'Starting...';
    buttonSpinner.classList.remove('hidden');

    // Clear log
    logArea.innerHTML = '';

    try {
        const result = await window.electronAPI.startCopy({
            sourcePath,
            targetPath,
            itemsList,
            ignoreExtensions
        });

        if (result.success) {
            addLogMessage(`✓ Copy operation completed successfully!`);
        } else {
            addLogMessage(`✗ Copy operation failed: ${result.error}`);
        }
    } catch (error) {
        addLogMessage(`✗ Error starting copy operation: ${error.message}`);
        isCopying = false;
        buttonText.textContent = 'Start Copy';
        buttonSpinner.classList.add('hidden');
        updateStartButtonState();
    }
}

function addLogMessage(message) {
    const logEntry = document.createElement('div');
    logEntry.className = 'mb-1';

    const timestamp = new Date().toLocaleTimeString();
    logEntry.innerHTML = `<span class="text-gray-500">[${timestamp}]</span> ${message}`;

    logArea.appendChild(logEntry);
    logArea.scrollTop = logArea.scrollHeight;
}

// Handle window unload
window.addEventListener('beforeunload', () => {
    window.electronAPI.removeAllListeners('log-message');
    window.electronAPI.removeAllListeners('progress-update');
    window.electronAPI.removeAllListeners('copy-completed');
});
