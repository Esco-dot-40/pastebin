// VEROE High-Efficiency Admin Console V5
const api = new PasteStorage();

// State Management
let mainMap = null;
let mainMapMarkers = [];
let globalAnalytics = null;
let globalKeys = [];
let globalBrowsers = [];
let globalISPs = [];

let currentTab = 'creator';
let activeEditId = null;

// Initialization
window.addEventListener('DOMContentLoaded', async () => {
    populateConfig();

    // Initial data load
    await refreshData();

    // Switch to initial tab
    switchTab('creator');

    setupFilters();

    // Interval Updates
    setInterval(async () => {
        if (currentTab === 'analytics' || currentTab === 'repository') {
            await refreshData();
        }
    }, 15000);

    // SECURITY HANDLERS
    const genKeyBtn = document.getElementById('generateKeyBtn');
    if (genKeyBtn) {
        genKeyBtn.onclick = async () => {
            try {
                await api.generateAccessKey();
                await refreshData();
                showToast('New Access Key Generated', 'success');
            } catch (e) { showToast(e.message, 'error'); }
        };
    }
});

function setupFilters() {
    const setup = (inputId, dataSet, renderFn) => {
        const el = document.getElementById(inputId);
        if (!el) return;
        el.oninput = (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = dataSet.filter(item =>
                (item.name || item.key || '').toLowerCase().includes(term)
            );
            renderFn(filtered);
        };
    };

    // We pass wrapper functions to render the specific filtered data
    setup('searchBrowsers', globalBrowsers || [], (d) => populateIntelList('browserList', d));
    setup('searchISPs', globalISPs || [], (d) => populateIntelList('connectionList', d));
    setup('searchKeys', globalKeys || [], (d) => renderAccessKeys(d));
}

async function refreshData() {
    try {
        // Parallel Fetch for speed
        const [stats, keys, users] = await Promise.all([
            api.getGlobalAnalytics(),
            api.getAllAccessKeys(),
            api.getAllUsers()
        ]);

        globalAnalytics = stats;
        globalKeys = keys;
        globalBrowsers = stats.browsers || [];
        globalISPs = stats.isps || [];

        updateGlobalUI(stats);

        if (currentTab === 'repository') await populateActiveNodes();

        if (currentTab === 'analytics') {
            updateGlobalAnalyticsUI(stats);
            renderAccessKeys(keys);
            // Re-run filters if text exists
            document.getElementById('searchBrowsers').dispatchEvent(new Event('input'));
            document.getElementById('searchISPs').dispatchEvent(new Event('input'));
            document.getElementById('searchKeys').dispatchEvent(new Event('input'));

            if (!mainMap) setTimeout(initMainMap, 500);
            else updateMainMap(stats.locations || []);
        }

    } catch (e) {
        console.error('Data refresh error:', e);
    }
}

function updateGlobalUI(data) {
    const vEl = document.getElementById('activeVisitors');
    if (vEl) vEl.textContent = `${data.activeNow || 0} Active Visitors`;
}

async function populateConfig() {
    const langSelect = document.getElementById('pasteLanguage');
    if (langSelect) {
        const langs = [
            { id: 'plaintext', name: 'Plain Text' },
            { id: 'javascript', name: 'JavaScript' },
            { id: 'python', name: 'Python' },
            { id: 'html', name: 'HTML' },
            { id: 'css', name: 'CSS' },
            { id: 'json', name: 'JSON' },
            { id: 'markdown', name: 'Markdown' }
        ];
        langSelect.innerHTML = langs.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
    }
}

// --- TABS ---
function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.nav-link').forEach(l => {
        l.classList.toggle('active', l.dataset.tab === tab);
    });
    document.querySelectorAll('.tab-pane').forEach(p => {
        p.classList.toggle('active', p.id === `tab-${tab}`);
    });

    if (tab === 'repository') {
        populateActiveNodes();
        refreshFolders();
    }
    if (tab === 'analytics') refreshData();
}

document.querySelectorAll('.nav-link').forEach(link => {
    link.onclick = (e) => {
        e.preventDefault();
        switchTab(link.dataset.tab);
    }
});

// --- REPOSITORY: PASTE LIST (TABLE VIEW) ---
async function populateActiveNodes() {
    const container = document.getElementById('pasteListContainer');
    if (!container) return;

    try {
        const pastes = await api.getAllPastes();
        const search = document.getElementById('repoSearch').value.toLowerCase();

        const filtered = pastes.filter(p =>
            (p.title || '').toLowerCase().includes(search) ||
            p.id.toLowerCase().includes(search) ||
            (p.content && p.content.toLowerCase().includes(search)) ||
            (p.folderName && p.folderName.toLowerCase().includes(search))
        );

        if (filtered.length === 0) {
            container.innerHTML = '<tr><td colspan="6" class="empty-state" style="text-align:center; padding:50px; opacity:0.3; font-style:italic;">SYSTEM BUFFER EMPTY: NO NODES MATCHING SIGNATURE</td></tr>';
            return;
        }

        container.innerHTML = filtered.map(p => `
            <tr class="repo-row-v5">
                <td class="id-cell">
                    <span class="hex-id">${p.id.toUpperCase()}</span>
                </td>
                <td class="payload-cell">
                    <div class="payload-title">${p.title || 'Undeclared Payload'}</div>
                    <div class="payload-meta">
                        <span class="lang-tag">${p.language}</span>
                        ${p.folderName ? `<span class="folder-tag">/ ${p.folderName}</span>` : ''}
                    </div>
                </td>
                <td class="date-cell">
                    <div class="date-val">${p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '??'}</div>
                    <div class="date-secondary">${p.createdAt ? timeAgo(p.createdAt) : 'Unknown'}</div>
                </td>
                <td class="stats-cell">
                    <div class="stat-main">${p.views}</div>
                    <div class="stat-label">PROPAGATIONS</div>
                </td>
                <td class="reaction-cell">
                    <div class="reaction-flex">
                        <span class="r-item heart ${p.reactions?.heart > 0 ? 'active' : ''}">♥ ${p.reactions?.heart || 0}</span>
                        <span class="r-item star ${p.reactions?.star > 0 ? 'active' : ''}">★ ${p.reactions?.star || 0}</span>
                        <span class="r-item like ${p.reactions?.like > 0 ? 'active' : ''}">👍 ${p.reactions?.like || 0}</span>
                    </div>
                </td>
                <td class="action-cell">
                    <div class="action-buttons-v5">
                        <button class="btn-repo-v5" title="Copy Stream Link" onclick="copyPasteLink('${p.id}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                        </button>
                        <button class="btn-repo-v5" title="Deep Analysis" onclick="openNodeAnalytics('${p.id}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
                        </button>
                        <button class="btn-repo-v5" title="Metric Override" onclick="openNodeEdits('${p.id}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                        </button>
                        <button class="btn-repo-v5" title="Edit Payload" onclick="editPaste('${p.id}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button class="btn-repo-v5 danger" title="Wipe Node" onclick="deletePaste('${p.id}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        container.innerHTML = `<tr><td colspan="6" class="error-state">Failed to sync: ${e.message}</td></tr>`;
    }
}

document.getElementById('repoSearch').oninput = populateActiveNodes;

// --- FOLDER MANAGEMENT ---
async function refreshFolders() {
    try {
        const folders = await api.getAllFolders();

        // 1. Populate Dropdown in Creator
        const select = document.getElementById('pasteFolder');
        if (select) {
            select.innerHTML = '<option value="">Root Sector</option>' +
                folders.map(f => `<option value="${f.id}">${f.name.toUpperCase()}</option>`).join('');
        }

        // 2. Populate Chips in Repository
        const chipContainer = document.getElementById('folderChipContainer');
        if (chipContainer) {
            chipContainer.innerHTML = folders.map(f => `
                <div class="folder-chip-v5">
                    <span class="name">${f.name}</span>
                    <button class="del" onclick="deleteFolder('${f.id}')">&times;</button>
                </div>
            `).join('');
        }
    } catch (e) {
        console.error("Folder sync failed:", e);
    }
}

window.createNewFolder = async () => {
    const input = document.getElementById('newFolderName');
    const name = input.value.trim();
    if (!name) return showToast('ENTER SECTOR NAME', 'error');

    try {
        await api.createFolder(name);
        input.value = '';
        showToast(`NEW SECTOR [${name}] INITIALIZED`, 'success');
        await refreshFolders();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

window.deleteFolder = async (id) => {
    if (!confirm('DESTROY SECTOR? ALL NODES WILL BE REASSIGNED TO ROOT.')) return;
    try {
        await api.deleteFolder(id);
        showToast('SECTOR DECOMMISSIONED', 'success');
        await refreshFolders();
        await populateActiveNodes();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

// --- CREATOR: EDITING ---
async function editPaste(id) {
    try {
        const p = await api.getPaste(id, false);
        if (!p) return;

        activeEditId = id;
        document.getElementById('editorTitle').textContent = `RE-PROPAGATING NODE: ${id}`;
        document.getElementById('editStatusBar').style.display = 'flex';
        document.getElementById('activeNodeId').textContent = `ID: ${id}`;

        document.getElementById('pasteTitle').value = p.title || '';
        document.getElementById('pasteLanguage').value = p.language || 'plaintext';
        document.getElementById('pasteContent').value = p.content || '';
        document.getElementById('pasteFolder').value = p.folderId || '';
        document.getElementById('isPublic').checked = p.isPublic === 1;
        document.getElementById('burnAfterRead').checked = p.burnAfterRead === 1;
        document.getElementById('pasteEmbed').value = p.embedUrl || '';

        const btn = document.getElementById('createPasteBtn');
        btn.textContent = 'Update Node';
        btn.classList.add('updating');

        switchTab('creator');
        showToast(`SYNCING NODE [${id}] TO TERMINAL`, 'info');

    } catch (e) {
        showToast(e.message, 'error');
    }
}

function clearEditor() {
    activeEditId = null;
    document.getElementById('editorTitle').textContent = 'Propagate New Node';
    document.getElementById('editStatusBar').style.display = 'none';

    document.getElementById('pasteTitle').value = '';
    document.getElementById('pasteContent').value = '';
    document.getElementById('pastePassword').value = '';
    document.getElementById('pasteEmbed').value = '';

    const btn = document.getElementById('createPasteBtn');
    btn.textContent = 'Initiate Propagation';
    btn.classList.remove('updating');
}

document.getElementById('createPasteBtn').onclick = async () => {
    const title = document.getElementById('pasteTitle').value.trim();
    const content = document.getElementById('pasteContent').value.trim();
    const language = document.getElementById('pasteLanguage').value;
    const isPublic = document.getElementById('isPublic').checked;
    const burnAfterRead = document.getElementById('burnAfterRead').checked;
    const folderId = document.getElementById('pasteFolder').value;
    const password = document.getElementById('pastePassword').value;
    const embedUrl = document.getElementById('pasteEmbed').value;
    const exp = document.getElementById('pasteExpiration').value;

    if (!content) return showToast('DATA BUFFER EMPTY. PROPAGATION ABORTED.', 'error');

    const config = {
        title: title || 'Untitled',
        language,
        isPublic: isPublic ? 1 : 0,
        burnAfterRead: burnAfterRead ? 1 : 0,
        folderId,
        password: password || null,
        embedUrl: embedUrl || null,
        expiresAt: calculateExpiration(exp)
    };

    try {
        if (activeEditId) {
            await api.updatePaste(activeEditId, content, config);
            showToast('Node Updated Successfully', 'success');
        } else {
            const id = await api.createPaste(content, config);
            showToast(`Node ${id} Propagated to System`, 'success');
        }
        clearEditor();
        switchTab('repository');
    } catch (e) {
        showToast(e.message, 'error');
    }
};

function calculateExpiration(val) {
    if (val === 'never') return null;
    const now = new Date();
    const map = { '1h': 3600000, '1d': 86400000, '1w': 604800000 };
    return new Date(now.getTime() + (map[val] || 0)).toISOString();
}

// --- ANALYTICS TAB: GLOBAL ---
// --- ANALYTICS TAB: GLOBAL ---
function updateGlobalAnalyticsUI(data) {
    document.getElementById('totalHits').textContent = data.totalVisits || 0;
    document.getElementById('uniqueReaders').textContent = data.uniqueVisitors || 0;
    document.getElementById('geoReach').textContent = data.uniqueLocations || 0;

    const body = document.getElementById('trafficLogBody');
    const activity = [...(data.recentViews || []), ...(data.pageAccesses?.recent || [])]
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 50);

    body.innerHTML = activity.map(h => {
        const isPaste = !!h.pasteId;
        const path = h.pasteId ? `<span class="path-badge paste">/v/${h.pasteId}</span>` : `<span class="path-badge system">${h.path || '/'}</span>`;
        const country = h.countryCode ? `<span class="flag-icon">${h.countryCode}</span> ` : '';

        return `
        <tr>
            <td class="mono-text" style="color:var(--text-secondary);">${timeAgo(h.timestamp)}</td>
            <td>${path}</td>
            <td>
                <div style="font-weight:600; color:#fff;">${country}${h.city || 'Unknown'}</div>
                <div style="font-size:9px; opacity:0.5; margin-top:2px;">${h.hostname || h.isp || '??'}</div>
                <div style="display:flex; gap:3px; margin-top:4px;">
                    ${h.proxy ? '<span class="intel-tag tag-proxy">VPN</span>' : ''}
                    ${h.hosting ? '<span class="intel-tag tag-hosting">HOST</span>' : ''}
                    ${h.mobile ? '<span class="intel-tag tag-mobile">MOB</span>' : ''}
                </div>
            </td>
            <td class="mono-text" style="color:var(--accent-blue);">${h.ip}</td>
            <td>
                <button class="btn-icon-micro" title="Purge IP" onclick="purgeHit('${h.ip}')">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
            </td>
        </tr>
    `}).join('');

    // Update global lists reference
    globalBrowsers = data.browsers || [];
    globalISPs = data.isps || [];
}

function populateIntelList(id, items) {
    const container = document.getElementById(id);
    if (!container) return;

    // Calculate max for bar scaling
    const max = items.length ? Math.max(...items.map(i => i.count)) : 0;
    const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#ef4444'];

    container.innerHTML = items.slice(0, 20).map((i, index) => {
        const pct = max ? Math.max(5, (i.count / max) * 100) : 0;
        const color = colors[index % colors.length];

        return `
        <div class="intel-item-v4">
            <div class="intel-progress-bg" style="width:${pct}%; background:${color}; opacity:0.15;"></div>
            <div class="intel-content">
                <span class="label">${i.name.toUpperCase()}</span>
                <span class="val" style="color:${color};">${i.count}</span>
            </div>
        </div>
    `}).join('');
}

function renderAccessKeys(keys) {
    const container = document.getElementById('accessKeyList');
    if (!container) return;
    container.innerHTML = keys.map(k => `
        <div class="intel-item-v4">
            <div class="intel-content">
                <span class="key-mono main-key">${k.key}</span>
                <button class="btn-danger-slim-micro" onclick="revokeKey('${k.id}')">REVOKE</button>
            </div>
        </div>
    `).join('');
}


// --- MAP ---
function initMainMap() {
    if (mainMap) return;
    mainMap = L.map('mainHeatmap', {
        center: [20, 0],
        zoom: 2,
        zoomControl: false,
        attributionControl: false
    });
    // High Contrast Dark Theme
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        opacity: 0.95
    }).addTo(mainMap);
    if (globalAnalytics) updateMainMap(globalAnalytics.locations || []);
}

function updateMainMap(locations) {
    if (!mainMap) return;
    mainMapMarkers.forEach(m => m.remove());
    mainMapMarkers = [];
    locations.forEach(loc => {
        const lat = parseFloat(loc.lat);
        const lon = parseFloat(loc.lon);
        if (!isNaN(lat) && !isNaN(lon)) {
            // Enhanced Marker for easy hover
            const m = L.circleMarker([lat, lon], {
                radius: 12 + Math.log(loc.count) * 6, // Larger radius as requested
                fillColor: '#00f5ff',
                color: '#fff',
                weight: 1,
                opacity: 0.8,
                fillOpacity: 0.4
            }).addTo(mainMap);

            m.bindTooltip(`
                <div style="font-family:var(--font-main); padding:4px; line-height:1.2; text-align:center;">
                    <strong style="color:#00f5ff; font-size:14px">${loc.city}, ${loc.country}</strong><br>
                    <span style="font-size:11px; color:#fff;">${loc.count} Hits</span>
                </div>
            `, {
                sticky: true,
                direction: 'auto',
                opacity: 1,
                className: 'custom-map-tooltip' // We'll assume styles exist or it uses defaults
            });

            mainMapMarkers.push(m);
        }
    });
}

// --- MODAL: ANALYTICS ---
async function openNodeAnalytics(id) {
    try {
        const stats = await api.getAnalytics(id);
        const p = await api.getPaste(id, false);

        document.getElementById('pModalTitle').textContent = p.title || 'Untitled';
        document.getElementById('pModalId').textContent = id;
        document.getElementById('pModalUrl').value = `https://${window.location.host}/v/${id}`;

        document.getElementById('pTotalViews').textContent = stats.totalViews;
        document.getElementById('pUniqueIPs').textContent = stats.uniqueIPs;
        document.getElementById('pCountryCount').textContent = (stats.topLocations || []).length;

        const renderList = (id, items) => {
            document.getElementById(id).innerHTML = items.slice(0, 5).map(i => `
                <div class="data-item">
                    <span>${i.name}</span>
                    <span class="count">${i.count}</span>
                </div>
            `).join('') || '<div style="opacity:0.2">No telemetry</div>';
        };
        renderList('pTopLocations', stats.topLocations || []);
        renderList('pTopISPs', stats.topISPs || []);

        document.getElementById('pLogBody').innerHTML = (stats.recentViews || []).map(v => `
            <tr>
                <td>${timeAgo(v.timestamp)}</td>
                <td style="font-family:var(--font-mono); font-size:11px">${v.ip}</td>
                <td>
                    <div style="font-weight:700">${v.city || '??'}, ${v.countryCode || '??'}</div>
                    <div style="font-size:10px; opacity:0.6">${v.district || ''} ${v.timezone || ''}</div>
                </td>
                <td>
                    <div style="font-size:11px; display:flex; flex-direction:column; gap:2px">
                        <span>🏢 ${v.isp?.substring(0, 20)}</span>
                        <div style="display:flex; gap:4px">
                            ${v.proxy ? '<span class="intel-tag tag-proxy">PROXY</span>' : ''}
                            ${v.hosting ? '<span class="intel-tag tag-hosting">HOST</span>' : ''}
                            ${v.mobile ? '<span class="intel-tag tag-mobile">MOB</span>' : ''}
                        </div>
                        <span style="font-size:9px; opacity:0.4">AS: ${v.asName || '---'} | Currency: ${v.currency || '---'}</span>
                    </div>
                </td>
            </tr>
        `).join('');

        document.getElementById('pHearts').textContent = p.reactions?.heart || 0;
        document.getElementById('pStars').textContent = p.reactions?.star || 0;
        document.getElementById('pLikes').textContent = p.reactions?.like || 0;

        // Reaction Logs
        const rLog = document.getElementById('pReactionsLog');
        if (rLog) {
            rLog.innerHTML = (stats.reactions || []).map(r => `
                <tr>
                    <td>
                        <div style="font-weight:700; color:#fff;">${r.username}</div>
                        <div style="font-size:9px; opacity:0.5;">ID: ${r.userId || 'Guest'}</div>
                    </td>
                    <td><span class="path-badge paste">${r.type.toUpperCase()}</span></td>
                    <td>${r.city || '??'}, ${r.country || '??'}</td>
                    <td>${timeAgo(r.timestamp)}</td>
                    <td>---</td>
                </tr>
            `).join('') || '<tr><td colspan="5" style="text-align:center; opacity:0.2; padding:20px;">No reactions recorded yet.</td></tr>';
        }

        document.getElementById('analyticsModal').classList.add('active');
    } catch (e) { showToast(e.message, 'error'); }
}

let editMetricsId = null;
window.openNodeEdits = function (id) {
    editMetricsId = id;
    fetch(`/api/pastes/${id}`).then(r => r.json()).then(p => {
        document.getElementById('adjViews').value = p.views || 0;
        document.getElementById('adjHearts').value = p.reactions?.heart || 0;
        document.getElementById('adjStars').value = p.reactions?.star || 0;
        document.getElementById('adjLikes').value = p.reactions?.like || 0;
        document.getElementById('adjustStatsModal').classList.add('active');
    }).catch(err => showToast("Failed to fetch node data", "error"));
}

document.getElementById('saveStatsBtn').onclick = async () => {
    if (!editMetricsId) return;
    const payload = {
        views: parseInt(document.getElementById('adjViews').value) || 0,
        reactions: {
            heart: parseInt(document.getElementById('adjHearts').value) || 0,
            star: parseInt(document.getElementById('adjStars').value) || 0,
            like: parseInt(document.getElementById('adjLikes').value) || 0
        }
    };

    try {
        const res = await fetch(`/api/pastes/${editMetricsId}/metrics`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error(`Override failed: ${res.status}`);

        showToast('System Stats Overridden Successfully', 'success');
        closeModal('adjustStatsModal');
        await refreshData();
        if (currentTab === 'repository') await populateActiveNodes();
    } catch (e) {
        console.error(e);
        showToast(e.message, 'error');
    }
};

// UTILS
function timeAgo(date) {
    if (!date) return '---';
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return Math.floor(seconds / 60) + "m";
    if (seconds < 86400) return Math.floor(seconds / 3600) + "h";
    return Math.floor(seconds / 86400) + "d";
}

function showToast(msg, type = 'info') {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.style.cssText = 'position:fixed; bottom:30px; right:30px; z-index:10000; display:flex; flex-direction:column; gap:10px;';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const colors = {
        success: '#10b981',
        error: '#ef4444',
        info: '#3b82f6',
        warning: '#f59e0b'
    };

    toast.style.cssText = `
        background: rgba(15, 15, 20, 0.95);
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        border-left: 4px solid ${colors[type] || colors.info};
        box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        font-weight: 700;
        font-size: 0.9rem;
        backdrop-filter: blur(10px);
        animation: toastIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        min-width: 300px;
    `;

    toast.innerHTML = msg;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        toast.style.transition = '0.4s';
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

// Add toast animation
const style = document.createElement('style');
style.textContent = `
    @keyframes toastIn {
        from { opacity: 0; transform: translateY(20px) scale(0.9); }
        to { opacity: 1; transform: translateY(0) scale(1); }
    }
`;
document.head.appendChild(style);

window.closeModal = (id) => document.getElementById(id).classList.remove('active');

async function deletePaste(id) {
    if (!confirm(`CONFIRM NODE DESTRUCTION: ${id}`)) return;
    await api.deletePaste(id);
    await refreshData();
}

function copyPasteLink(id) {
    const url = `https://${window.location.host}/v/${id}`;
    navigator.clipboard.writeText(url);
}

document.getElementById('logoutBtn').onclick = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
};

// --- SECURITY HANDLERS ---
window.revokeKey = async (id) => {
    if (!confirm('Revoke this access key? Applications using it will fail.')) return;
    try {
        await api.revokeAccessKey(id);
        await refreshData();
        showToast('Access Key Revoked', 'success');
    } catch (e) { showToast(e.message, 'error'); }
};

window.wipeAllLogs = async () => {
    if (!confirm('FLUSH ALL TRAFFIC LOGS?')) return;
    showToast('Logs flushed locally (Server sync pending)', 'success');
    document.getElementById('trafficLogBody').innerHTML = '';
};

window.purgeHit = async (ip) => {
    showToast(`IP ${ip} traffic purged from view`, 'success');
};
