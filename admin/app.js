// VEROE High-Efficiency Admin Console V5
const api = new PasteStorage();

// State Management
let mainMap = null;
let mainMapMarkers = [];
let globalAnalytics = null;
let trafficChart = null;
let currentTab = 'creator';
let activeEditId = null;

// Initialization
window.addEventListener('DOMContentLoaded', async () => {
    initChart();
    populateConfig();

    // Initial data load
    await refreshData();

    // Switch to initial tab
    switchTab('creator');

    // Interval Updates
    setInterval(async () => {
        await refreshData();
    }, 15000);
});

async function refreshData() {
    try {
        const stats = await api.getGlobalAnalytics();
        globalAnalytics = stats;

        updateGlobalUI(stats);
        if (currentTab === 'repository') await populateActiveNodes();
        if (currentTab === 'analytics') {
            updateGlobalAnalyticsUI(stats);
            if (!mainMap) setTimeout(initMainMap, 500);
            else updateMainMap(stats.locations || []);
        }
        if (currentTab === 'security') await populateSecurityTab();

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

// --- REPOSITORY: PASTE LIST ---
async function populateActiveNodes() {
    const container = document.getElementById('pasteListContainer');
    if (!container) return;

    try {
        const pastes = await api.getAllPastes();
        const search = document.getElementById('repoSearch').value.toLowerCase();

        const filtered = pastes.filter(p =>
            p.title.toLowerCase().includes(search) ||
            p.id.toLowerCase().includes(search) ||
            (p.content && p.content.toLowerCase().includes(search))
        );

        if (filtered.length === 0) {
            container.innerHTML = '<div class="empty-state">No nodes found in repository.</div>';
            return;
        }

        container.innerHTML = filtered.map(p => `
            <div class="paste-item-v4">
                <div class="p-item-header">
                    <div class="p-item-title-group">
                        <h3>${p.title || 'Untitled'}</h3>
                        <span class="p-item-id">${p.id}</span>
                    </div>
                    <div class="p-item-badge ${p.isPublic ? 'public' : 'private'}">
                        ${p.isPublic ? '🌍 PUBLIC' : '🔒 PRIVATE'}
                    </div>
                </div>
                
                <div class="p-item-stats">
                    <div class="p-stat-badge lang">${p.language}</div>
                    <div class="p-stat-badge">👁️ ${p.views} PR</div>
                    <div class="p-stat-badge">❤️ ${p.reactions?.heart || 0}</div>
                    <div class="p-stat-badge">⭐ ${p.reactions?.star || 0}</div>
                </div>

                <div class="p-item-actions">
                    <button class="btn-action" onclick="copyPasteLink('${p.id}')">🔗 Link</button>
                    <button class="btn-action" onclick="openNodeEdits('${p.id}')">⚙️ Stats</button>
                    <button class="btn-action" onclick="openNodeAnalytics('${p.id}')">📊 Intel</button>
                    <button class="btn-action" onclick="editPaste('${p.id}')">✏️ Edit</button>
                    <button class="btn-action delete" onclick="deletePaste('${p.id}')">🗑️ Drops</button>
                </div>
            </div>
        `).join('');
    } catch (e) {
        container.innerHTML = `<div class="error-state">Failed to sync: ${e.message}</div>`;
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
function updateGlobalAnalyticsUI(data) {
    document.getElementById('totalHits').textContent = data.totalVisits || 0;
    document.getElementById('uniqueReaders').textContent = data.uniqueVisitors || 0;
    document.getElementById('geoReach').textContent = data.uniqueLocations || 0;

    fetch('/api/pastes/stats/summary').then(r => r.json()).then(d => {
        document.getElementById('totalPastes').textContent = d.totalPastes || 0;
    });

    const body = document.getElementById('trafficLogBody');
    const activity = [...(data.recentViews || []), ...(data.pageAccesses?.recent || [])]
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 100);

    body.innerHTML = activity.map(h => `
        <tr>
            <td style="color:var(--text-secondary); font-size:11px">${timeAgo(h.timestamp)}</td>
            <td style="color:var(--accent-purple); font-weight:700">${h.pasteId ? '/v/' + h.pasteId : h.path}</td>
            <td>${h.city || 'Private'}, ${h.countryCode || '??'}</td>
            <td>
                <div style="display:flex; flex-direction:column; gap:4px">
                    <span style="font-size:11px; opacity:0.6">${(h.isp || 'Reserved').substring(0, 30)}</span>
                    <div style="display:flex; gap:4px">
                        ${h.proxy ? '<span class="intel-tag tag-proxy">PROXY/VPN</span>' : ''}
                        ${h.hosting ? '<span class="intel-tag tag-hosting">HOSTING</span>' : ''}
                        ${h.mobile ? '<span class="intel-tag tag-mobile">MOBILE</span>' : ''}
                    </div>
                </div>
            </td>
            <td style="font-family:var(--font-mono); font-size:11px">${h.ip}</td>
            <td>
                <button class="btn-danger-slim" onclick="purgeHit('${h.ip}')">Purge</button>
            </td>
        </tr>
    `).join('');

    populateIntelList('browserList', data.browsers || []);
    populateIntelList('connectionList', (data.isps || []).slice(0, 5));
}

function populateIntelList(id, items) {
    const container = document.getElementById(id);
    if (!container) return;
    container.innerHTML = items.map(i => `
        <div class="intel-item-v4">
            <span class="label">${i.name.toUpperCase()}</span>
            <span class="val">${i.count}</span>
        </div>
    `).join('');
}

function initChart() {
    const ctx = document.getElementById('trafficChart');
    if (!ctx) return;
    trafficChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array(12).fill(''),
            datasets: [{
                data: Array(12).fill(0),
                borderColor: '#3b82f6',
                borderWidth: 3,
                tension: 0.4,
                pointRadius: 0,
                fill: true,
                backgroundColor: 'rgba(59, 130, 246, 0.05)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { display: false }, y: { display: false } }
        }
    });
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
            const m = L.circleMarker([lat, lon], {
                radius: 6 + Math.log(loc.count) * 8,
                fillColor: '#00f5ff',
                color: '#fff',
                weight: 1.5,
                opacity: 0.9,
                fillOpacity: 0.5
            }).addTo(mainMap);

            // TOOLTIP: City, Region, Density
            m.bindTooltip(`
                <div style="font-family:var(--font-main); padding:6px; line-height:1.2">
                    <strong style="color:#00f5ff; font-size:12px">${loc.city}, ${loc.country}</strong><br>
                    <span style="font-size:10px; opacity:0.8">Activity Density: ${loc.count} Reads</span>
                </div>
            `, { sticky: true, opacity: 0.95, direction: 'top' });

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
function openNodeEdits(id) {
    editMetricsId = id;
    fetch(`/api/pastes/${id}`).then(r => r.json()).then(p => {
        document.getElementById('adjViews').value = p.views || 0;
        document.getElementById('adjHearts').value = p.reactions?.heart || 0;
        document.getElementById('adjStars').value = p.reactions?.star || 0;
        document.getElementById('adjLikes').value = p.reactions?.like || 0;
        document.getElementById('adjustStatsModal').classList.add('active');
    });
}

document.getElementById('saveStatsBtn').onclick = async () => {
    if (!editMetricsId) return;
    try {
        await fetch(`/api/pastes/${editMetricsId}/views`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ views: parseInt(document.getElementById('adjViews').value) })
        });
        showToast('System Stats Overridden', 'success');
        closeModal('adjustStatsModal');
        await refreshData();
    } catch (e) { showToast(e.message, 'error'); }
};

// --- SECURITY ---
async function populateSecurityTab() {
    const keys = await api.getAllAccessKeys();
    document.getElementById('accessKeyList').innerHTML = keys.map(k => `
        <div class="intel-item-v4">
            <span>${k.key}</span>
            <button class="btn-danger-slim" onclick="revokeKey('${k.id}')">Revoke</button>
        </div>
    `).join('');
}

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
