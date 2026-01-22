// Premium Admin Console Logic - veroe.space
const storage = new PasteStorage();

// State
let currentLocalPasteId = null;
let mainMap = null;
let mainMapMarkers = [];
let globalAnalyticsData = null;

// Languages
const LANGUAGES = [
    { id: 'plaintext', name: 'Plain Text' },
    { id: 'javascript', name: 'JavaScript' },
    { id: 'python', name: 'Python' },
    { id: 'java', name: 'Java' },
    { id: 'cpp', name: 'C++' },
    { id: 'csharp', name: 'C#' },
    { id: 'php', name: 'PHP' },
    { id: 'html', name: 'HTML' },
    { id: 'css', name: 'CSS' },
    { id: 'json', name: 'JSON' },
    { id: 'markdown', name: 'Markdown' },
    { id: 'bash', name: 'Bash' },
    { id: 'yaml', name: 'YAML' }
];

// Elements
const els = {
    title: document.getElementById('pasteTitle'),
    lang: document.getElementById('pasteLanguage'),
    exp: document.getElementById('pasteExpiration'),
    content: document.getElementById('pasteContent'),
    burn: document.getElementById('burnAfterRead'),
    public: document.getElementById('isPublic'),
    pass: document.getElementById('pastePassword'),
    folder: document.getElementById('pasteFolder'),
    embed: document.getElementById('embedUrl'),
    list: document.getElementById('pasteListContainer'),
    search: document.getElementById('pasteSearch'),
    activeVisitors: document.getElementById('activeVisitors'),
    totalHits: document.getElementById('totalHits'),
    uniqueReaders: document.getElementById('uniqueReaders'),
    geoReach: document.getElementById('geoReach'),
    // Modals
    successModal: document.getElementById('successModal'),
    folderModal: document.getElementById('folderModal'),
    accessModal: document.getElementById('accessModal'),
    usersModal: document.getElementById('usersModal'),
    analyticsModal: document.getElementById('analyticsModal')
};

// Initialize
window.addEventListener('DOMContentLoaded', async () => {
    populateLanguages();

    // Initial data load
    await Promise.all([
        loadPasteList(),
        loadFolderList(),
        loadGlobalAnalytics()
    ]);

    // Map needs a moment for container to have size
    setTimeout(initMainMap, 100);

    // Refresh cycles
    setInterval(loadGlobalAnalytics, 15000); // 15s refresh
});

function populateLanguages() {
    if (!els.lang) return;
    els.lang.innerHTML = LANGUAGES.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
}

async function loadGlobalAnalytics() {
    try {
        const data = await storage.getGlobalAnalytics();
        globalAnalyticsData = data;

        if (els.totalHits) els.totalHits.textContent = data.totalVisits || 0;
        if (els.uniqueReaders) els.uniqueReaders.textContent = data.uniqueVisitors || 0;
        if (els.geoReach) els.geoReach.textContent = data.uniqueLocations || 0;
        if (els.activeVisitors) els.activeVisitors.textContent = `${data.activeNow || 0} Active Visitors`;

        updateMainMap(data.locations || []);
        updateClusterSummary(data.locations || []);

        // Populate Intelligence Modules
        populateIntelList('browserList', data.browsers || []);
        populateIntelList('platformList', data.platforms || []);
        populateIntelList('ispList', data.isps || []);

        // Populate Live Traffic Log
        const recentActivity = [...(data.recentViews || []), ...(data.pageAccesses?.recent || [])]
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 50);
        populateTrafficLog(recentActivity);

        // Packet counter animation
        const packetEl = document.getElementById('packetCounter');
        if (packetEl) {
            packetEl.textContent = `SYNCING ${data.totalVisits % 50 + 10} PACKETS...`;
        }
    } catch (e) {
        console.error('Analytics load failed:', e);
    }
}

function initMainMap() {
    try {
        if (mainMap) return;
        const container = document.getElementById('mainHeatmap');
        if (!container) return;

        mainMap = L.map('mainHeatmap', {
            center: [20, 0],
            zoom: 2,
            zoomControl: true,
            attributionControl: false
        });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19
        }).addTo(mainMap);

        if (globalAnalyticsData) {
            updateMainMap(globalAnalyticsData.locations || []);
        }
    } catch (e) { console.error('Map Init Failed:', e); }
}

function updateMainMap(locations) {
    if (!mainMap) return;
    mainMapMarkers.forEach(m => m.remove());
    mainMapMarkers = [];

    locations.forEach(loc => {
        const lat = parseFloat(loc.lat);
        const lon = parseFloat(loc.lon);
        if (!isNaN(lat) && !isNaN(lon)) {
            const ring = L.circleMarker([lat, lon], {
                radius: 12 + Math.log(loc.count || 1) * 8,
                fillColor: '#7b42ff', color: '#7b42ff', weight: 2, opacity: 0.4, fillOpacity: 0.2
            }).addTo(mainMap);

            const dot = L.circleMarker([lat, lon], {
                radius: 3, fillColor: '#fff', color: '#fff', weight: 1, opacity: 1, fillOpacity: 1
            }).addTo(mainMap);

            const popup = `<div style="background:#0a0a0f; color:#fff; padding:10px; border-radius:8px; border:1px solid #7b42ff;">
                <strong style="color:#7b42ff; letter-spacing:1px;">NODE: ${loc.city.toUpperCase()}</strong><br>
                <span style="opacity:0.7; font-size:11px;">TRAFFIC IMPACT: ${loc.count}</span>
            </div>`;
            ring.bindPopup(popup);
            mainMapMarkers.push(ring, dot);
        }
    });

    if (mainMapMarkers.length > 0 && !mainMap._fitted) {
        const group = new L.featureGroup(mainMapMarkers);
        mainMap.fitBounds(group.getBounds().pad(0.1));
        mainMap._fitted = true;
    }
}

function updateClusterSummary(locations) {
    const clusterGrid = document.getElementById('clusterGrid');
    if (!clusterGrid) return;

    const clusters = {};
    locations.forEach(loc => {
        const key = loc.countryCode || 'UN';
        if (!clusters[key]) clusters[key] = { count: 0, label: loc.country || 'Unknown' };
        clusters[key].count += loc.count;
    });

    const topClusters = Object.entries(clusters).sort((a, b) => b[1].count - a[1].count).slice(0, 5);
    const maxCount = topClusters.length > 0 ? topClusters[0][1].count : 1;

    clusterGrid.innerHTML = topClusters.map(([code, data]) => `
        <div class="cluster-item">
            <div class="cluster-name"><span class="code">${code}</span><span class="label">${data.label.toUpperCase()} CLUSTER</span></div>
            <div class="cluster-impact"><span class="impact-val">${data.count}</span><span class="impact-label">IMPACT</span></div>
            <div class="cluster-bar"><div class="cluster-bar-fill" style="width: ${(data.count / maxCount) * 100}%"></div></div>
        </div>
    `).join('');
}

function populateIntelList(containerId, items) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const topItems = items.slice(0, 8);
    if (topItems.length === 0) {
        container.innerHTML = '<span style="font-size:0.7rem; color:rgba(255,255,255,0.2)">NO DATA COLLECTED</span>';
        return;
    }
    container.innerHTML = topItems.map(item => `<div class="intel-item"><span class="intel-name">${item.name.toUpperCase()}</span><span class="intel-val">${item.count}</span></div>`).join('');
}

function populateTrafficLog(activity) {
    const logBody = document.getElementById('trafficLogBody');
    if (!logBody) return;
    if (activity.length === 0) {
        logBody.innerHTML = '<tr><td colspan="6" style="text-align:center; opacity:0.3; padding:40px;">NO RECENT ACTIVITY DETECTED</td></tr>';
        return;
    }
    logBody.innerHTML = activity.map(item => `
        <tr>
            <td class="time">${timeAgo(item.timestamp)}</td>
            <td class="path">${item.pasteId ? '/v/' + item.pasteId : item.path}</td>
            <td class="location">${item.city || 'Unknown'}, ${item.countryCode || '??'}</td>
            <td>${(item.isp || 'Private Network').substring(0, 30)}</td>
            <td>${item.platform || 'System'}</td>
            <td class="ip">${item.ip || 'Masked'}</td>
        </tr>
    `).join('');
}

async function loadPasteList(query = '') {
    if (!els.list) return;
    try {
        const pastes = await storage.getAllPastes();
        const filtered = query ? pastes.filter(p => p.title.toLowerCase().includes(query.toLowerCase()) || p.id.includes(query)) : pastes;
        els.list.innerHTML = filtered.map(p => `
            <div class="paste-item" onclick="loadPasteForEdit('${p.id}')">
                <div class="paste-item-header"><span class="paste-item-title">${escapeHtml(p.title)}</span><span class="meta-pill">${p.id}</span></div>
                <div class="paste-item-meta">
                    <span class="meta-pill">👁️ ${p.views || 0}</span><span class="meta-pill">📝 ${p.language}</span><span class="meta-pill">📅 ${new Date(p.createdAt).toLocaleDateString()}</span>
                </div>
                <div class="paste-item-actions">
                    <button class="btn btn-glass" onclick="event.stopPropagation(); window.open('/v/${p.id}', '_blank')">View</button>
                    <button class="btn btn-glass" onclick="event.stopPropagation(); showAnalytics('${p.id}')">Stats</button>
                    <button class="btn btn-glass" style="color:#ff006e" onclick="event.stopPropagation(); deletePaste('${p.id}')">Del</button>
                </div>
            </div>
        `).join('');
    } catch (e) { console.error('List load failed:', e); }
}

async function createPaste() {
    const content = els.content.value.trim();
    if (!content) return alert('Enter content');

    const config = {
        title: els.title.value || 'Untitled',
        language: els.lang.value,
        isPublic: els.public.checked,
        burnAfterRead: els.burn.checked,
        expiresAt: calculateExpiration(els.exp.value),
        folderId: els.folder.value || null,
        password: els.pass.value || null,
        embedUrl: els.embed.value || null
    };

    try {
        let id;
        if (currentLocalPasteId) {
            await storage.updatePaste(currentLocalPasteId, content, config);
            id = currentLocalPasteId;
            alert('Payload Re-deployed Successfully');
        } else {
            id = await storage.createPaste(content, config);
            document.getElementById('pasteUrl').value = `${window.location.origin}/v/${id}`;
            els.successModal.classList.add('active');
        }
        loadPasteList();
    } catch (e) { alert(e.message); }
}

async function deletePaste(id) {
    if (!confirm('Permanently wipe this record from nodes?')) return;
    try {
        await storage.deletePaste(id);
        loadPasteList();
    } catch (e) { alert(e.message); }
}

async function showAnalytics(id) {
    try {
        const data = await storage.getAnalytics(id);
        const content = document.getElementById('analyticsContent');
        content.innerHTML = `
            <div class="matrix-header" style="margin-bottom:30px">
                <div class="matrix-title"><span class="matrix-label">NODE ANALYSIS: ${id}</span><span class="matrix-sub">CRITICAL METRIC OVERVIEW</span></div>
            </div>
            <div class="stat-group">
                <div class="stat-box"><span class="stat-label">Total Volume</span><span class="stat-value">${data.totalViews || 0}</span></div>
                <div class="stat-box"><span class="stat-label">Unique Nodes</span><span class="stat-value">${data.uniqueIPs || 0}</span></div>
            </div>
            <div class="detail-grid">
                <div class="detail-box"><h4>GEOGRAPHIC ORIGINS</h4><div class="intel-list detail-list">${(data.locations || []).slice(0, 5).map(l => `<div class="intel-item"><span class="intel-name">${l.name.toUpperCase()}</span><span class="intel-val">${l.count}</span></div>`).join('') || '<span style="opacity:0.3">No Logged Locations</span>'}</div></div>
                <div class="detail-box"><h4>NETWORK INFRASTRUCTURE</h4><div class="intel-list detail-list">${(data.isps || []).slice(0, 5).map(i => `<div class="intel-item"><span class="intel-name">${i.name.toUpperCase()}</span><span class="intel-val">${i.count}</span></div>`).join('') || '<span style="opacity:0.3">No Network Data</span>'}</div></div>
            </div>
            <div class="detail-box" style="margin-top:30px"><h4>RECENT ACCESS LOGS</h4><div class="detail-list" style="padding:0"><table class="log-table" style="font-size: 0.7rem"><thead><tr><th>TIME</th><th>LOCATION</th><th>IP</th></tr></thead><tbody>${(data.recentViews || []).slice(0, 10).map(v => `<tr><td>${timeAgo(v.timestamp)}</td><td class="location">${v.city || 'Unknown'}</td><td class="ip">${v.ip}</td></tr>`).join('')}</tbody></table></div></div>
        `;
        els.analyticsModal.classList.add('active');
    } catch (e) { alert('Failed to load detailed analytics'); }
}

async function loadFolderList() {
    try {
        const folders = await storage.getAllFolders();
        if (els.folder) {
            els.folder.innerHTML = '<option value="">Ungrouped</option>' + folders.map(f => `<option value="${f.id}">${escapeHtml(f.name)}</option>`).join('');
        }
        const folderListEl = document.getElementById('folderList');
        if (folderListEl) {
            folderListEl.innerHTML = folders.map(f => `
                <div class="intel-item">
                    <span class="intel-name">${escapeHtml(f.name.toUpperCase())}</span>
                    <button class="btn btn-glass" style="color:red; padding:2px 8px;" onclick="deleteFolder('${f.id}')">DEL</button>
                </div>
            `).join('');
        }
    } catch (e) { console.error('Folder load failed'); }
}

async function createFolder() {
    const name = document.getElementById('newFolderName').value.trim();
    if (!name) return;
    try {
        await storage.createFolder(name);
        document.getElementById('newFolderName').value = '';
        loadFolderList();
    } catch (e) { alert(e.message); }
}

window.deleteFolder = async (id) => {
    if (!confirm('Delete folder? Pastes will become Ungrouped.')) return;
    try {
        await storage.deleteFolder(id);
        loadFolderList();
    } catch (e) { alert(e.message); }
};

async function loadUsers() {
    try {
        const res = await fetch('/api/auth/users', { credentials: 'include' });
        const users = await res.json();
        const usersListBody = document.getElementById('usersList');
        if (usersListBody) {
            usersListBody.innerHTML = users.map(u => `
                <tr>
                    <td>
                        <div style="display:flex; align-items:center; gap:10px;">
                            <img src="${u.avatarUrl || ''}" style="width:30px; border-radius:50%;" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
                            <div>
                                <div style="font-weight:700;">${escapeHtml(u.username)}</div>
                                <div style="font-size:0.6rem; opacity:0.5;">ID: ${u.discordId}</div>
                            </div>
                        </div>
                    </td>
                    <td>${new Date(u.createdAt).toLocaleDateString()}</td>
                    <td>${timeAgo(u.lastLogin)}</td>
                    <td><button class="btn btn-glass" style="color:red;" onclick="deleteUser('${u.discordId}')">Revoke</button></td>
                </tr>
            `).join('');
        }
    } catch (e) { console.error('Users load failed'); }
}

window.deleteUser = async (discordId) => {
    if (!confirm('Revoke access for this operator?')) return;
    try {
        await fetch(`/api/auth/users/${discordId}`, { method: 'DELETE', credentials: 'include' });
        loadUsers();
    } catch (e) { alert('Failed to revoke access'); }
};

async function loadKeys() {
    try {
        const res = await fetch('/api/access/keys', { credentials: 'include' });
        const keys = await res.json();
        const keyList = document.getElementById('keyList');
        if (keyList) {
            keyList.innerHTML = keys.map(k => `
                <div class="intel-item">
                    <span class="intel-name" style="font-size:0.7rem;">${k.key.substring(0, 16)}...</span>
                    <button class="btn btn-glass" style="color:red; padding:2px 8px;" onclick="revokeKey('${k.id}')">REVOKE</button>
                </div>
            `).join('');
        }
    } catch (e) { }
}

async function revokeKey(id) {
    if (!confirm('Revoke access key?')) return;
    try {
        await fetch(`/api/access/keys/${id}`, { method: 'DELETE', credentials: 'include' });
        loadKeys();
    } catch (e) { alert('Failed'); }
}

async function generateKey() {
    try {
        const res = await fetch('/api/access/keys', { method: 'POST', credentials: 'include' });
        const data = await res.json();
        if (data.key) {
            document.getElementById('generatedKey').value = data.key;
            loadKeys();
        }
    } catch (e) { alert('Failed to generate'); }
}

function calculateExpiration(val) {
    if (val === 'never') return null;
    const now = new Date();
    const map = { '10m': 10 * 60000, '1h': 60 * 60000, '1d': 24 * 60 * 60000, '1w': 7 * 24 * 60 * 60000, '1M': 30 * 24 * 60 * 60000 };
    return new Date(now.getTime() + (map[val] || 0)).toISOString();
}

function timeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + "y";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + "mo";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "d";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "m";
    return Math.floor(seconds) + "s";
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

window.loadPasteForEdit = async (id) => {
    try {
        const pastes = await storage.getAllPastes();
        const p = pastes.find(x => x.id === id);
        if (p) {
            currentLocalPasteId = id;
            els.title.value = p.title;
            els.lang.value = p.language;
            els.content.value = p.content;
            els.public.checked = p.isPublic;
            els.burn.checked = p.burnAfterRead;
            els.pass.value = p.password || '';
            els.folder.value = p.folderId || '';
            els.embed.value = p.embedUrl || '';
            document.getElementById('clearBtn').textContent = 'Cancel Edit';
        }
    } catch (e) { }
};

// Bind Events
if (document.getElementById('createPasteBtn')) document.getElementById('createPasteBtn').onclick = createPaste;
if (document.getElementById('refreshBtn')) document.getElementById('refreshBtn').onclick = () => loadPasteList();
if (els.search) els.search.oninput = (e) => loadPasteList(e.target.value);
if (document.getElementById('clearBtn')) document.getElementById('clearBtn').onclick = () => {
    currentLocalPasteId = null;
    els.title.value = ''; els.content.value = ''; els.pass.value = ''; els.embed.value = ''; els.folder.value = '';
    document.getElementById('clearBtn').textContent = 'Clear';
};
if (document.getElementById('logoutBtn')) document.getElementById('logoutBtn').onclick = async () => {
    if (!confirm('Logout?')) return;
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/adminperm/login.html';
};
if (document.getElementById('accessBtn')) document.getElementById('accessBtn').onclick = () => { els.accessModal.classList.add('active'); loadKeys(); };
if (document.getElementById('usersBtn')) document.getElementById('usersBtn').onclick = () => { els.usersModal.classList.add('active'); loadUsers(); };
if (document.getElementById('manageFoldersBtn')) document.getElementById('manageFoldersBtn').onclick = () => { els.folderModal.classList.add('active'); loadFolderList(); };
if (document.getElementById('addFolderBtn')) document.getElementById('addFolderBtn').onclick = createFolder;
if (document.getElementById('generateKeyBtn')) document.getElementById('generateKeyBtn').onclick = generateKey;
if (document.getElementById('copyKeyBtn')) document.getElementById('copyKeyBtn').onclick = () => { navigator.clipboard.writeText(document.getElementById('generatedKey').value); alert('Key Copied'); };
if (document.getElementById('copyUrlBtn')) document.getElementById('copyUrlBtn').onclick = () => { navigator.clipboard.writeText(document.getElementById('pasteUrl').value); alert('URL Copied'); };

// Media Uploads
if (document.getElementById('uploadImageBtn')) document.getElementById('uploadImageBtn').onclick = () => document.getElementById('imageInput').click();
if (document.getElementById('uploadEmbedBtn')) document.getElementById('uploadEmbedBtn').onclick = () => document.getElementById('embedInput').click();

if (document.getElementById('imageInput')) document.getElementById('imageInput').onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
        const data = await storage.uploadImage(file);
        els.content.value += `\n![Image](${data.url})\n`;
    } catch (e) { alert('Upload failed'); }
};

if (document.getElementById('embedInput')) document.getElementById('embedInput').onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
        const data = await storage.uploadImage(file);
        els.embed.value = data.url;
    } catch (e) { alert('Upload failed'); }
};

window.revokeKey = revokeKey; window.revokeUser = window.deleteUser; // global binds
