// Admin Console Application
console.log('🚀 Admin app.js version: 2026.02.18.01 loaded');
const storage = new PasteStorage();

// DOM Elements
const pasteTitle = document.getElementById('pasteTitle');
const pasteLanguage = document.getElementById('pasteLanguage');
const pasteExpiration = document.getElementById('pasteExpiration');
const pasteContent = document.getElementById('pasteContent');
const burnAfterRead = document.getElementById('burnAfterRead');
const isPublic = document.getElementById('isPublic');
const pastePassword = document.getElementById('pastePassword');
let currentLocalPasteId = null;
let amRoot = null;
let mainMapRoot = null;
let globeRoot = null;
let polygonSeries = null;
let globalAnalyticsData = null;

// Global Function Registry (Expose early for inline handlers)
window.loadPasteForEdit = loadPasteForEdit;
window.deletePaste = deletePaste;
window.showAnalytics = showAnalytics;
window.toggleVisibility = toggleVisibility;
window.copyPasteUrl = copyPasteUrl;
window.viewPaste = viewPaste;
window.deleteKey = deleteKey;
window.loadIntelData = loadIntelData;
window.resetViews = resetViews;
window.updatePasteViews = updatePasteViews;
window.updateReactionCount = updateReactionCount;
window.injectReaction = injectReaction;
window.deleteReaction = deleteReaction;
window.deleteAnalyticsLogs = deleteAnalyticsLogs;
window.deleteLogsByISP = deleteLogsByISP;
window.deleteLogsFromCity = deleteLogsFromCity;
window.setPasteView = setPasteView;
window.deleteLog = deleteLog;
window.toggleCountryBlock = toggleCountryBlock;
window.getFlagEmoji = getFlagEmoji;
window.loadFirewallList = loadFirewallList;
window.updateFirewallGlobe = updateFirewallGlobe;
window.bulkToggle = bulkToggle;

// Failsafe: close all modals
window.closeAllModals = function () {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(m => {
        m.style.display = 'none';
        m.classList.remove('active');
    });
};

const bannerText = document.getElementById('bannerText');
const updateBannerBtn = document.getElementById('updateBannerBtn');

const createPasteBtn = document.getElementById('createPasteBtn');
const clearBtn = document.getElementById('clearBtn');
const refreshBtn = document.getElementById('refreshBtn');
const viewPublicBtn = document.getElementById('viewPublicBtn');
const statsBtn = document.getElementById('statsBtn');
const pasteListContainer = document.getElementById('pasteListContainer');
const successModal = document.getElementById('successModal');
const statsModal = document.getElementById('statsModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const closeStatsBtn = document.getElementById('closeStatsBtn');
const pasteUrl = document.getElementById('pasteUrl');
const copyUrlBtn = document.getElementById('copyUrlBtn');
const statsContent = document.getElementById('statsContent');
const createModal = document.getElementById('createModal');
const openCreateBtn = document.getElementById('openCreateBtn');

// Folder Elements
const pasteFolder = document.getElementById('pasteFolder');
const manageFoldersBtn = document.getElementById('manageFoldersBtn');
const folderModal = document.getElementById('folderModal');
const closeFolderBtn = document.getElementById('closeFolderBtn');
const newFolderName = document.getElementById('newFolderName');
const addFolderBtn = document.getElementById('addFolderBtn');
const folderList = document.getElementById('folderList');

// Image Elements
const uploadImageBtn = document.getElementById('uploadImageBtn');
const imageInput = document.getElementById('imageInput');

// Access Key Elements
const accessBtn = document.getElementById('accessBtn');
const accessModal = document.getElementById('accessModal');
const closeAccessBtn = document.getElementById('closeAccessBtn');
const generatedKey = document.getElementById('generatedKey');
const copyKeyBtn = document.getElementById('copyKeyBtn');
const generateKeyBtn = document.getElementById('generateKeyBtn');

// Users Elements
const usersBtn = document.getElementById('usersBtn');
const usersModal = document.getElementById('usersModal');
const closeUsersBtn = document.getElementById('closeUsersBtn');
const closeCreateBtn = document.getElementById('closeCreateBtn'); // Added
const usersList = document.getElementById('usersList');



// Firewall Elements
const firewallBtn = document.getElementById('firewallBtn');
const firewallModal = document.getElementById('firewallModal');
const closeFirewallBtn = document.getElementById('closeFirewallBtn');
const firewallList = document.getElementById('firewallList');
const firewallSearch = document.getElementById('firewallSearch');

const intelBtn = document.getElementById('intelBtn');
const intelModal = document.getElementById('intelModal');
const closeIntelBtn = document.getElementById('closeIntelBtn');

// Dashboard Elements
const totalHitsEl = document.getElementById('totalHits');
const uniqueReadersEl = document.getElementById('uniqueReaders');
const geoReachEl = document.getElementById('geoReach');
const activeVisitorsEl = document.getElementById('activeVisitors');
const pasteSearchInput = document.getElementById('pasteSearch');
const logoutBtn = document.getElementById('logoutBtn');

// Initialize (Defensive check for all UI elements)

// Initialize
window.addEventListener('DOMContentLoaded', () => {
    console.log('Admin Console Initializing...');

    // Initial data load (non-blocking)
    Promise.allSettled([
        loadPasteList(),
        loadFolderList(),
        loadGlobalAnalytics(),
        loadBanner()
    ]).then(() => {
        console.log('Async data loaded/settled');
    });

    // Initialize Maps (Immediate)
    try {
        initMainMap();
        initGlobe();

        // Firewall Page Specifics
        if (document.getElementById('firewallList')) {
            loadFirewallList();
        }

        const fwSearch = document.getElementById('firewallSearch');
        if (fwSearch) {
            fwSearch.addEventListener('input', (e) => loadFirewallList(e.target.value));
        }

        const usaBtn = document.getElementById('toggleUSA');
        const euBtn = document.getElementById('toggleEurope');

        if (usaBtn) {
            usaBtn.addEventListener('click', () => {
                const isBlocked = activeBlocks.includes('US');
                bulkToggle(['US'], isBlocked ? 'unblock' : 'block');
            });
        }

        if (euBtn) {
            euBtn.addEventListener('click', () => {
                const euCountries = ['AL', 'AD', 'AT', 'BY', 'BE', 'BA', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IS', 'IE', 'IT', 'LV', 'LI', 'LT', 'LU', 'MT', 'MD', 'MC', 'ME', 'NL', 'MK', 'NO', 'PL', 'PT', 'RO', 'RU', 'SM', 'RS', 'SK', 'SI', 'ES', 'SE', 'CH', 'UA', 'GB', 'VA'];
                const someBlocked = euCountries.some(c => activeBlocks.includes(c));
                bulkToggle(euCountries, someBlocked ? 'unblock' : 'block');
            });
        }
    } catch (e) {
        console.error('Map/Firewall initialization failed:', e);
    }

    // Set refresh intervals
    setInterval(loadGlobalAnalytics, 30000);

    // Initial View State
    const currentMode = localStorage.getItem('pasteViewMode') || 'grid';
    const gridBtn = document.getElementById('grid-view-btn');
    const tableBtn = document.getElementById('list-view-btn');
    if (gridBtn) gridBtn.classList.toggle('active', currentMode === 'grid');
    if (tableBtn) tableBtn.classList.toggle('active', currentMode === 'table');

    // Close modals on backdrop click
    document.querySelectorAll('.modal').forEach(m => {
        m.addEventListener('click', (e) => {
            if (e.target === m) window.closeAllModals();
        });
    });
});

// Event Listeners
if (intelBtn) {
    intelBtn.addEventListener('click', () => {
        if (window.closeAllModals) window.closeAllModals();
        intelModal.style.display = 'flex';
        intelModal.classList.add('active');
        loadIntelData();
    });
}
if (intelModal) {
    intelModal.addEventListener('click', (e) => {
        if (e.target === intelModal) window.closeAllModals();
    });
}
if (closeIntelBtn) closeIntelBtn.addEventListener('click', () => {
    if (window.closeAllModals) window.closeAllModals();
});


// Event Listeners
if (createPasteBtn) createPasteBtn.addEventListener('click', createPaste);

if (openCreateBtn) openCreateBtn.addEventListener('click', () => {
    clearForm();
    if (window.closeAllModals) window.closeAllModals();
    createModal.style.display = 'flex';
    createModal.classList.add('active');
});

if (clearBtn) clearBtn.addEventListener('click', clearForm);
if (refreshBtn) refreshBtn.addEventListener('click', loadPasteList);
if (viewPublicBtn) viewPublicBtn.addEventListener('click', () => {
    window.open('/', '_blank');
});

if (accessBtn) accessBtn.addEventListener('click', () => {
    if (window.closeAllModals) window.closeAllModals();
    accessModal.style.display = 'flex';
    accessModal.classList.add('active');
    generatedKey.value = '';
    loadKeys();
});

if (closeModalBtn) closeModalBtn.addEventListener('click', () => {
    if (window.closeAllModals) window.closeAllModals();
});
if (closeStatsBtn) closeStatsBtn.addEventListener('click', () => {
    if (window.closeAllModals) window.closeAllModals();
});
if (closeAccessBtn) closeAccessBtn.addEventListener('click', () => {
    if (window.closeAllModals) window.closeAllModals();
});
if (closeCreateBtn) closeCreateBtn.addEventListener('click', () => {
    if (window.closeAllModals) window.closeAllModals();
});

if (usersBtn) {
    usersBtn.addEventListener('click', () => {
        if (window.closeAllModals) window.closeAllModals();
        if (usersModal) {
            usersModal.style.display = 'flex';
            usersModal.classList.add('active');
        }
        loadUsers();
    });
}

if (closeUsersBtn) closeUsersBtn.addEventListener('click', () => {
    if (window.closeAllModals) window.closeAllModals();
});

if (usersModal) {
    usersModal.addEventListener('click', (e) => {
        if (e.target === usersModal) window.closeAllModals();
    });
}

if (updateBannerBtn) updateBannerBtn.addEventListener('click', updateBanner);

// Navigation / Tab System
function switchTab(tabId) {
    if (window.closeAllModals) window.closeAllModals();

    // Update Sidebar
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-tab') === tabId);
    });

    // Update Views
    document.querySelectorAll('.view-content').forEach(view => {
        view.style.display = view.id === `${tabId}-view` ? 'block' : 'none';
        if (view.id === `${tabId}-view`) view.classList.add('active');
        else view.classList.remove('active');
    });

    // Update Header
    const titleMap = {
        'dashboard': 'Command Center',
        'traffic': 'Traffic Intelligence',
        'pastes': 'Payload Management'
    };
    const titleEl = document.getElementById('view-title');
    if (titleEl) titleEl.textContent = titleMap[tabId] || 'Command Center';

    // Load tab-specific data
    if (tabId === 'pastes') loadPasteList();
    if (tabId === 'traffic') loadLogs();
}

window.switchTab = switchTab;

// Bind Tab Clicks
document.querySelectorAll('.nav-item[data-tab]').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        switchTab(btn.dataset.tab);
    });
});

if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        if (!confirm('Log out of secure console?')) return;
        try {
            await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
            window.location.href = '/adminperm/login.html';
        } catch (e) {
            window.location.href = '/adminperm/login.html';
        }
    });
}

// Logs Elements
const logsBtn = document.getElementById('logsBtn');
const logsModal = document.getElementById('logsModal');
const closeLogsBtn = document.getElementById('closeLogsBtn');
const logsList = document.getElementById('logsList');
const clearAllLogsBtn = document.getElementById('clearLogsBtn'); // Shared with redesigned traffic view
const trafficSearch = document.getElementById('trafficSearch');

if (logsBtn) {
    logsBtn.addEventListener('click', () => {
        switchTab('traffic');
    });
}
if (clearAllLogsBtn) {
    clearAllLogsBtn.addEventListener('click', async () => {
        if (!confirm('EXTERMINATE ALL TRAFFIC LOGS? This cannot be undone.')) return;
        try {
            const res = await fetch('/api/analytics/logs-clear', { method: 'DELETE', credentials: 'include' });
            if (res.ok) {
                loadLogs();
                loadGlobalAnalytics();
            }
        } catch (e) { alert('Failed to clear logs'); }
    });
}
if (closeLogsBtn) {
    closeLogsBtn.addEventListener('click', () => {
        if (window.closeAllModals) window.closeAllModals();
    });
}
if (trafficSearch) {
    trafficSearch.addEventListener('input', () => {
        loadLogs(trafficSearch.value);
    });
}


if (generateKeyBtn) {
    generateKeyBtn.addEventListener('click', async () => {
        generateKeyBtn.disabled = true;
        generateKeyBtn.textContent = 'Generating...';
        try {
            const res = await fetch('/api/access/generate', {
                method: 'POST',
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                generatedKey.value = data.key;
            } else {
                alert('Failed: ' + (data.error || 'Unknown error'));
            }
        } catch (e) {
            alert('Error: ' + e.message);
        } finally {
            generateKeyBtn.disabled = false;
            generateKeyBtn.textContent = 'Generate New Key';
        }
    });
}

if (copyKeyBtn) copyKeyBtn.addEventListener('click', () => {
    if (!generatedKey.value) return;
    generatedKey.select();
    document.execCommand('copy');

    // Quick visual feedback
    const originalIcon = copyKeyBtn.innerHTML;
    copyKeyBtn.innerHTML = '✅';
    setTimeout(() => copyKeyBtn.innerHTML = originalIcon, 1500);
});

if (accessModal) {
    accessModal.addEventListener('click', (e) => {
        if (e.target === accessModal) window.closeAllModals();
    });
}
if (copyUrlBtn) copyUrlBtn.addEventListener('click', copyUrl);

// Folder Events
if (manageFoldersBtn) manageFoldersBtn.addEventListener('click', () => {
    folderModal.classList.add('active');
});
if (closeFolderBtn) closeFolderBtn.addEventListener('click', () => {
    if (window.closeAllModals) window.closeAllModals();
});
if (addFolderBtn) addFolderBtn.addEventListener('click', createFolder);
if (folderModal) {
    folderModal.addEventListener('click', (e) => {
        if (e.target === folderModal) window.closeAllModals();
    });
}

// Image Events
if (uploadImageBtn) uploadImageBtn.addEventListener('click', () => imageInput.click());
if (imageInput) imageInput.addEventListener('change', handleImageUpload);



// Close modals on background click
if (successModal) {
    successModal.addEventListener('click', (e) => {
        if (e.target === successModal) window.closeAllModals();
    });
}

if (statsModal) {
    statsModal.addEventListener('click', (e) => {
        if (e.target === statsModal) window.closeAllModals();
    });
}

// Analytics modal
const analyticsModal = document.getElementById('analyticsModal');
const closeAnalyticsBtn = document.getElementById('closeAnalyticsBtn');

if (closeAnalyticsBtn) {
    closeAnalyticsBtn.addEventListener('click', () => {
        if (window.closeAllModals) window.closeAllModals();
    });
}

if (analyticsModal) {
    analyticsModal.addEventListener('click', (e) => {
        if (e.target === analyticsModal) window.closeAllModals();
    });
}

// Functions
async function createPaste() {
    const content = pasteContent.value.trim();

    if (!content) {
        alert('Please enter some content!');
        return;
    }

    const config = {
        title: pasteTitle.value.trim() || 'Untitled Paste',
        language: pasteLanguage.value,
        isPublic: isPublic.checked,
        burnAfterRead: burnAfterRead.checked,
        expiresAt: calculateExpiration(pasteExpiration.value),
        folderId: pasteFolder.value || null,
        password: pastePassword.value ? pastePassword.value.trim() : null
    };

    try {
        let id;
        if (currentLocalPasteId) {
            await storage.updatePaste(currentLocalPasteId, content, config);
            id = currentLocalPasteId;
            // Close modal after update
            if (createModal) createModal.classList.remove('active');
            alert('Paste updated successfully!');
        } else {
            id = await storage.createPaste(content, config);
            // Show success modal only for new pastes
            const publicUrl = `${window.location.origin}/v/${id}`;
            pasteUrl.value = publicUrl;
            if (createModal) createModal.classList.remove('active');
            successModal.classList.add('active');
        }

        // Add animation to the button
        createPasteBtn.style.transform = 'scale(0.95)';
        setTimeout(() => {
            createPasteBtn.style.transform = '';
        }, 150);

        // Clear form and reload list
        clearForm();
        await loadPasteList();
    } catch (error) {
        alert('Failed to save paste. Error: ' + error.message);
        console.error(error);
    }
}

function calculateExpiration(expirationValue) {
    if (expirationValue === 'never') return null;

    const now = new Date();
    const expirationMap = {
        '10m': 10 * 60 * 1000,
        '1h': 60 * 60 * 1000,
        '1d': 24 * 60 * 60 * 1000,
        '1w': 7 * 24 * 60 * 60 * 1000,
        '1M': 30 * 24 * 60 * 60 * 1000
    };

    return new Date(now.getTime() + expirationMap[expirationValue]).toISOString();
}

function clearForm() {
    currentLocalPasteId = null;
    pasteTitle.value = '';
    pasteContent.value = '';
    pasteLanguage.value = 'plaintext';
    pasteExpiration.value = 'never';
    pasteFolder.value = '';
    if (pastePassword) pastePassword.value = '';

    burnAfterRead.checked = false;
    isPublic.checked = true;

    // Reset Button
    createPasteBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 4V16M4 10H16" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
        Create Paste
    `;
    createPasteBtn.style.background = '';

    // Reset Modal Title
    if (createModal) {
        const modalTitle = createModal.querySelector('h3');
        if (modalTitle) modalTitle.textContent = 'Deploy New Payload';
    }

    // Remove Quick Copy button if it exists
    const qc = document.getElementById('quickCopyEdit');
    if (qc) qc.remove();
}

async function loadPasteList(searchQuery = '') {
    try {
        const [pastes, folders] = await Promise.all([
            storage.getAllPastes(),
            storage.getAllFolders()
        ]);

        const folderMap = {};
        folders.forEach(f => folderMap[f.id] = f.name);

        // Add rotation animation to refresh button
        if (refreshBtn) {
            refreshBtn.style.transform = 'rotate(360deg)';
            setTimeout(() => {
                refreshBtn.style.transform = '';
            }, 400);
        }

        if (!pastes || pastes.length === 0) {
            pasteListContainer.innerHTML = `
                <div class="empty-state">
                    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                        <path d="M16 8L48 8C51.3137 8 54 10.6863 54 14V50C54 53.3137 51.3137 56 48 56H16C12.6863 56 10 53.3137 10 50V14C10 10.6863 12.6863 8 16 8Z" stroke="currentColor" stroke-width="3"/>
                        <path d="M20 24H44M20 32H44M20 40H36" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
                    </svg>
                    <p>No pastes yet. Create your first one!</p>
                </div>
            `;
            return;
        }

        const filteredPastes = searchQuery
            ? pastes.filter(p =>
                p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.content.toLowerCase().includes(searchQuery.toLowerCase())
            )
            : pastes;

        const isListView = localStorage.getItem('pasteViewMode') === 'table';
        pasteListContainer.classList.toggle('list-view', isListView);

        pasteListContainer.innerHTML = filteredPastes.map(paste => `
            <div class="paste-item ${isListView ? 'list-style' : ''}" onclick="viewPaste('${paste.id}')">
                <div class="paste-item-header">
                    <div class="paste-item-title">${escapeHtml(paste.title)}</div>
                    <div class="paste-item-id">${paste.id}</div>
                </div>
                <div class="paste-item-meta">
                    <div class="meta-pill" style="color: var(--primary-start); border-color: rgba(0, 245, 255, 0.2);">
                        <span class="language-tag">${paste.language}</span>
                    </div>
                    
                    <div class="meta-pill">
                        <span title="Views">👁️</span>
                        <input type="number" value="${paste.views}" 
                            onclick="event.stopPropagation()" 
                            onchange="updatePasteViews('${paste.id}', this.value)"
                            style="width: 45px; background: none; border: none; color: white; font-family: inherit; font-size: 0.85rem; text-align: center; outline: none; -moz-appearance: textfield;">
                    </div>
                    
                    <div class="meta-pill">
                        <span title="Hearts">❤️</span>
                        <input type="number" value="${(paste.reactions && paste.reactions.heart) || 0}" 
                            onclick="event.stopPropagation()" 
                            onchange="updateReactionCount('${paste.id}', 'heart', this.value)"
                            style="width: 40px; background: none; border: none; color: #ff006e; font-family: inherit; font-size: 0.85rem; text-align: center; outline: none; -moz-appearance: textfield; font-weight: bold;">
                    </div>

                    <div class="meta-pill">
                        <span title="Stars">⭐</span>
                        <input type="number" value="${(paste.reactions && paste.reactions.star) || 0}" 
                            onclick="event.stopPropagation()" 
                            onchange="updateReactionCount('${paste.id}', 'star', this.value)"
                            style="width: 40px; background: none; border: none; color: #ffd700; font-family: inherit; font-size: 0.85rem; text-align: center; outline: none; -moz-appearance: textfield; font-weight: bold;">
                    </div>

                    <div class="meta-pill">
                        <span title="Likes">👍</span>
                        <input type="number" value="${(paste.reactions && paste.reactions.like) || 0}" 
                            onclick="event.stopPropagation()" 
                            onchange="updateReactionCount('${paste.id}', 'like', this.value)"
                            style="width: 40px; background: none; border: none; color: #00f5ff; font-family: inherit; font-size: 0.85rem; text-align: center; outline: none; -moz-appearance: textfield; font-weight: bold;">
                    </div>

                    <div class="meta-pill">📅 ${formatDate(paste.createdAt)}</div>
                    ${paste.folderId ? `<div class="meta-pill">📁 ${escapeHtml(folderMap[paste.folderId] || 'Unknown')}</div>` : ''}
                    ${paste.burnAfterRead ? '<div class="meta-pill" style="color: #ff3366; border-color: rgba(255, 51, 102, 0.2);">🔥 Burn</div>' : ''}
                    ${!paste.isPublic ? '<div class="meta-pill" style="color: #ffd700; border-color: rgba(255, 215, 0, 0.2);">🔒 Private</div>' : ''}
                </div>
                <div class="paste-item-actions" style="position: relative; z-index: 10;">
                    <button onclick="event.stopPropagation(); window.copyPasteUrl('${paste.id}', event)" class="btn btn-glass btn-small" title="Copy Public URL" style="border-color: rgba(0, 245, 255, 0.3); color: var(--primary-neon); pointer-events: auto;">
                        🔗 Link
                    </button>
                    <button onclick="event.stopPropagation(); window.toggleVisibility('${paste.id}', event)" class="btn btn-glass btn-small" title="Toggle Visibility" style="pointer-events: auto;">
                        ${paste.isPublic === 0 ? '🔒' : '🔓'}
                    </button>
                    <button onclick="event.stopPropagation(); window.showAnalytics('${paste.id}', event)" class="btn btn-glass btn-small" title="View Analytics" style="pointer-events: auto;">
                        📈
                    </button>
                    <button onclick="event.stopPropagation(); window.loadPasteForEdit('${paste.id}', event)" class="btn btn-glass btn-small" title="Edit" style="pointer-events: auto;">
                        ✏️ Edit
                    </button>
                    <button onclick="event.stopPropagation(); window.deletePaste('${paste.id}', event)" class="btn btn-glass btn-small" title="Delete" style="color: #ff006e; border-color: rgba(255, 0, 110, 0.2); pointer-events: auto;">
                        🗑️
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading paste list:', error);
        pasteListContainer.innerHTML = `<p style="padding: 20px; color: #ff006e">Error: ${error.message}</p>`;
    }
}

async function showAnalytics(pasteId, e) {
    if (e) e.stopPropagation();
    try {
        const analytics = await storage.getAnalytics(pasteId);
        const analyticsContent = document.getElementById('analyticsContent');
        if (!analyticsContent) return;

        // Try to get title from the list if available, else just use the ID
        let pasteTitleStr = pasteId;
        let pasteCreatedAt = null;
        try {
            const pastes = await storage.getAllPastes();
            const pasteData = pastes.find(p => p.id === pasteId);
            if (pasteData) {
                pasteTitleStr = pasteData.title;
                pasteCreatedAt = pasteData.createdAt;
            }
        } catch (e) { }

        // Calculate unique visitors
        const uniqueIPsCount = analytics.uniqueIPs || new Set(analytics.recentViews?.map(v => v.ip) || []).size;
        const totalViewsCount = analytics.totalViews || 0;
        const uniqueCountriesCount = analytics.uniqueCountries || 0;
        const topLocationsArr = analytics.topLocations || [];
        const topISPsArr = analytics.topISPs || [];
        const topRegionsArr = analytics.topRegions || [];

        let html = `
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 24px; border-bottom: 1px solid var(--border); padding-bottom: 16px;">
                <div>
                    <h4 style="font-size: 1.5rem; margin-bottom: 8px; color: var(--primary-start)">${escapeHtml(pasteTitleStr)}</h4>
                    <div style="display: flex; gap: 16px; font-size: 0.875rem; color: var(--text-tertiary)">
                        <span>ID: <code>${pasteId}</code></span>
                        ${pasteCreatedAt ? `<span>Created: ${formatDateTime(pasteCreatedAt)}</span>` : ''}
                    </div>
                    <div style="margin-top: 10px; font-family: var(--font-mono); font-size: 0.8rem; background: rgba(0,0,0,0.3); padding: 8px 12px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; border: 1px solid rgba(0, 245, 255, 0.2);">
                        <span style="color: var(--primary-start); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 15px;">${window.location.origin}/v/${pasteId}</span>
                        <button onclick="copyPasteUrl('${pasteId}')" class="btn-small btn-glass" style="padding: 2px 8px; font-size: 0.7rem; border-color: var(--primary-start); color: var(--primary-start);">Copy Link</button>
                    </div>
                </div>
                <div style="display: flex; flex-direction: column; gap: 8px; align-items: flex-end;">
                    <button onclick="deleteAnalyticsLogs('${pasteId}')" class="btn-small btn-glass" style="color: #ff006e; border-color: rgba(255, 0, 110, 0.3);">
                        🗑️ Clear Logs
                    </button>
                    <button onclick="resetViews('${pasteId}')" class="btn-small btn-glass" style="color: #ffd700; border-color: rgba(255, 215, 0, 0.3);">
                        👁️ Reset Views
                    </button>
                </div>
            </div>
            
            <div class="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 16px; margin-bottom: 32px">
                <div class="stat-card">
                    <div class="stat-value">${totalViewsCount}</div>
                    <div class="stat-label">Total Views</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${uniqueIPsCount}</div>
                    <div class="stat-label">Unique Visitors</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${uniqueCountriesCount}</div>
                    <div class="stat-label">Countries</div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 24px; margin-bottom: 32px;">
                <div style="background: rgba(255,255,255,0.03); padding: 20px; border-radius: 12px; border: 1px solid var(--border)">
                    <h4 style="font-size: 1.1rem; margin-bottom: 16px; color: var(--secondary-start); display: flex; align-items: center; gap: 8px;">📍 <span>Top Cities</span></h4>
                    <div class="location-list" style="max-height: 200px; overflow-y: auto;">
                        ${topLocationsArr.length > 0 ? topLocationsArr.map(loc => `
                            <div class="location-item" style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-weight: 500">${escapeHtml(loc.name)}</span>
                                <span class="badge" style="background: rgba(0,245,255,0.1); color: var(--primary-start); padding: 2px 8px; border-radius: 4px; font-size: 0.8rem;">${loc.count}</span>
                            </div>
                        `).join('') : '<p style="color: var(--text-tertiary); font-style: italic; padding: 10px;">No location data</p>'}
                    </div>
                </div>
                <div style="background: rgba(255,255,255,0.03); padding: 20px; border-radius: 12px; border: 1px solid var(--border)">
                    <h4 style="font-size: 1.1rem; margin-bottom: 16px; color: var(--secondary-start); display: flex; align-items: center; gap: 8px;">🏢 <span>Top ISPs</span></h4>
                    <div class="location-list" style="max-height: 200px; overflow-y: auto;">
                        ${(analytics.topISPs || []).map(isp => `
                            <div class="location-item" style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-weight: 500; font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px;" title="${escapeHtml(isp.name)}">${escapeHtml(isp.name)}</span>
                                <span class="badge" style="background: rgba(255,0,110,0.1); color: var(--secondary-start); padding: 2px 8px; border-radius: 4px; font-size: 0.8rem;">${isp.count}</span>
                            </div>
                        `).join('') || '<p style="color: var(--text-tertiary); font-style: italic; padding: 10px;">No ISP data</p>'}
                    </div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 24px; margin-bottom: 32px;">
                <div style="background: rgba(255,255,255,0.03); padding: 20px; border-radius: 12px; border: 1px solid var(--border)">
                    <h4 style="font-size: 1.1rem; margin-bottom: 16px; color: var(--secondary-start); display: flex; align-items: center; gap: 8px;">🗺️ <span>Top Regions</span></h4>
                    <div class="location-list" style="max-height: 200px; overflow-y: auto;">
                        ${(analytics.topRegions || []).map(reg => `
                            <div class="location-item" style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between;">
                                <span>${escapeHtml(reg.name)}</span>
                                <span style="color: var(--text-tertiary)">${reg.count}</span>
                            </div>
                        `).join('') || '<p style="color: var(--text-tertiary); font-style: italic; padding: 10px;">No region data</p>'}
                    </div>
                </div>
                <div style="background: rgba(255,255,255,0.03); padding: 20px; border-radius: 12px; border: 1px solid var(--border)">
                    <h4 style="font-size: 1.1rem; margin-bottom: 16px; color: var(--secondary-start); display: flex; align-items: center; gap: 8px;">💻 <span>Browsers</span></h4>
                    <div class="location-list" style="max-height: 200px; overflow-y: auto;">
                        ${(analytics.topBrowsers || []).map(br => `
                            <div class="location-item" style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between;">
                                <span>${escapeHtml(br.name)}</span>
                                <span style="color: var(--text-tertiary)">${br.count}</span>
                            </div>
                        `).join('') || '<p style="color: var(--text-tertiary); font-style: italic; padding: 10px;">No browser data</p>'}
                    </div>
                </div>
            </div>
            
            <div style="margin-top: 32px; border-top: 1px solid var(--border); padding-top: 24px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <h4 style="font-size: 1.1rem; margin: 0; color: var(--primary-start)">📋 Detailed View Log</h4>
                    <span style="font-size: 0.75rem; color: var(--text-tertiary)">Showing last 100 entries</span>
                </div>
            </div>
            <div class="views-table" style="max-height: 400px; overflow-y: auto; background: rgba(0,0,0,0.2); border-radius: 12px; border: 1px solid var(--border); position: relative;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem">
                    <thead>
                        <tr style="background: rgba(255,255,255,0.05)">
                            <th style="text-align: left; padding: 12px; color: var(--text-secondary)">Timestamp</th>
                            <th style="text-align: left; padding: 12px; color: var(--text-secondary)">Identity</th>
                            <th style="text-align: left; padding: 12px; color: var(--text-secondary)">Location</th>
                            <th style="text-align: left; padding: 12px; color: var(--text-secondary)">Device / Network</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(analytics.recentViews || []).map(view => {
            let platform = 'Unknown Device';
            const ua = view.userAgent || '';
            if (ua.includes('Windows')) platform = 'Windows PC';
            else if (ua.includes('Macintosh')) platform = 'Mac';
            else if (ua.includes('iPhone')) platform = 'iPhone';
            else if (ua.includes('iPad')) platform = 'iPad';
            else if (ua.includes('Android')) platform = 'Android';
            else if (ua.includes('Linux')) platform = 'Linux';

            if (ua.includes('Chrome/')) platform += ' (Chrome)';
            else if (ua.includes('Firefox/')) platform += ' (Firefox)';
            else if (ua.includes('Safari/')) platform += ' (Safari)';

            return `
                            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05)">
                                <td style="padding: 12px; white-space: nowrap">${formatDateTime(view.timestamp)}</td>
                                <td style="padding: 12px;">
                                    <div style="font-family: var(--font-mono)">${view.ip}</div>
                                    ${view.hostname ? `<small style="color: #00f5ff; font-family: monospace; display:block; margin-top:2px;">${escapeHtml(view.hostname)}</small>` : ''}
                                </td>
                                <td style="padding: 12px">
                                    ${getFlagEmoji(view.countryCode)} ${escapeHtml(view.city)}, ${escapeHtml(view.region || view.regionName || '')}
                                </td>
                                <td style="padding: 12px">
                                    <div style="font-weight: 500">${platform}</div>
                                    <small style="color: var(--text-tertiary)">${escapeHtml(view.isp || view.org || 'Unknown ISP')}</small>
                                </td>
                            </tr>
                        `}).join('')}
                ${!analytics.recentViews || analytics.recentViews.length === 0 ? '<tr><td colspan="4" style="padding: 20px; text-align: center">No view data available yet.</td></tr>' : ''}
                    </tbody>
                </table>
            </div>

            <!-- Reactions Section -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin: 32px 0 16px 0; border-top: 1px solid var(--border); padding-top: 24px;">
                <h4 style="font-size: 1.2rem; margin: 0; color: #ff006e;">❤️ Reactions</h4>
                <div style="display: flex; gap: 8px;">
                    <button onclick="injectReaction('${pasteId}', 'heart')" class="btn-small btn-glass" style="color: #ff006e; border-color: #ff006e44">+ ❤️</button>
                    <button onclick="injectReaction('${pasteId}', 'star')" class="btn-small btn-glass" style="color: #ffd700; border-color: #ffd70044">+ ⭐</button>
                    <button onclick="injectReaction('${pasteId}', 'like')" class="btn-small btn-glass" style="color: #00f5ff; border-color: #00f5ff44">+ 👍</button>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
                <div class="stat-card" style="border-color: #ff006e22">
                    <div class="stat-value" style="color: #ff006e">${analytics.reactions?.heart || 0}</div>
                    <div class="stat-label">Hearts</div>
                </div>
                <div class="stat-card" style="border-color: #ffd70022">
                    <div class="stat-value" style="color: #ffd700">${analytics.reactions?.star || 0}</div>
                    <div class="stat-label">Stars</div>
                </div>
                <div class="stat-card" style="border-color: #00f5ff22">
                    <div class="stat-value" style="color: #00f5ff">${analytics.reactions?.like || 0}</div>
                    <div class="stat-label">Likes</div>
                </div>
            </div>
            
            <div style="height: 40px;"></div> <!-- Spacer -->
            <div style="margin-top: 32px; border-top: 1px solid var(--border); padding-top: 24px;">
                <h4 style="font-size: 1.1rem; margin-bottom: 16px; color: #ff006e;">❤️ Detailed Reaction Logs</h4>
            </div>
            <div class="views-table" style="max-height: 300px; overflow-y: auto; background: rgba(0,0,0,0.2); border-radius: 12px; border: 1px solid var(--border)">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.75rem">
                    <thead>
                        <tr style="background: rgba(255,255,255,0.05)">
                            <th style="padding: 12px; text-align: left;">User</th>
                            <th style="padding: 12px; text-align: left;">Type</th>
                            <th style="padding: 12px; text-align: left;">Location</th>
                            <th style="padding: 12px; text-align: left;">Timestamp</th>
                            <th style="padding: 12px; text-align: right;">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(analytics.detailedReactions || []).map(r => `
                            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05)">
                                <td style="padding: 12px;">
                                    <div style="display:flex; align-items:center; gap:8px;">
                                        <img src="${r.avatarUrl || 'https://cdn.discordapp.com/embed/avatars/0.png'}" style="width:20px; height:20px; border-radius:50%">
                                        <span>${escapeHtml(r.username || r.userId || 'Anon')}</span>
                                    </div>
                                    <small style="color:#666; font-family:monospace">${r.discordId || r.ip}</small>
                                </td>
                                <td style="padding: 12px; font-size:1.2rem;">${r.type === 'heart' ? '❤️' : r.type === 'star' ? '⭐' : '👍'}</td>
                                <td style="padding: 12px;">
                                    ${r.countryCode ? getFlagEmoji(r.countryCode) : ''} ${escapeHtml(r.city || 'Unknown')}<br>
                                    <small style="color:#666">${r.isp || ''}</small>
                                </td>
                                <td style="padding: 12px;">${formatDateTime(r.createdAt)}</td>
                                <td style="padding: 12px; text-align: right;">
                                    <button onclick="deleteReaction(${r.id}, '${pasteId}')" class="btn-small btn-glass" style="color: #ff006e; padding: 2px 5px;">🗑️</button>
                                </td>
                            </tr>
                        `).join('')}
                        ${!analytics.detailedReactions || analytics.detailedReactions.length === 0 ? '<tr><td colspan="5" style="padding: 20px; text-align: center">No reaction logs.</td></tr>' : ''}
                    </tbody>
                </table>
            </div>
        `;

        analyticsContent.innerHTML = html;
        if (window.closeAllModals) window.closeAllModals();
        analyticsModal.style.display = 'flex';
        analyticsModal.classList.add('active');
    } catch (error) {
        console.error('Error showing analytics:', error);
        alert('Failed to load analytics: ' + error.message);
    }
}

async function deleteAnalyticsLogs(id) {
    if (!confirm('Are you sure you want to delete all detailed view logs for this paste? This cannot be undone.')) return;
    try {
        await storage.deleteAnalyticsLogs(id);
        alert('Logs deleted successfully');
        showAnalytics(id); // Refresh
    } catch (error) {
        alert('Failed to delete logs: ' + error.message);
    }
}

async function resetViews(id) {
    if (!confirm('Are you sure you want to reset the view counter for this paste to 0?')) return;
    try {
        await storage.resetViews(id);
        alert('View counter reset successfully');
        if (analyticsModal.classList.contains('active')) {
            showAnalytics(id); // Refresh analytics view
        }
        await loadPasteList(); // Refresh main list
    } catch (error) {
        alert('Failed to reset views: ' + error.message);
    }
}

async function updatePasteViews(id, views) {
    try {
        const res = await fetch(`/api/pastes/${id}/views`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ views: parseInt(views) })
        });
        const data = await res.json();
        if (data.success) {
            console.log(`Updated views for ${id} to ${views}`);
        } else {
            alert('Failed to update views: ' + (data.error || 'Unknown error'));
            loadPasteList(); // Refresh to original value
        }
    } catch (e) {
        console.error('Error updating views:', e);
        alert('Error: ' + e.message);
        loadPasteList(); // Refresh
    }
}

async function updateReactionCount(id, type, count) {
    try {
        const res = await fetch(`/api/pastes/${id}/reactions/${type}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ count: parseInt(count) })
        });
        const data = await res.json();
        if (data.success) {
            console.log(`Updated ${type} for ${id} to ${count}`);
        } else {
            alert(`Failed to update ${type}: ` + (data.error || 'Unknown error'));
            loadPasteList(); // Refresh to original value
        }
    } catch (e) {
        console.error(`Error updating ${type}:`, e);
        alert('Error: ' + e.message);
        loadPasteList(); // Refresh
    }
}

async function injectReaction(pasteId, type, fromList = false) {
    try {
        await fetch(`/api/pastes/${pasteId}/react`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type }),
            credentials: 'include'
        });
        if (fromList) loadPasteList();
        if (analyticsModal.classList.contains('active')) showAnalytics(pasteId);
    } catch (e) {
        alert('Failed to add reaction');
    }
}

async function removeLastReaction(pasteId, type) {
    try {
        const res = await fetch(`/api/pastes/${pasteId}/react/${type}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        if (res.ok) {
            loadPasteList();
            if (analyticsModal.classList.contains('active')) showAnalytics(pasteId);
        } else {
            console.error("No reactions to remove");
        }
    } catch (e) {
        alert('Failed to remove reaction');
    }
}

async function deleteReaction(reactionId, pasteId) {
    if (!confirm('Remove this reaction?')) return;
    try {
        const res = await fetch(`/api/pastes/reactions/${reactionId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        if (res.ok) {
            showAnalytics(pasteId); // Refresh
        }
    } catch (e) {
        alert('Failed to delete reaction');
    }
}

async function deletePaste(id, e) {
    if (e) e.stopPropagation();
    if (!confirm('Are you sure you want to delete this paste?')) return;
    try {
        await storage.deletePaste(id);
        await loadPasteList();
    } catch (error) {
        alert('Failed to delete paste: ' + error.message);
    }
}


function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString();
}

async function loadPasteForEdit(id, e) {
    if (e) e.stopPropagation();
    try {
        const paste = await storage.getPaste(id, false);
        console.log('[DEBUG] Received Paste for Edit:', paste);
        if (!paste) {
            console.error('[DEBUG] No paste returned from storage.getPaste');
            return;
        }

        currentLocalPasteId = paste.id || id;

        // Debug element presence
        console.log('[DEBUG] Elements present:', {
            pasteTitle: !!pasteTitle,
            pasteContent: !!pasteContent,
            pasteLanguage: !!pasteLanguage,
            isPublic: !!isPublic
        });

        if (pasteTitle) pasteTitle.value = paste.title || '';
        if (pasteContent) {
            pasteContent.value = paste.content || '';
            console.log('[DEBUG] Set pasteContent value length:', pasteContent.value.length);
        }
        if (pasteLanguage) pasteLanguage.value = paste.language || 'plaintext';
        if (pasteFolder) pasteFolder.value = paste.folderId || '';

        if (isPublic) isPublic.checked = paste.isPublic !== 0; // 0 is false
        if (burnAfterRead) burnAfterRead.checked = paste.burnAfterRead !== 0;

        if (pastePassword) pastePassword.value = paste.password || '';


        // Reset expiration to never for editing as default, unless we want to parse logic
        if (pasteExpiration) pasteExpiration.value = 'never';

        // Open Modal
        if (createModal) {
            if (window.closeAllModals) window.closeAllModals();
            createModal.style.display = 'flex';
            createModal.classList.add('active');

            // Update title in modal
            const modalTitle = createModal.querySelector('h3');
            if (modalTitle) modalTitle.textContent = 'Edit Payload: ' + paste.id;
        }

        createPasteBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            Update Paste
        `;
        createPasteBtn.style.background = 'linear-gradient(135deg, #7b42ff, #00f5ff)';

        window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (e) {
        console.error('Edit Load Error:', e);
        const errorMsg = e.message || 'Unknown error';
        alert(`Failed to load paste "${id}" for editing.\n\nDetails: ${errorMsg}\n\nCheck the console for more info.`);
    }
}

function viewPaste(id) {
    window.open(`/v/${id}`, '_blank');
}

async function showStats() {
    try {
        const stats = await storage.getStats();

        const languageCards = Object.entries(stats.languageBreakdown || {})
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([lang, count]) => `
                <div class="stat-card">
                    <div class="stat-value">${count}</div>
                    <div class="stat-label">${lang}</div>
                </div>
            `).join('');

        statsContent.innerHTML = `
            <div class="stat-card">
                <div class="stat-value">${stats.totalPastes}</div>
                <div class="stat-label">Total Pastes</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.totalViews}</div>
                <div class="stat-label">Total Views</div>
            </div>
            <div class="stat-card" style="border-color: #ff006e22">
                <div class="stat-value" style="color: #ff006e">${stats.totalReactions || 0}</div>
                <div class="stat-label">Total Reactions</div>
            </div>
            <div class="grid col-3" style="width: 100%; margin-top: 16px">
                ${languageCards}
            </div>
        `;

        if (window.closeAllModals) window.closeAllModals();
        statsModal.style.display = 'flex';
        statsModal.classList.add('active');
    } catch (error) {
        console.error('Error showing stats:', error);
        alert('Failed to load stats: ' + error.message);
    }
}

function copyUrl() {
    pasteUrl.select();
    document.execCommand('copy');

    const originalText = copyUrlBtn.textContent;
    copyUrlBtn.textContent = 'Copied!';
    copyUrlBtn.style.background = 'linear-gradient(135deg, #00ff88, #00f5ff)';

    setTimeout(() => {
        copyUrlBtn.textContent = originalText;
        copyUrlBtn.style.background = '';
    }, 2000);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return date.toLocaleDateString();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + Enter to create paste
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        const activeElement = document.activeElement;
        if (activeElement === pasteContent || activeElement === pasteTitle) {
            e.preventDefault();
            createPaste();
        }
    }
});

// FOLDER MANAGEMENT
async function loadFolderList() {
    try {
        const folders = await storage.getAllFolders();

        // Update dropdown
        const currentValue = pasteFolder.value;
        pasteFolder.innerHTML = '<option value="">Ungrouped</option>' +
            folders.map(f => `<option value="${f.id}">${escapeHtml(f.name)}</option>`).join('');
        pasteFolder.value = currentValue;

        // Update modal list
        folderList.innerHTML = folders.length === 0 ? '<p style="color: var(--text-tertiary); text-align: center; padding: 10px;">No folders yet.</p>' :
            folders.map(f => `
            <div class="folder-item" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid var(--border)">
                <span>📁 ${escapeHtml(f.name)}</span>
                <button onclick="deleteFolder('${f.id}')" class="btn-icon" style="color: #ff006e" title="Delete Folder">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading folders:', error);
    }
}

async function createFolder() {
    const name = newFolderName.value.trim();
    if (!name) return;

    try {
        await storage.createFolder(name);
        newFolderName.value = '';
        await loadFolderList();
    } catch (error) {
        alert('Failed to create folder: ' + error.message);
    }
}

async function deleteFolder(id) {
    if (!confirm('Are you sure you want to delete this folder? Pastes in this folder will NOT be deleted, but will become folder-less.')) return;
    try {
        await storage.deleteFolder(id);
        await loadFolderList();
    } catch (error) {
        alert('Failed to delete folder: ' + error.message);
    }
}

async function loadUsers() {
    try {
        usersList.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-tertiary)">Loading users...</div>';

        const res = await fetch('/api/access/users', { credentials: 'include' });
        const users = await res.json();

        if (!users || users.length === 0) {
            usersList.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-tertiary)">No users found.</div>';
            return;
        }

        usersList.innerHTML = `
            <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem">
                <thead>
                    <tr style="background: rgba(255,255,255,0.05); text-align: left;">
                        <th style="padding: 12px; color: var(--text-secondary)">User</th>
                        <th style="padding: 12px; color: var(--text-secondary)">Identity</th>
                        <th style="padding: 12px; color: var(--text-secondary)">First Seen</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map(u => `
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05)">
                            <td style="padding: 12px;">
                                <div style="display:flex; align-items:center; gap:10px;">
                                    <img src="${u.avatarUrl || 'https://cdn.discordapp.com/embed/avatars/0.png'}" style="width:32px; height:32px; border-radius:50%">
                                    <div>
                                        <div style="font-weight:600; color:white;">${escapeHtml(u.displayName || u.username || 'Unknown')}</div>
                                        <div style="font-size:0.75rem; color:var(--text-tertiary)">${escapeHtml(u.username || '')}</div>
                                    </div>
                                </div>
                            </td>
                            <td style="padding: 12px;">
                                <div style="font-family:monospace; color:var(--primary-start)">${u.discordId}</div>
                                <div style="font-size:0.75rem; color:var(--text-tertiary)">${escapeHtml(u.email || 'No Email')}</div>
                            </td>
                            <td style="padding: 12px; color:var(--text-tertiary)">
                                ${formatDateTime(u.createdAt)}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

    } catch (e) {
        console.error("Load Users Error:", e);
        usersList.innerHTML = `<div style="padding:20px; color:#ff006e">Error loading users: ${e.message}</div>`;
    }
}

// IMAGE UPLOAD
async function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Show loading state on button
    const originalText = uploadImageBtn.innerHTML;
    uploadImageBtn.innerHTML = '⏳ Uploading...';
    uploadImageBtn.disabled = true;

    try {
        const res = await storage.uploadImage(file);
        if (res.success) {
            // Append markdown to content
            const mime = file.type.toLowerCase();
            const ext = file.name.split('.').pop().toLowerCase();
            const isVideo = mime.startsWith('video/') || ['mp4', 'webm', 'mov'].includes(ext);
            const isAudio = mime.startsWith('audio/') || ['mp3', 'wav', 'ogg'].includes(ext);

            let markdown = `\n![${file.name}](${res.url})\n`;
            if (isVideo) {
                markdown = `\n<video controls src="${res.url}" style="max-width: 100%; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);"></video>\n`;
            } else if (isAudio) {
                markdown = `\n<audio controls src="${res.url}" style="width: 100%; margin: 10px 0;"></audio>\n`;
            }

            pasteContent.value += markdown;

            // Visual feedback
            uploadImageBtn.innerHTML = '✅ Added!';
            uploadImageBtn.style.color = '#00ff88';
            setTimeout(() => {
                uploadImageBtn.innerHTML = originalText;
                uploadImageBtn.disabled = false;
                uploadImageBtn.style.color = '';
            }, 1000);
        } else {
            alert('Upload failed: ' + (res.error || 'Server error'));
            uploadImageBtn.innerHTML = originalText;
            uploadImageBtn.disabled = false;
        }
    } catch (e) {
        console.error('Upload Error:', e);
        alert('Upload Error: ' + e.message);
        uploadImageBtn.innerHTML = originalText;
        uploadImageBtn.disabled = false;
    }
}





async function toggleVisibility(id, e) {
    if (e) e.stopPropagation();
    const btn = e ? e.currentTarget : null;
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '⏳';
    }

    try {
        // Fetch full paste data (pass false to trackView to avoid incrementing views)
        const paste = await storage.getPaste(id, false);
        if (!paste) throw new Error('Paste not found');

        const config = {
            title: paste.title,
            language: paste.language,
            isPublic: !paste.isPublic, // TOGGLE
            burnAfterRead: paste.burnAfterRead,
            expiresAt: paste.expiresAt,
            folderId: paste.folderId,
            password: paste.password
        };

        // We use updatePaste which calls PUT /:id
        await storage.updatePaste(id, paste.content, config);
        await loadPasteList();
    } catch (e) {
        console.error(e);
        alert('Toggle failed: ' + e.message);
        if (btn) {
            btn.disabled = false;
        }
    }
}

// --- NEW ADMIN FEATURES ---

async function loadKeys() {
    const keyList = document.getElementById('keyList');
    if (!keyList) return;

    keyList.innerHTML = '<p style="padding:10px; color:#666;">Loading...</p>';

    try {
        const res = await fetch('/api/access/keys');
        const keys = await res.json();

        if (!keys.length) {
            keyList.innerHTML = '<p style="padding:10px; color:#666;">No keys found.</p>';
            return;
        }

        keyList.innerHTML = keys.map(k => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                <div style="overflow: hidden; text-overflow: ellipsis; flex: 1;">
                    <div style="color: #fff; font-family: monospace;">${k.key}</div>
                    <div style="color: #666; font-size: 0.75rem;">
                        ${k.userEmail ? k.userEmail : (k.userId || (k.claimedIp ? `Claimed (${k.claimedIp})` : 'Unclaimed'))} • ${new Date(k.createdAt).toLocaleDateString()}
                    </div>
                </div>
                <button onclick="deleteKey('${k.id}')" class="btn-icon" style="color: #ff0050; opacity: 0.7;" title="Revoke">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </div>
        `).join('');
    } catch (e) {
        keyList.innerHTML = '<p style="padding:10px; color:red;">Error loading keys.</p>';
    }
}

async function deleteKey(id) {
    if (!confirm('Revoke this access key? User will lose access immediately.')) return;
    try {
        await fetch(`/api/access/keys/${id}`, { method: 'DELETE' });
        loadKeys();
    } catch (e) { alert('Failed to delete'); }
}

// Redundant initMainMap removed

// Integrated Analytics Logic
let globeRootVar;
function initGlobe() {
    const container = document.getElementById('chartdiv');
    if (!container || globeRootVar) return;

    try {
        if (typeof am5 === 'undefined' || typeof am5map === 'undefined') {
            setTimeout(initGlobe, 250);
            return;
        }

        const root = am5.Root.new("chartdiv");
        globeRootVar = root;

        // Safer theme loading
        const themes = [];
        if (typeof am5themes_Animated !== 'undefined') {
            themes.push(am5themes_Animated.new(root));
        }
        root.setThemes(themes);

        const chart = root.container.children.push(am5map.MapChart.new(root, {
            panX: "rotateX",
            panY: "rotateY",
            wheelY: "none",
            projection: am5map.geoOrthographic(),
            homeGeoPoint: { latitude: 20, longitude: -20 }
        }));

        // Background / Water
        chart.series.push(am5map.MapPolygonSeries.new(root, {})).mapPolygons.template.setAll({
            fill: am5.color(0x050508),
            strokeOpacity: 0
        });

        // World Map
        const polygonSeries = chart.series.push(am5map.MapPolygonSeries.new(root, {
            geoJSON: (typeof am5geodata_worldLow !== 'undefined') ? am5geodata_worldLow : null
        }));

        if (!polygonSeries.get("geoJSON")) {
            console.error("Geodata not found. Check worldLow.js include.");
        }

        window.firewallPolygonSeries = polygonSeries;

        polygonSeries.mapPolygons.template.setAll({
            tooltipText: "{name}",
            toggleKey: "active",
            interactive: true,
            fill: am5.color(0x232331),
            stroke: am5.color(0x00f5ff),
            strokeWidth: 0.5,
            strokeOpacity: 0.2
        });

        polygonSeries.mapPolygons.template.events.on("click", function (ev) {
            const countryCode = ev.target.dataItem.dataContext.id;
            const countryName = ev.target.dataItem.dataContext.name;

            if (window.toggleCountryBlock) {
                // Check if activeBlocks is available and contains the code
                const isBlocked = (typeof activeBlocks !== 'undefined') ? activeBlocks.includes(countryCode.toUpperCase()) : false;
                window.toggleCountryBlock(countryCode, countryName, !isBlocked);
            }
        });

        polygonSeries.mapPolygons.template.states.create("hover", {
            fill: am5.color(0x00f5ff),
            fillOpacity: 0.3
        });

        polygonSeries.mapPolygons.template.states.create("active", {
            fill: am5.color(0xff0055),
            fillOpacity: 0.9,
            stroke: am5.color(0xff0055),
            strokeOpacity: 1
        });

        chart.animate({
            key: "rotationX",
            from: 0,
            to: 360,
            duration: 60000,
            loops: Infinity
        });

        chart.appear(1000, 100);

        // Sync initial data
        if (typeof activeBlocks !== 'undefined' && activeBlocks.length > 0) {
            updateFirewallGlobe(activeBlocks);
        }

        // --- NEW: Live Hits Series ---
        const pointSeries = chart.series.push(am5map.MapPointSeries.new(root, {}));
        window.globePointSeries = pointSeries;

        pointSeries.bullets.push(function () {
            const circle = am5.Circle.new(root, {
                radius: 4,
                tooltipText: "{hostname} ({countryCode})",
                fill: am5.color(0x00f5ff),
                stroke: root.interfaceColors.get("background"),
                strokeWidth: 2,
                tooltipY: 0
            });

            const circle2 = am5.Circle.new(root, {
                radius: 4,
                fill: am5.color(0x00f5ff),
                fillOpacity: 0.5
            });

            circle2.animate({
                key: "scale",
                from: 1,
                to: 5,
                duration: 1000,
                loops: Infinity
            });

            circle2.animate({
                key: "opacity",
                from: 0.5,
                to: 0,
                duration: 1000,
                loops: Infinity
            });

            return am5.Bullet.new(root, {
                sprite: am5.Container.new(root, {
                    children: [circle2, circle]
                })
            });
        });

        // Start fetching live hits
        fetchGlobeHits();
        setInterval(fetchGlobeHits, 5000);

    } catch (e) {
        console.error('Firewall Globe Error:', e);
    }
}

async function fetchGlobeHits() {
    if (!window.globePointSeries) return;
    try {
        const res = await fetch('/api/analytics/universal-telemetry');
        const hits = await res.json();

        // Map hits to amCharts format
        const points = hits.map(h => ({
            geometry: { type: "Point", coordinates: [h.lon, h.lat] },
            hostname: h.hostname || 'Unknown',
            countryCode: h.countryCode || '??',
            isBlocked: h.isBlocked
        }));

        window.globePointSeries.data.setAll(points);

        // Update real-time feed if it exists
        if (hits && hits.length > 0) {
            updateTrafficFeed(hits.map(h => ({
                source: 'page',
                path: h.path || 'Access',
                ip: h.ip || 'Unknown',
                city: h.city || 'Unknown',
                countryCode: h.countryCode || '??',
                timestamp: h.timestamp || Date.now(),
                isBlocked: h.isBlocked
            })));
        }

        // Update active visitors count if element exists
        const visitorCount = document.getElementById('activeVisitors');
        if (visitorCount) {
            const uniqueIPs = new Set(hits.map(h => h.ip || Math.random())).size;
            visitorCount.textContent = `${uniqueIPs} Active Visitors`;
        }
    } catch (e) {
        console.error("Globe Telemetry Error:", e);
    }
}

function updateGlobeVisualization() {
    if (!window.firewallPolygonSeries || !activeBlocks) return;

    window.firewallPolygonSeries.mapPolygons.each(function (polygon) {
        if (activeBlocks.includes(polygon.dataItem.dataContext.id)) {
            polygon.states.applyAnimate("active");
        } else {
            polygon.states.create("default", { fill: am5.color(0x2d2d3a) });
            polygon.states.applyAnimate("default");
        }
    });
}


// mainMapRoot moved to top scope if needed, but we use the window.mainMapRoot elsewhere or let it be handled in initMainMap
function initMainMap() {
    try {
        const heatmapContainer = document.getElementById('mainHeatmap');
        if (!heatmapContainer || mainMapRoot) return;

        if (typeof am5 === 'undefined') {
            setTimeout(initMainMap, 500);
            return;
        }

        const root = am5.Root.new("mainHeatmap");
        mainMapRoot = root;
        amRoot = root;

        root.setThemes([
            am5themes_Animated.new(root)
        ]);

        const chart = root.container.children.push(am5map.MapChart.new(root, {
            panX: "rotateX",
            panY: "none",
            projection: am5map.geoEqualEarth(),
            homeGeoPoint: { latitude: 10, longitude: 0 },
            homeZoomLevel: 1,
            wheelable: false
        }));

        const series = chart.series.push(am5map.MapPolygonSeries.new(root, {
            geoJSON: am5geodata_worldLow,
            geoJSONNames: am5geodata_lang_EN,
            calculateAggregates: true,
            valueField: "value"
        }));

        polygonSeries = series;

        series.mapPolygons.template.setAll({
            tooltipText: "{name}: {value} Sessions",
            fill: am5.color(0x1a1a26),
            stroke: am5.color(0x2a2a3d),
            fillOpacity: 0.8,
            interactive: true
        });

        series.mapPolygons.template.states.create("hover", {
            fill: am5.color(0x00f5ff),
            fillOpacity: 1
        });

        series.set("heatRules", [{
            target: series.mapPolygons.template,
            dataField: "value",
            min: am5.color(0x1a1a26),
            max: am5.color(0xff006e),
            key: "fill"
        }]);

        if (globalAnalyticsData && globalAnalyticsData.locations) {
            updateMainMap(globalAnalyticsData.locations);
        }
    } catch (e) {
        console.error('❌ Main map init failed:', e);
    }
}


async function loadGlobalAnalytics() {
    try {
        const data = await storage.getGlobalAnalytics();
        globalAnalyticsData = data;

        updateDashboardStats(data);
        updateMainMap(data.locations || []);
        updateTrafficFeed(data.recentActivity || []);
        renderAnalyticsTable(data.recentActivity || []);

        // Update active visitors in header and dashboard
        if (activeVisitorsEl) {
            activeVisitorsEl.textContent = data.activeNow || 0;
        }
        const activeNodesEl = document.getElementById('activeNodes');
        if (activeNodesEl) {
            activeNodesEl.textContent = `${data.activeNow || 0} Active Nodes`;
        }

        // Update Firewall Stats if on firewall page
        const blockedCountEl = document.getElementById('fw-blocked-count');
        const threatsCountEl = document.getElementById('fw-threats-count');
        if (blockedCountEl) blockedCountEl.textContent = data.blockedCountries || 0;
        if (threatsCountEl) threatsCountEl.textContent = data.totalThreats || 0;
    } catch (e) {
        console.error('Failed to load global analytics:', e);
    }
}

function updateDashboardStats(data) {
    if (totalHitsEl) animateValue(totalHitsEl, data.totalVisits || 0);
    if (uniqueReadersEl) animateValue(uniqueReadersEl, data.uniqueVisitors || 0);
    if (geoReachEl) animateValue(geoReachEl, data.uniqueLocations || 0);
}

let currentPulseSort = { field: 'timestamp', direction: 'desc' };

function updateTrafficFeed(activity) {
    const feed = document.getElementById('trafficFeed');
    if (!feed) return;

    if (!activity || activity.length === 0) {
        feed.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-tertiary);">No active telemetry signals...</div>';
        return;
    }

    // Grouping Logic: Same IP + Same Path = Group
    const groups = [];
    const map = new Map();

    activity.forEach(a => {
        const key = `${a.ip}-${a.path}`;
        if (map.has(key)) {
            const group = map.get(key);
            group.count++;
            group.instances.push(a);
            // Keep most recent timestamp
            if (new Date(a.timestamp) > new Date(group.timestamp)) {
                group.timestamp = a.timestamp;
            }
        } else {
            const group = {
                ...a,
                count: 1,
                instances: [a]
            };
            map.set(key, group);
            groups.push(group);
        }
    });

    // Handle Sorting
    groups.sort((a, b) => {
        let valA = a[currentPulseSort.field];
        let valB = b[currentPulseSort.field];

        if (currentPulseSort.field === 'timestamp') {
            valA = new Date(valA).getTime();
            valB = new Date(valB).getTime();
        }

        if (valA < valB) return currentPulseSort.direction === 'asc' ? -1 : 1;
        if (valA > valB) return currentPulseSort.direction === 'asc' ? 1 : -1;
        return 0;
    });

    const sortDirIcon = (field) => {
        if (currentPulseSort.field !== field) return '';
        return currentPulseSort.direction === 'asc' ? ' ↑' : ' ↓';
    };

    let html = `
        <table style="width: 100%; border-collapse: collapse; font-size: 0.75rem;">
            <thead style="position: sticky; top: 0; background: #0a0a0f; z-index: 10; border-bottom: 1px solid var(--border-color);">
                <tr style="text-align: left; color: var(--text-tertiary);">
                    <th style="padding: 10px 8px; cursor: pointer;" onclick="setPulseSort('path')">TARGET / IDENT${sortDirIcon('path')}</th>
                    <th style="padding: 10px 8px; text-align: center; cursor: pointer;" onclick="setPulseSort('count')">HITS${sortDirIcon('count')}</th>
                    <th style="padding: 10px 8px; text-align: right; cursor: pointer;" onclick="setPulseSort('timestamp')">RECENT${sortDirIcon('timestamp')}</th>
                </tr>
            </thead>
            <tbody>
    `;

    html += groups.slice(0, 20).map((g, idx) => {
        const time = new Date(g.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const isPaste = g.source === 'paste';
        const isApi = g.source === 'api';
        const flag = getFlagEmoji(g.countryCode);
        const sourceColor = g.isBlocked ? '#ff0055' : (isApi ? '#7b42ff' : (isPaste ? 'var(--secondary-start)' : 'var(--primary-start)'));

        return `
            <tr class="pulse-row" onclick="this.classList.toggle('expanded')">
                <td style="padding: 10px 8px; display: flex; align-items: center; gap: 8px; min-width: 0;">
                    <div style="width: 4px; height: 20px; background: ${sourceColor}; border-radius: 2px; flex-shrink: 0;"></div>
                    <div style="display: flex; flex-direction: column; min-width: 0;">
                        <span style="color: var(--text-primary); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${g.path}</span>
                        <span style="font-size: 0.65rem; color: var(--text-tertiary);">${flag} ${g.ip}</span>
                    </div>
                </td>
                <td style="padding: 10px 8px; text-align: center;">
                    <span class="pulse-count" style="background: ${sourceColor}33; color: ${sourceColor}; border: 1px solid ${sourceColor}44;">${g.count}</span>
                </td>
                <td style="padding: 10px 8px; text-align: right; font-family: var(--font-mono); font-weight: 800; color: var(--primary-start);">
                    ${time}
                </td>
            </tr>
            <tr class="pulse-details-row">
                <td colspan="3" style="padding: 0;">
                    <div class="pulse-details-box">
                        <div style="margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 4px; color: var(--primary-start); font-weight: 700;">TRANSMISSION LOGS</div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 10px; background: rgba(0,0,0,0.2); padding: 8px; border-radius: 4px; font-family: var(--font-mono); border: 1px solid rgba(0, 245, 255, 0.1);">
                            <div>
                                <div style="color: var(--text-tertiary); font-size: 0.6rem;">MACHINE ID (FINGERPRINT)</div>
                                <div style="color: var(--primary-start); font-size: 0.7rem; word-break: break-all;">${g.fingerprint || 'N/A'}</div>
                            </div>
                            <div>
                                <div style="color: var(--text-tertiary); font-size: 0.6rem;">HARDWARE SIGNATURE</div>
                                <div style="color: var(--text-primary); font-size: 0.7rem;">
                                    ${g.cpuCores ? `CPU: ${g.cpuCores}C` : ''} 
                                    ${g.deviceMemory ? `| RAM: ${g.deviceMemory}GB` : ''}
                                    ${g.screenResolution ? `| ${g.screenResolution}` : ''}
                                </div>
                            </div>
                            <div style="grid-column: span 2;">
                                <div style="color: var(--text-tertiary); font-size: 0.6rem;">GPU / RENDERER</div>
                                <div style="color: #ff0055; font-size: 0.7rem;">${g.gpuRenderer || 'Unknown Renderer'}</div>
                            </div>
                        </div>
                        ${g.instances.slice(0, 5).map(inst => `
                            <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.02); opacity: 0.8;">
                                <span style="font-family: var(--font-mono); color: var(--text-secondary);">${new Date(inst.timestamp).toLocaleTimeString()}</span>
                                <span style="font-size: 0.65rem; color: var(--text-tertiary); font-style: italic;">${inst.userAgent.substring(0, 40)}...</span>
                            </div>
                        `).join('')}
                        ${g.count > 5 ? `<div style="text-align: center; padding-top: 5px; color: var(--text-tertiary); font-size: 0.65rem;">+ ${g.count - 5} more entries in registry</div>` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    html += `</tbody></table>`;
    feed.innerHTML = html;
}

window.setPulseSort = (field) => {
    if (currentPulseSort.field === field) {
        currentPulseSort.direction = currentPulseSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentPulseSort.field = field;
        currentPulseSort.direction = 'desc';
    }
    // Re-render using current data
    if (globalAnalyticsData && globalAnalyticsData.recentActivity) {
        updateTrafficFeed(globalAnalyticsData.recentActivity);
    }
};

function renderAnalyticsTable(logs) {
    const tbody = document.getElementById('analyticsTableBody');
    if (!tbody) return;

    if (!logs || logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-tertiary); padding: 20px;">No signal detected...</td></tr>';
        return;
    }

    tbody.innerHTML = logs.slice(0, 15).map(log => {
        const time = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const plat = parseUserAgent(log.userAgent);
        const flag = getFlagEmoji(log.countryCode);
        const fp = log.fingerprint ? log.fingerprint.substring(0, 10).toUpperCase() : 'UNKNOWN';

        return `
            <tr>
                <td style="color: var(--text-secondary); font-size: 0.75rem;">${time}</td>
                <td style="font-family: var(--font-mono); color: var(--primary-neon);">${log.ip}</td>
                <td><span style="font-family: var(--font-mono); font-size: 0.65rem; color: var(--primary-start); opacity: 0.8;">[${fp}]</span></td>
                <td>${flag} ${log.city || 'US Sector'}</td>
                <td style="max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${log.path}">${log.path}</td>
                <td><span class="badge" style="background: rgba(255,255,255,0.05);">${plat}</span></td>
                <td style="font-size: 0.7rem; color: var(--text-tertiary); max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${log.isp || 'Internal'}</td>
                <td>
                    <span class="status-badge ${log.isBlocked ? 'status-err' : 'status-ok'}" style="font-size: 0.65rem;">${log.isBlocked ? 'BLOCKED' : 'ALLOW'}</span>
                </td>
            </tr>
        `;
    }).join('');
}

function parseUserAgent(ua) {
    if (!ua) return 'Unknown';
    if (ua.includes('Windows')) return 'Windows';
    if (ua.includes('iPhone')) return 'iPhone';
    if (ua.includes('Android')) return 'Android';
    if (ua.includes('Macintosh')) return 'MacOS';
    if (ua.includes('Linux')) return 'Linux';
    return 'Other';
}

function animateValue(obj, value) {
    const start = parseInt(obj.textContent) || 0;
    const end = parseInt(value);
    if (start === end) return;

    // Simple fast animation
    obj.textContent = end;
    obj.style.transition = 'none';
    obj.style.color = 'var(--primary-start)';
    setTimeout(() => {
        obj.style.transition = 'color 1s ease';
        obj.style.color = 'var(--text-primary)';
    }, 50);
}

// Add CSS animation for feed
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInFeed {
        from { opacity: 0; transform: translateX(10px); }
        to { opacity: 1; transform: translateX(0); }
    }
`;
document.head.appendChild(style);

function updateMainMap(locations) {
    if (!polygonSeries) return;

    // Map to amCharts format (countryCode -> value)
    const mapData = (locations || []).map(l => ({
        id: l.countryCode ? l.countryCode.toUpperCase() : 'US',
        value: l.count
    }));

    polygonSeries.data.setAll(mapData);
}


async function deleteLogsByISP(ispName) {
    if (!confirm(`Delete all logs from ISP: ${ispName}?`)) return;
    try {
        await fetch(`/api/pastes/analytics/isp/${encodeURIComponent(ispName)}`, { method: 'DELETE', credentials: 'include' });
        loadGlobalAnalytics();
        if (analyticsModal.classList.contains('active')) {
            // If the analytics modal is open, we might need to refresh it
            // but these are global deletions, so maybe just refresh stats?
            alert('ISP logs deleted');
        }
    } catch (e) { console.error(e); }
}

async function deleteLogsFromCity(cityName) {
    if (!confirm(`Delete logs for ${cityName}?`)) return;
    try {
        await fetch(`/api/pastes/analytics/city/${encodeURIComponent(cityName)}`, { method: 'DELETE', credentials: 'include' });
        loadGlobalAnalytics();
        alert('City logs deleted');
    } catch (e) { console.error(e); }
}

async function loadIntelData() {
    const suspiciousList = document.getElementById('suspiciousList');
    const intelBlocks = document.getElementById('intelBlocks');
    if (!suspiciousList || !intelBlocks) return;

    suspiciousList.innerHTML = '<div style="padding: 20px; text-align: center;">Scanning synchronization channels...</div>';

    try {
        const res = await fetch('/api/analytics/threat-intel', { credentials: 'include' });
        const data = await res.json();

        if (data.suspiciousIPs) {
            suspiciousList.innerHTML = data.suspiciousIPs.length > 0
                ? data.suspiciousIPs.map(node => `
                <div style="padding: 15px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: start;">
                    <div>
                        <div style="font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">${node.ip}</div>
                        <div style="font-size: 0.75rem; color: var(--text-tertiary);">
                            ${node.isp} • ${node.country}
                        </div>
                        <div style="margin-top: 8px; display: flex; gap: 6px;">
                            ${node.is_proxy ? '<span class="badge" style="background: rgba(255,0,110,0.1); color: var(--secondary-start);">PROXY</span>' : ''}
                            ${node.is_hosting ? '<span class="badge" style="background: rgba(123,66,255,0.1); color: var(--primary-start);">HOSTING</span>' : ''}
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 0.9rem; font-weight: 800; color: var(--secondary-start);">${node.hit_count}</div>
                        <div style="font-size: 0.65rem; color: var(--text-tertiary); text-transform: uppercase;">Incidents</div>
                    </div>
                </div>
            `).join('')
                : '<div style="padding: 20px; text-align: center; color: var(--success);">All terminal nodes verified clean.</div>';
        }

        if (data.topBlocked) {
            intelBlocks.innerHTML = data.topBlocked.map(b => `
                <div style="padding: 8px 12px; background: rgba(255,0,110,0.1); border: 1px solid rgba(255,0,110,0.2); border-radius: 8px; display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 1.2rem;">${getFlagEmoji(b.countryCode)}</span>
                    <span style="font-size: 0.8rem; font-weight: 700; color: var(--secondary-start);">${b.countryName}</span>
                </div>
            `).join('');
            if (data.topBlocked.length === 0) intelBlocks.innerHTML = '<div style="font-size: 0.8rem; color: var(--text-tertiary);">No active jurisdictional blocks.</div>';
        }

    } catch (e) {
        console.error('Forensic Intel scan failed:', e);
        suspiciousList.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--error);">Scan Aborted: API Unavailable</div>';
    }
}

// (Redundant assignments removed, consolidated at top)

function setPasteView(mode) {
    localStorage.setItem('pasteViewMode', mode);
    const gridBtn = document.getElementById('grid-view-btn');
    const listBtn = document.getElementById('list-view-btn');
    if (gridBtn) gridBtn.classList.toggle('active', mode === 'grid');
    if (listBtn) listBtn.classList.toggle('active', mode === 'table');
    loadPasteList();
}

function copyPasteUrl(id, e) {
    if (e) e.stopPropagation();
    if (!id) return;
    const url = `${window.location.origin}/v/${id}`;
    navigator.clipboard.writeText(url).then(() => {
        const btn = e ? e.currentTarget : (event?.currentTarget || document.activeElement);
        if (btn && (btn.tagName === 'BUTTON' || btn.tagName === 'SPAN' || btn.classList.contains('btn'))) {
            const originalContent = btn.innerHTML;
            btn.innerHTML = '✅ Copied';
            setTimeout(() => btn.innerHTML = originalContent, 1500);
        }
    }).catch(err => {
        const input = document.createElement('input');
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        alert('Link Copied!');
    });
}

// Bind Listeners
document.addEventListener('DOMContentLoaded', () => {
    const refreshKeysBtn = document.getElementById('refreshKeysBtn');
    if (refreshKeysBtn) refreshKeysBtn.addEventListener('click', loadKeys);

    const clearAnalyticsBtn = document.getElementById('clearAnalyticsBtn');
    if (clearAnalyticsBtn) clearAnalyticsBtn.addEventListener('click', async () => {
        if (!confirm('⚠️ ARE YOU SURE? \n\nThis will wipe ALL analytics data from the database.')) return;

        clearAnalyticsBtn.disabled = true;
        clearAnalyticsBtn.textContent = 'Clearing...';
        try {
            const res = await fetch('/api/pastes/analytics/all', { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                alert('Analytics Database Cleared.');
                loadGlobalAnalytics();
            } else {
                alert('Failed: ' + (data.error || 'Unknown'));
            }
        } catch (e) {
            alert('Error: ' + e.message);
        } finally {
            clearAnalyticsBtn.disabled = false;
            clearAnalyticsBtn.textContent = '⚠️ Clear All Analytics DB';
        }
    });

});
// Banner Management
async function loadBanner() {
    try {
        const response = await fetch('/api/admin/banner');
        if (response.ok) {
            const data = await response.json();
            if (bannerText) bannerText.value = data.text;
        }
    } catch (error) {
        console.error('Failed to load banner:', error);
    }
}

async function updateBanner() {
    if (!bannerText) return;
    const text = bannerText.value;

    updateBannerBtn.innerText = 'Updating...';
    updateBannerBtn.disabled = true;

    try {
        const response = await fetch('/api/admin/banner', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });

        if (response.ok) {
            alert('Banner updated successfully!');
        } else {
            const err = await response.json();
            alert('Failed to update banner: ' + err.error);
        }
    } catch (error) {
        console.error('Error updating banner:', error);
        alert('Error updating banner. Check console.');
    } finally {
        updateBannerBtn.innerText = 'Update Banner';
        updateBannerBtn.disabled = false;
    }
}

async function loadLogs(query = '') {
    try {
        const res = await fetch(`/api/analytics/logs?_t=${Date.now()}`, { credentials: 'include' });
        const data = await res.json();
        if (data.logs) {
            renderLogs(data.logs, query);
            renderTrafficSummary(data.logs);
        }
    } catch (e) {
        console.error('Failed to load logs', e);
    }
}

function renderTrafficSummary(logs) {
    const summaryEl = document.getElementById('trafficSummary');
    if (!summaryEl) return;

    // Calculate Top Sectors
    const sectors = {};
    const ips = {};
    let blocked = 0;

    logs.forEach(l => {
        const country = l.countryCode || '??';
        sectors[country] = (sectors[country] || 0) + 1;
        ips[l.ip] = (ips[l.ip] || 0) + 1;
        if (l.isBlocked) blocked++;
    });

    const topSector = Object.entries(sectors).sort((a, b) => b[1] - a[1])[0] || ['--', 0];
    const topIP = Object.entries(ips).sort((a, b) => b[1] - a[1])[0] || ['--', 0];

    summaryEl.innerHTML = `
        <div class="stat-card">
            <div class="stat-header">TOP SECTOR</div>
            <div class="stat-value" style="font-size: 1.4rem;">${getFlagEmoji(topSector[0])} ${topSector[0]}</div>
            <div class="stat-trend">${topSector[1]} Total Connections</div>
        </div>
        <div class="stat-card">
            <div class="stat-header">HOT IDENTITY</div>
            <div class="stat-value" style="font-size: 1.4rem; color: var(--primary-neon);">${topIP[0]}</div>
            <div class="stat-trend">${topIP[1]} Transmission Bursts</div>
        </div>
        <div class="stat-card">
            <div class="stat-header">SECURITY COMPLIANCE</div>
            <div class="stat-value" style="font-size: 1.4rem; color: ${blocked > 0 ? 'var(--secondary-neon)' : '#00ff9d'};">${blocked} Blocks</div>
            <div class="stat-trend">Total Threats Neutralized</div>
        </div>
    `;
}

function renderLogs(logs, query = '') {
    const tbody = document.getElementById('analyticsTableBody');
    if (!tbody) return;

    const filtered = query
        ? logs.filter(l =>
            l.ip.includes(query) ||
            (l.path && l.path.toLowerCase().includes(query.toLowerCase())) ||
            (l.userAgent && l.userAgent.toLowerCase().includes(query.toLowerCase())) ||
            (l.method && l.method.includes(query.toUpperCase())) ||
            (l.city && l.city.toLowerCase().includes(query.toLowerCase())) ||
            (l.isp && l.isp.toLowerCase().includes(query.toLowerCase())) ||
            (l.fingerprint && l.fingerprint.toLowerCase().includes(query.toLowerCase()))
        )
        : logs;

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--text-secondary); font-family: var(--font-mono);">NO RECORDS FOUND FOR CURRENT SECTOR</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(log => {
        const time = new Date(log.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const plat = parseUserAgent(log.userAgent);
        const flag = getFlagEmoji(log.countryCode);
        const fp = log.fingerprint ? log.fingerprint.substring(0, 8).toUpperCase() : 'ANON';
        const isSuspicious = log.proxy === 1 || log.hosting === 1;

        return `
            <tr class="pulse-row" onclick="this.classList.toggle('expanded')">
                <td style="color: var(--text-secondary); font-size: 0.75rem; white-space: nowrap;">${time}</td>
                <td>
                    <div style="font-family: var(--font-mono); color: var(--primary-neon); font-weight: 600;">${log.ip}</div>
                    <small style="opacity: 0.5; font-size: 0.6rem;">FP: ${fp}</small>
                </td>
                <td>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span>${flag}</span>
                        <div>
                            <div style="font-size: 0.85rem;">${log.city || 'Unknown Sector'}</div>
                            <div style="font-size: 0.65rem; color: var(--text-tertiary);">${log.region || log.regionName || '--'}, ${log.countryCode}</div>
                        </div>
                    </div>
                </td>
                <td style="max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${log.path}">
                    <span class="badge badge-${(log.method || 'GET').toLowerCase()}" style="font-family: var(--font-mono); font-size: 0.65rem; margin-right: 4px;">${log.method || 'GET'}</span>
                    <span style="opacity: 0.9; font-size: 0.85rem;">${log.path}</span>
                </td>
                <td><span class="badge" style="background: rgba(255,255,255,0.05); font-size: 0.7rem;">${plat}</span></td>
                <td style="font-size: 0.75rem; color: var(--text-secondary); max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${log.isp || 'Direct Path'}</td>
                <td style="display: flex; align-items: center; gap: 12px; height: 100%;">
                    <span class="status-badge ${log.isBlocked ? 'status-err' : 'status-ok'}" style="padding: 2px 6px; font-size: 0.65rem;">${log.isBlocked ? 'THREAT' : 'AUTHORIZED'}</span>
                    ${isSuspicious ? '<span title="VPN/Proxy Detected" style="cursor:help;">🛡️</span>' : ''}
                </td>
            </tr>
            <tr class="pulse-details-row">
                <td colspan="7">
                    <div class="pulse-details-box" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; padding: 15px; background: rgba(0,0,0,0.4); border-radius: 0 0 8px 8px;">
                        <div>
                            <div style="color: var(--text-tertiary); font-size: 0.6rem; text-transform: uppercase;">Forensic Data</div>
                            <div style="font-size: 0.75rem; margin-top: 4px;">Host: <span style="color: var(--primary-neon)">${log.hostname || 'Unmapped'}</span></div>
                            <div style="font-size: 0.75rem;">Org: ${log.org || log.isp || 'N/A'}</div>
                        </div>
                        <div>
                            <div style="color: var(--text-tertiary); font-size: 0.6rem; text-transform: uppercase;">Geolocation</div>
                            <div style="font-size: 0.75rem; margin-top: 4px;">Coordinates: ${log.lat}, ${log.lon}</div>
                            <div style="font-size: 0.75rem;">Zip: ${log.zip || 'Unknown'}</div>
                        </div>
                        <div>
                            <div style="color: var(--text-tertiary); font-size: 0.6rem; text-transform: uppercase;">Client Profile</div>
                            <div style="font-size: 0.75rem; margin-top: 4px; max-width: 150px; overflow: hidden; text-overflow: ellipsis;" title="${log.userAgent}">UA: ${log.userAgent}</div>
                            <div style="font-size: 0.75rem;">Fingerprint: <span style="font-family: var(--font-mono); color: var(--secondary-neon)">${log.fingerprint || 'NONE'}</span></div>
                        </div>
                        <div style="text-align: right; display: flex; flex-direction: column; justify-content: flex-end; gap: 5px;">
                            <button onclick="toggleCountryBlock('${log.countryCode}', 'Sector', true)" class="btn-small btn-glass" style="color: var(--secondary-start); padding: 4px 8px;">Block Sector</button>
                            <button onclick="deleteLog(${log.id})" class="btn-small btn-glass" style="opacity: 0.6;">Purge Log</button>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function deleteLog(id) {
    if (!confirm('Exterminate this entry?')) return;
    try {
        const res = await fetch(`/api/analytics/logs/${id}`, { method: 'DELETE', credentials: 'include' });
        if (res.ok) loadLogs(document.getElementById('logsSearch').value);
    } catch (e) { alert('Failed to delete log'); }
}

// Redundant assignment removed

// --- FIREWALL MANAGEMENT ---
const ISO_COUNTRIES = [
    { code: 'AF', name: 'Afghanistan' }, { code: 'AX', name: 'Aland Islands' }, { code: 'AL', name: 'Albania' }, { code: 'DZ', name: 'Algeria' },
    { code: 'AD', name: 'Andorra' }, { code: 'AO', name: 'Angola' }, { code: 'AI', name: 'Anguilla' }, { code: 'AQ', name: 'Antarctica' },
    { code: 'AG', name: 'Antigua and Barbuda' }, { code: 'AR', name: 'Argentina' }, { code: 'AM', name: 'Armenia' }, { code: 'AW', name: 'Aruba' },
    { code: 'AU', name: 'Australia' }, { code: 'AT', name: 'Austria' }, { code: 'AZ', name: 'Azerbaijan' }, { code: 'BS', name: 'Bahamas' },
    { code: 'BH', name: 'Bahrain' }, { code: 'BD', name: 'Bangladesh' }, { code: 'BB', name: 'Barbados' }, { code: 'BY', name: 'Belarus' },
    { code: 'BE', name: 'Belgium' }, { code: 'BZ', name: 'Belize' }, { code: 'BJ', name: 'Benin' }, { code: 'BM', name: 'Bermuda' },
    { code: 'BT', name: 'Bhutan' }, { code: 'BO', name: 'Bolivia' }, { code: 'BQ', name: 'Bonaire' }, { code: 'BA', name: 'Bosnia' },
    { code: 'BW', name: 'Botswana' }, { code: 'BV', name: 'Bouvet Island' }, { code: 'BR', name: 'Brazil' }, { code: 'IO', name: 'British Indian Ocean Territory' },
    { code: 'BN', name: 'Brunei' }, { code: 'BG', name: 'Bulgaria' }, { code: 'BF', name: 'Burkina Faso' }, { code: 'BI', name: 'Burundi' },
    { code: 'CV', name: 'Cabo Verde' }, { code: 'KH', name: 'Cambodia' }, { code: 'CM', name: 'Cameroon' }, { code: 'CA', name: 'Canada' },
    { code: 'KY', name: 'Cayman Islands' }, { code: 'CF', name: 'Central African Republic' }, { code: 'TD', name: 'Chad' }, { code: 'CL', name: 'Chile' },
    { code: 'CN', name: 'China' }, { code: 'CX', name: 'Christmas Island' }, { code: 'CC', name: 'Cocos Islands' }, { code: 'CO', name: 'Colombia' },
    { code: 'KM', name: 'Comoros' }, { code: 'CG', name: 'Congo' }, { code: 'CD', name: 'Congo, DR' }, { code: 'CK', name: 'Cook Islands' },
    { code: 'CR', name: 'Costa Rica' }, { code: 'HR', name: 'Croatia' }, { code: 'CU', name: 'Cuba' }, { code: 'CW', name: 'Curacao' },
    { code: 'CY', name: 'Cyprus' }, { code: 'CZ', name: 'Czechia' }, { code: 'DK', name: 'Denmark' }, { code: 'DJ', name: 'Djibouti' },
    { code: 'DM', name: 'Dominica' }, { code: 'DO', name: 'Dominican Republic' }, { code: 'EC', name: 'Ecuador' }, { code: 'EG', name: 'Egypt' },
    { code: 'SV', name: 'El Salvador' }, { code: 'GQ', name: 'Equatorial Guinea' }, { code: 'ER', name: 'Eritrea' }, { code: 'EE', name: 'Estonia' },
    { code: 'SZ', name: 'Eswatini' }, { code: 'ET', name: 'Ethiopia' }, { code: 'FK', name: 'Falkland Islands' }, { code: 'FO', name: 'Faroe Islands' },
    { code: 'FJ', name: 'Fiji' }, { code: 'FI', name: 'Finland' }, { code: 'FR', name: 'France' }, { code: 'GF', name: 'French Guiana' },
    { code: 'PF', name: 'French Polynesia' }, { code: 'TF', name: 'French Southern Territories' }, { code: 'GA', name: 'Gabon' }, { code: 'GM', name: 'Gambia' },
    { code: 'GE', name: 'Georgia' }, { code: 'DE', name: 'Germany' }, { code: 'GH', name: 'Ghana' }, { code: 'GI', name: 'Gibraltar' },
    { code: 'GR', name: 'Greece' }, { code: 'GL', name: 'Greenland' }, { code: 'GD', name: 'Grenada' }, { code: 'GP', name: 'Guadeloupe' },
    { code: 'GU', name: 'Guam' }, { code: 'GT', name: 'Guatemala' }, { code: 'GG', name: 'Guernsey' }, { code: 'GN', name: 'Guinea' },
    { code: 'GW', name: 'Guinea-Bissau' }, { code: 'GY', name: 'Guyana' }, { code: 'HT', name: 'Haiti' }, { code: 'HM', name: 'Heard Island' },
    { code: 'VA', name: 'Holy See' }, { code: 'HN', name: 'Honduras' }, { code: 'HK', name: 'Hong Kong' }, { code: 'HU', name: 'Hungary' },
    { code: 'IS', name: 'Iceland' }, { code: 'IN', name: 'India' }, { code: 'ID', name: 'Indonesia' }, { code: 'IR', name: 'Iran' },
    { code: 'IQ', name: 'Iraq' }, { code: 'IE', name: 'Ireland' }, { code: 'IM', name: 'Isle of Man' }, { code: 'IL', name: 'Israel' },
    { code: 'IT', name: 'Italy' }, { code: 'JM', name: 'Jamaica' }, { code: 'JP', name: 'Japan' }, { code: 'JE', name: 'Jersey' },
    { code: 'JO', name: 'Jordan' }, { code: 'KZ', name: 'Kazakhstan' }, { code: 'KE', name: 'Kenya' }, { code: 'KI', name: 'Kiribati' },
    { code: 'KP', name: 'Korea (North)' }, { code: 'KR', name: 'Korea (South)' }, { code: 'KW', name: 'Kuwait' }, { code: 'KG', name: 'Kyrgyzstan' },
    { code: 'LA', name: 'Laos' }, { code: 'LV', name: 'Latvia' }, { code: 'LB', name: 'Lebanon' }, { code: 'LS', name: 'Lesotho' },
    { code: 'LR', name: 'Liberia' }, { code: 'LY', name: 'Libya' }, { code: 'LI', name: 'Liechtenstein' }, { code: 'LT', name: 'Lithuania' },
    { code: 'LU', name: 'Luxembourg' }, { code: 'MO', name: 'Macao' }, { code: 'MG', name: 'Madagascar' }, { code: 'MW', name: 'Malawi' },
    { code: 'MY', name: 'Malaysia' }, { code: 'MV', name: 'Maldives' }, { code: 'ML', name: 'Mali' }, { code: 'MT', name: 'Malta' },
    { code: 'MH', name: 'Marshall Islands' }, { code: 'MQ', name: 'Martinique' }, { code: 'MR', name: 'Mauritania' }, { code: 'MU', name: 'Mauritius' },
    { code: 'YT', name: 'Mayotte' }, { code: 'MX', name: 'Mexico' }, { code: 'FM', name: 'Micronesia' }, { code: 'MD', name: 'Moldova' },
    { code: 'MC', name: 'Monaco' }, { code: 'MN', name: 'Mongolia' }, { code: 'ME', name: 'Montenegro' }, { code: 'MS', name: 'Montserrat' },
    { code: 'MA', name: 'Morocco' }, { code: 'MZ', name: 'Mozambique' }, { code: 'MM', name: 'Myanmar' }, { code: 'NA', name: 'Namibia' },
    { code: 'NR', name: 'Nauru' }, { code: 'NP', name: 'Nepal' }, { code: 'NL', name: 'Netherlands' }, { code: 'NC', name: 'New Caledonia' },
    { code: 'NZ', name: 'New Zealand' }, { code: 'NI', name: 'Nicaragua' }, { code: 'NE', name: 'Niger' }, { code: 'NG', name: 'Nigeria' },
    { code: 'NU', name: 'Niue' }, { code: 'NF', name: 'Norfolk Island' }, { code: 'MP', name: 'Northern Mariana Islands' }, { code: 'NO', name: 'Norway' },
    { code: 'OM', name: 'Oman' }, { code: 'PK', name: 'Pakistan' }, { code: 'PW', name: 'Palau' }, { code: 'PS', name: 'Palestine' },
    { code: 'PA', name: 'Panama' }, { code: 'PG', name: 'Papua New Guinea' }, { code: 'PY', name: 'Paraguay' }, { code: 'PE', name: 'Peru' },
    { code: 'PH', name: 'Philippines' }, { code: 'PN', name: 'Pitcairn' }, { code: 'PL', name: 'Poland' }, { code: 'PT', name: 'Portugal' },
    { code: 'PR', name: 'Puerto Rico' }, { code: 'QA', name: 'Qatar' }, { code: 'RE', name: 'Reunion' }, { code: 'RO', name: 'Romania' },
    { code: 'RU', name: 'Russia' }, { code: 'RW', name: 'Rwanda' }, { code: 'BL', name: 'Saint Barthelemy' }, { code: 'SH', name: 'Saint Helena' },
    { code: 'KN', name: 'Saint Kitts and Nevis' }, { code: 'LC', name: 'Saint Lucia' }, { code: 'MF', name: 'Saint Martin' },
    { code: 'PM', name: 'Saint Pierre and Miquelon' }, { code: 'VC', name: 'Saint Vincent and the Grenadines' }, { code: 'WS', name: 'Samoa' },
    { code: 'SM', name: 'San Marino' }, { code: 'ST', name: 'Sao Tome and Principe' }, { code: 'SA', name: 'Saudi Arabia' }, { code: 'SN', name: 'Senegal' },
    { code: 'RS', name: 'Serbia' }, { code: 'SC', name: 'Seychelles' }, { code: 'SL', name: 'Sierra Leone' }, { code: 'SG', name: 'Singapore' },
    { code: 'SX', name: 'Sint Maarten' }, { code: 'SK', name: 'Slovakia' }, { code: 'SI', name: 'Slovenia' }, { code: 'SB', name: 'Solomon Islands' },
    { code: 'SO', name: 'Somalia' }, { code: 'ZA', name: 'South Africa' }, { code: 'GS', name: 'South Georgia' }, { code: 'SS', name: 'South Sudan' },
    { code: 'ES', name: 'Spain' }, { code: 'LK', name: 'Sri Lanka' }, { code: 'SD', name: 'Sudan' }, { code: 'SR', name: 'Suriname' },
    { code: 'SJ', name: 'Svalbard and Jan Mayen' }, { code: 'SE', name: 'Sweden' }, { code: 'CH', name: 'Switzerland' }, { code: 'SY', name: 'Syria' },
    { code: 'TW', name: 'Taiwan' }, { code: 'TJ', name: 'Tajikistan' }, { code: 'TZ', name: 'Tanzania' }, { code: 'TH', name: 'Thailand' },
    { code: 'TL', name: 'Timor-Leste' }, { code: 'TG', name: 'Togo' }, { code: 'TK', name: 'Tokelau' }, { code: 'TO', name: 'Tonga' },
    { code: 'TT', name: 'Trinidad and Tobago' }, { code: 'TN', name: 'Tunisia' }, { code: 'TR', name: 'Turkey' }, { code: 'TM', name: 'Turkmenistan' },
    { code: 'TC', name: 'Turks and Caicos Islands' }, { code: 'TV', name: 'Tuvalu' }, { code: 'UG', name: 'Uganda' }, { code: 'UA', name: 'Ukraine' },
    { code: 'AE', name: 'United Arab Emirates' }, { code: 'GB', name: 'United Kingdom' }, { code: 'US', name: 'United States' },
    { code: 'UM', name: 'US Minor Outlying Islands' }, { code: 'UY', name: 'Uruguay' }, { code: 'UZ', name: 'Uzbekistan' }, { code: 'VU', name: 'Vanuatu' },
    { code: 'VE', name: 'Venezuela' }, { code: 'VN', name: 'Vietnam' }, { code: 'VG', name: 'Virgin Islands, British' },
    { code: 'VI', name: 'Virgin Islands, U.S.' }, { code: 'WF', name: 'Wallis and Futuna' }, { code: 'EH', name: 'Western Sahara' },
    { code: 'YE', name: 'Yemen' }, { code: 'ZM', name: 'Zambia' }, { code: 'ZW', name: 'Zimbabwe' }
];

let activeBlocks = [];

async function loadFirewallList(query = '') {
    const list = document.getElementById('firewallList');
    if (!list) return;

    try {
        const res = await fetch('/api/firewall/status', { credentials: 'include' });
        const data = await res.json();
        if (data.success) {
            activeBlocks = data.blocklist || [];
            updateFirewallGlobe(activeBlocks);

            // SYNC STATS: Update the sidebar counters directly from this specific firewall payload
            const blockedCountEl = document.getElementById('fw-blocked-count');
            const threatsCountEl = document.getElementById('fw-threats-count');

            if (blockedCountEl) blockedCountEl.textContent = activeBlocks.length;
            if (threatsCountEl && data.statistics) {
                threatsCountEl.textContent = data.statistics.blocked_attempts || 0;
            }
        }
    } catch (e) { console.error("Failed to load firewall list", e); }

    const filtered = query
        ? ISO_COUNTRIES.filter(c => c.name.toLowerCase().includes(query.toLowerCase()) || c.code.toLowerCase().includes(query.toLowerCase()))
        : ISO_COUNTRIES;

    list.innerHTML = filtered.map(c => {
        const isActive = activeBlocks.includes(c.code.toUpperCase());

        return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-size: 1.2rem;">${getFlagEmoji(c.code)}</span>
                    <div>
                        <div style="font-weight: 600; font-size: 0.9rem;">${c.name}</div>
                        <div style="font-size: 0.7rem; color: rgba(255,255,255,0.4); font-family: monospace;">${c.code}</div>
                    </div>
                </div>
                <label class="neon-toggle">
                    <input type="checkbox" ${isActive ? 'checked' : ''} onchange="toggleCountryBlock('${c.code}', '${c.name.replace(/'/g, "\\\'")}', this.checked)">
                    <span class="slider"></span>
                </label>
            </div>
        `;
    }).join('');
}

async function toggleCountryBlock(code, name, status) {
    try {
        const res = await fetch('/api/firewall/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ countryCode: code })
        });
        const data = await res.json();
        if (data.success) {
            // Update local state and re-render to ensure UI reflects real state
            if (data.action === 'added') {
                if (!activeBlocks.includes(code.toUpperCase())) activeBlocks.push(code.toUpperCase());
            } else {
                activeBlocks = activeBlocks.filter(b => b !== code.toUpperCase());
            }
        } else {
            alert("Failed: " + data.error);
            loadFirewallList(); // Refresh on failure
        }
    } catch (e) {
        alert("Error: " + e.message);
        loadFirewallList();
    }
}

function getFlagEmoji(countryCode) {
    if (!countryCode || countryCode === '??') return '🌐';
    const codePoints = countryCode
        .toUpperCase()
        .split('')
        .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
}

function updateFirewallGlobe(blockedCodes) {
    if (!window.firewallPolygonSeries) return;

    const heatmapData = blockedCodes.map(code => ({
        id: code,
        settings: { fill: am5.color(0xff0055), fillOpacity: 1 }
    }));

    window.firewallPolygonSeries.data.setAll(heatmapData);
}

// Redundant assignments removed

async function bulkToggle(countries, action) {
    try {
        const res = await fetch('/api/firewall/bulk-toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ countries, action })
        });
        if (res.ok) {
            loadFirewallList();
            loadGlobalAnalytics();
        }
    } catch (e) {
        console.error('Bulk toggle failed', e);
        alert('Bulk operation failed: ' + e.message);
    }
}

