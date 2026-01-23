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

    if (tab === 'repository') populateActiveNodes();
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
            (p.content && p.content.toLowerCase().includes(search))
        );

        if (filtered.length === 0) {
            container.innerHTML = '<tr><td colspan="6" class="empty-state" style="text-align:center; padding:30px;">No nodes found matching criteria.</td></tr>';
            return;
        }

        container.innerHTML = filtered.map(p => `
            <tr>
                <td style="font-family:var(--font-mono); color:var(--text-secondary); font-size: 0.8rem;">
                    ${p.id}
                </td>
                <td>
                    <div style="font-weight:700; color:white;">${p.title || 'Untitled'}</div>
                    <div style="font-size:10px; opacity:0.6; text-transform:uppercase;">${p.language}</div>
                </td>
                <td style="font-size:0.8rem; opacity:0.8;">
                    ${p.createdAt ? new Date(p.createdAt).toLocaleDateString() : 'Unknown'}
                </td>
                <td>
                    <div style="font-weight:700; color:var(--accent-blue);">${p.views}</div>
                    <div style="font-size:10px; opacity:0.6;">Reads</div>
                </td>
                <td>
                    <div style="display:flex; gap:10px; font-size:0.85rem;">
                        <span style="color:#ef4444;" title="Hearts">♥ ${p.reactions?.heart || 0}</span>
                        <span style="color:#eab308;" title="Stars">★ ${p.reactions?.star || 0}</span>
                        <span style="color:#3b82f6;" title="Likes">👍 ${p.reactions?.like || 0}</span>
                    </div>
                </td>
                <td>
                    <div style="display:flex; gap:6px;">
                        <button class="btn-action" title="Copy Link" onclick="copyPasteLink('${p.id}')">🔗</button>
                        <button class="btn-action" title="Analysis" onclick="openNodeAnalytics('${p.id}')">📊</button>
                        <button class="btn-action" title="Metrics" onclick="openNodeEdits('${p.id}')">⚙️</button>
                        <button class="btn-action" title="Edit" onclick="editPaste('${p.id}')">✏️</button>
                        <button class="btn-action delete" title="Destroy" onclick="deletePaste('${p.id}')">🗑️</button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        container.innerHTML = `<tr><td colspan="6" class="error-state">Failed to sync: ${e.message}</td></tr>`;
    }
}

document.getElementById('repoSearch').oninput = populateActiveNodes;

// --- CREATOR: EDITING ---
async function editPaste(id) {
    try {
        const p = await api.getPaste(id, false);
        if (!p) return;

        activeEditId = id;
        document.getElementById('editorTitle').textContent = `RE-PROPAGATING NODE: ${id}`;
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

    } catch (e) {
        showToast(e.message, 'error');
    }
}

function clearEditor() {
    activeEditId = null;
    document.getElementById('editorTitle').textContent = 'Propagate New Node';
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
        await fetch(`/api/pastes/${editMetricsId}/metrics`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        showToast('System Stats Overridden', 'success');
        closeModal('adjustStatsModal');
        await refreshData();
    } catch (e) { showToast(e.message, 'error'); }
};

// UTILS
function timeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return Math.floor(seconds / 60) + "m";
    if (seconds < 86400) return Math.floor(seconds / 3600) + "h";
    return Math.floor(seconds / 86400) + "d";
}

function showToast(msg, type = 'info') {
    console.log(`[${type}] ${msg}`);
}

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
