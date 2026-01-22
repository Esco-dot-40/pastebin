// VEROE High-Efficiency Admin Console
const api = new PasteStorage();

// State Management
let mainMap = null;
let mainMapMarkers = [];
let globalAnalytics = null;
let trafficChart = null;
let currentTab = 'dashboard';
let activeEditId = null;

// Initialization
window.addEventListener('DOMContentLoaded', async () => {
    initChart();
    populateConfig();

    // Initial data load
    await refreshData();

    // Switch to dashboard by default
    switchTab('dashboard');

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
        if (currentTab === 'dashboard') await populateActiveNodes();
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

    if (tab === 'dashboard') populateActiveNodes();
    if (tab === 'analytics') refreshData();
}

document.querySelectorAll('.nav-link').forEach(link => {
    link.onclick = (e) => {
        e.preventDefault();
        switchTab(link.dataset.tab);
    }
});

// --- DASHBOARD: PASTE LIST ---
async function populateActiveNodes() {
    const container = document.getElementById('pasteListContainer');
    if (!container) return;

    try {
        const pastes = await api.getAllPastes();
        if (pastes.length === 0) {
            container.innerHTML = '<div class="empty-state">No nodes propagated in the repository.</div>';
            return;
        }

        container.innerHTML = pastes.map(p => `
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
                    <div class="p-stat-badge">👁️ ${p.views}</div>
                    <div class="p-stat-badge">❤️ ${p.reactions?.heart || 0}</div>
                    <div class="p-stat-badge">⭐ ${p.reactions?.star || 0}</div>
                    <div class="p-stat-badge">👍 ${p.reactions?.like || 0}</div>
                </div>

                <div class="p-meta-info">
                    <span>🗓️ ${timeAgo(p.createdAt)}</span>
                    <span>📁 ${p.folderName || 'Root'}</span>
                    ${p.burnAfterRead ? '<span>🔥 Burn on Read</span>' : ''}
                </div>

                <div class="p-item-actions">
                    <button class="btn-action copy" onclick="copyPasteLink('${p.id}')">🔗 Copy Link</button>
                    <button class="btn-action" onclick="openNodeEdits('${p.id}')">⚙️ Metrics</button>
                    <button class="btn-action" onclick="openNodeAnalytics('${p.id}')">📊 Analytics</button>
                    <button class="btn-action" onclick="editPaste('${p.id}')">✏️ Edit</button>
                    <button class="btn-action delete" onclick="deletePaste('${p.id}')">🗑️ Delete</button>
                </div>
            </div>
        `).join('');
    } catch (e) {
        container.innerHTML = `<div class="error-state">Failed to sync repository: ${e.message}</div>`;
    }
}

// --- CREATION / EDITING ---
async function editPaste(id) {
    try {
        const p = await api.getPaste(id, false);
        if (!p) return;

        activeEditId = id;
        document.getElementById('editorTitle').textContent = `Editing Paste: ${id}`;
        document.getElementById('pasteTitle').value = p.title || '';
        document.getElementById('pasteLanguage').value = p.language || 'plaintext';
        document.getElementById('pasteContent').value = p.content || '';
        document.getElementById('pasteFolder').value = p.folderId || '';
        document.getElementById('isPublic').checked = p.isPublic === 1;
        document.getElementById('burnAfterRead').checked = p.burnAfterRead === 1;
        document.getElementById('pasteEmbed').value = p.embedUrl || '';

        const btn = document.getElementById('createPasteBtn');
        btn.textContent = 'Update Paste';
        btn.classList.add('updating');

        // Scroll to top of editor if needed
        document.querySelector('.editor-section').scrollIntoView({ behavior: 'smooth' });

    } catch (e) {
        showToast(e.message, 'error');
    }
}

function clearEditor() {
    activeEditId = null;
    document.getElementById('editorTitle').textContent = 'Create New Paste';
    document.getElementById('pasteTitle').value = '';
    document.getElementById('pasteContent').value = '';
    document.getElementById('pastePassword').value = '';
    document.getElementById('pasteEmbed').value = '';
    const btn = document.getElementById('createPasteBtn');
    btn.textContent = 'Create Paste';
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

    if (!content) return showToast('Payload container cannot be empty', 'error');

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
            showToast('Paste Updated Successfully', 'success');
        } else {
            const id = await api.createPaste(content, config);
            showToast(`New Paste Propagated: ${id}`, 'success');
        }
        clearEditor();
        await populateActiveNodes();
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

    // Total Pastes fetch
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
            <td style="font-size:11px; opacity:0.6">${(h.isp || 'Reserved').substring(0, 25)}</td>
            <td style="font-family:var(--font-mono); font-size:11px">${h.ip}</td>
            <td>
                <button class="btn-danger-slim" onclick="purgeHit('${h.ip}')">Purge</button>
            </td>
        </tr>
    `).join('');

    populateIntelList('browserList', data.browsers || []);
    updateTrafficChart(data);
}

function populateIntelList(id, items) {
    const container = document.getElementById(id);
    if (!container) return;
    container.innerHTML = items.slice(0, 10).map(i => `
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

function updateTrafficChart(data) {
    if (!trafficChart) return;
    const counts = (data.isps || []).map(i => i.count).slice(0, 12);
    if (counts.length > 0) {
        trafficChart.data.datasets[0].data = counts;
        trafficChart.update();
    }
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
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(mainMap);
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
                radius: 4 + Math.log(loc.count) * 4,
                fillColor: '#3b82f6',
                color: '#3b82f6',
                weight: 1,
                opacity: 0.8,
                fillOpacity: 0.3
            }).addTo(mainMap);
            mainMapMarkers.push(m);
        }
    });
}

// --- MODAL: PASTE ANALYTICS ---
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

        // Populate Data Lists
        const renderList = (id, items) => {
            document.getElementById(id).innerHTML = items.slice(0, 5).map(i => `
                <div class="data-item">
                    <span>${i.name}</span>
                    <span class="count">${i.count}</span>
                </div>
            `).join('') || '<div style="opacity:0.2">No telemetry available</div>';
        };
        renderList('pTopLocations', stats.topLocations || []);
        renderList('pTopISPs', stats.topISPs || []);

        // Log Body
        document.getElementById('pLogBody').innerHTML = (stats.recentViews || []).map(v => `
            <tr>
                <td>${new Date(v.timestamp).toLocaleString()}</td>
                <td>${v.ip}</td>
                <td>${v.city || '??'}, ${v.countryCode || '??'}</td>
                <td>${v.userAgent?.split(' ')[0] || 'Unknown'} / ${v.isp?.substring(0, 15) || '---'}</td>
            </tr>
        `).join('') || '<tr><td colspan="4" style="text-align:center; opacity:0.2">No activity logged</td></tr>';

        // Reactions
        document.getElementById('pHearts').textContent = p.reactions?.heart || 0;
        document.getElementById('pStars').textContent = p.reactions?.star || 0;
        document.getElementById('pLikes').textContent = p.reactions?.like || 0;

        // Render Reactions Log
        const reactBody = document.getElementById('pReactionsLog');
        if (reactBody) {
            const reactions = (stats.reactions || []).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            reactBody.innerHTML = reactions.map(r => `
                <tr>
                    <td style="color:var(--accent-blue)">${r.username || r.ip.substring(0, 8)}</td>
                    <td style="font-weight:800">${r.type.toUpperCase()}</td>
                    <td style="opacity:0.6; font-size:11px">${r.city || '??'}, ${r.countryCode || '??'}</td>
                    <td style="opacity:0.6; font-size:11px">${timeAgo(r.timestamp)}</td>
                    <td><button class="btn-danger-slim" onclick="removeSpecificReaction('${id}', '${r.id}')">Drop</button></td>
                </tr>
             `).join('') || '<tr><td colspan="5" style="text-align:center; opacity:0.2">No reactions logged</td></tr>';
        }

        document.getElementById('analyticsModal').classList.add('active');

        // Setup Purge Button
        document.getElementById('pClearLogsBtn').onclick = async () => {
            if (!confirm(`ERASE ALL TELEMETRY FOR ${id}?`)) return;
            await fetch(`/api/pastes/${id}/analytics`, { method: 'DELETE' });
            showToast('Logs Wiped', 'success');
            openNodeAnalytics(id);
            await populateActiveNodes();
        };

        document.getElementById('pResetViewsBtn').onclick = async () => {
            if (!confirm(`RESET VIEW COUNTER FOR ${id}?`)) return;
            await fetch(`/api/pastes/${id}/reset-views`, { method: 'POST' });
            showToast('Counter Reset', 'success');
            openNodeAnalytics(id);
            await populateActiveNodes();
        };

    } catch (e) {
        showToast(e.message, 'error');
    }
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
    const id = editMetricsId;
    try {
        await fetch(`/api/pastes/${id}/views`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ views: parseInt(document.getElementById('adjViews').value) })
        });
        const reactions = ['heart', 'star', 'like'];
        for (const type of reactions) {
            await fetch(`/api/pastes/${id}/reactions/${type}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ count: parseInt(document.getElementById(`adj${type.charAt(0).toUpperCase() + type.slice(1)}s`).value) })
            });
        }
        showToast('Metrics Overridden', 'success');
        closeModal('adjustStatsModal');
        await populateActiveNodes();
    } catch (e) { showToast(e.message, 'error'); }
};

// --- SECURITY & KEYS ---
async function populateSecurityTab() {
    const keys = await api.getAllAccessKeys();
    document.getElementById('accessKeyList').innerHTML = keys.map(k => `
        <div class="intel-item-v4">
            <div style="display:flex; flex-direction:column">
                <span style="font-weight:800; color:white">${k.key}</span>
                <span style="font-size:10px; color:var(--text-secondary)">${k.userEmail || 'UNCLAIMED'}</span>
            </div>
            <div style="display:flex; gap:15px; align-items:center">
                <span style="font-size:10px; font-weight:900; color:${k.status === 'active' ? 'var(--accent-green)' : 'var(--accent-red)'}">[${k.status.toUpperCase()}]</span>
                <button class="btn-danger-slim" onclick="revokeKey('${k.id}')">Revoke</button>
            </div>
        </div>
    `).join('') || '<div style="opacity:0.2">No keys found</div>';

    const users = await api.getAllUsers();
    document.getElementById('adminUsersList').innerHTML = users.map(u => `
        <div class="intel-item-v4">
            <span class="label">${u.username || u.email}</span>
            <span class="val" style="color:var(--accent-purple)">${u.isAdmin ? 'ADMIN' : 'OPERATOR'}</span>
        </div>
    `).join('');
}

document.getElementById('generateKeyBtn').onclick = async () => {
    try {
        const res = await api.generateAccessKey();
        prompt('NEW SECURITY ACCESS KEY GENERATED:', res.key);
        await populateSecurityTab();
    } catch (e) { showToast(e.message, 'error'); }
};

async function revokeKey(id) {
    if (!confirm('TERMINATE ACCESS PRIVILEGES?')) return;
    await api.revokeAccessKey(id);
    await populateSecurityTab();
}

// --- UTILS ---
function timeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + "m ago";
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + "h ago";
    return Math.floor(hours / 24) + "d ago";
}

function showToast(msg, type = 'info') {
    // Basic alert for now, can be upgraded to toast
    console.log(`[${type.toUpperCase()}] ${msg}`);
    if (type === 'error') alert(msg);
}

window.closeModal = (id) => document.getElementById(id).classList.remove('active');

async function deletePaste(id) {
    if (!confirm(`CONFIRM DESTRUCTION OF NODE ${id}?`)) return;
    await api.deletePaste(id);
    await populateActiveNodes();
}

async function removeSpecificReaction(pasteId, reactionId) {
    if (!confirm('RESCIND THIS REACTION?')) return;
    await fetch(`/api/pastes/${pasteId}/reactions/${reactionId}`, { method: 'DELETE' });
    showToast('Reaction Removed', 'success');
    openNodeAnalytics(pasteId);
}

function copyPasteLink(id) {
    const url = `https://${window.location.host}/v/${id}`;
    navigator.clipboard.writeText(url);
    showToast('Link copied to clipboard', 'success');
}

function copyModalUrl() {
    const url = document.getElementById('pModalUrl').value;
    navigator.clipboard.writeText(url);
    showToast('Link copied', 'success');
}

async function wipeAllLogs() {
    if (!confirm('PERMANENTLY ERASE THE ENTIRE TRAFFIC HISTORY? THIS CANNOT BE UNDONE.')) return;
    await fetch('/api/pastes/analytics/all', { method: 'DELETE' });
    showToast('Total History Erased', 'success');
    await refreshData();
}

async function purgeHit(ip) {
    // Current API doesn't have purge by IP, but we can add or use one of the existing ones
    // For now, let's just toast
    showToast(`Purging data for ${ip} is handled through granular city/ISP wiping.`, 'info');
}

document.getElementById('logoutBtn').onclick = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
};
