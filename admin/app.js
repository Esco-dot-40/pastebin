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
    { id: 'html', name: 'HTML' },
    { id: 'css', name: 'CSS' },
    { id: 'json', name: 'JSON' },
    { id: 'markdown', name: 'Markdown' },
    { id: 'bash', name: 'Bash' }
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
    list: document.getElementById('pasteListContainer'),
    search: document.getElementById('pasteSearch'),
    activeVisitors: document.getElementById('activeVisitors'),
    totalHits: document.getElementById('totalHits'),
    uniqueReaders: document.getElementById('uniqueReaders'),
    geoReach: document.getElementById('geoReach')
};

// Initialize
window.addEventListener('DOMContentLoaded', async () => {
    populateLanguages();

    // Initial data load
    await Promise.all([
        loadPasteList(),
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

        // Populate Live Traffic Log (Combine paste views and page accesses)
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

        console.log('Map Initialized');
    } catch (e) {
        console.error('Map Init Failed:', e);
    }
}

function updateMainMap(locations) {
    if (!mainMap) return;

    // Clear
    mainMapMarkers.forEach(m => m.remove());
    mainMapMarkers = [];

    locations.forEach(loc => {
        const lat = parseFloat(loc.lat);
        const lon = parseFloat(loc.lon);

        if (!isNaN(lat) && !isNaN(lon)) {
            // Outer Ring (Surveillance Style)
            const ring = L.circleMarker([lat, lon], {
                radius: 12 + Math.log(loc.count || 1) * 8,
                fillColor: '#7b42ff',
                color: '#7b42ff',
                weight: 2,
                opacity: 0.4,
                fillOpacity: 0.2
            }).addTo(mainMap);

            // Center Dot
            const dot = L.circleMarker([lat, lon], {
                radius: 3,
                fillColor: '#fff',
                color: '#fff',
                weight: 1,
                opacity: 1,
                fillOpacity: 1
            }).addTo(mainMap);

            const popup = `
                <div style="background:#0a0a0f; color:#fff; padding:10px; border-radius:8px; border:1px solid #7b42ff;">
                    <strong style="color:#7b42ff; letter-spacing:1px;">NODE: ${loc.city.toUpperCase()}</strong><br>
                    <span style="opacity:0.7; font-size:11px;">TRAFFIC IMPACT: ${loc.count}</span>
                </div>
            `;

            ring.bindPopup(popup);
            mainMapMarkers.push(ring, dot);
        }
    });

    // Auto fit if first time
    if (mainMapMarkers.length > 0 && !mainMap._fitted) {
        const group = new L.featureGroup(mainMapMarkers);
        mainMap.fitBounds(group.getBounds().pad(0.1));
        mainMap._fitted = true;
    }
}

function updateClusterSummary(locations) {
    const clusterGrid = document.getElementById('clusterGrid');
    if (!clusterGrid) return;

    // Group by Country Code or Region for "Clusters"
    const clusters = {};
    locations.forEach(loc => {
        const key = loc.countryCode || 'UN';
        if (!clusters[key]) {
            clusters[key] = { count: 0, label: loc.country || 'Unknown' };
        }
        clusters[key].count += loc.count;
    });

    // Sort by count and take top 5
    const topClusters = Object.entries(clusters)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5);

    const maxCount = topClusters.length > 0 ? topClusters[0][1].count : 1;

    clusterGrid.innerHTML = topClusters.map(([code, data]) => `
        <div class="cluster-item">
            <div class="cluster-name">
                <span class="code">${code}</span>
                <span class="label">${data.label.toUpperCase()} CLUSTER</span>
            </div>
            <div class="cluster-impact">
                <span class="impact-val">${data.count}</span>
                <span class="impact-label">IMPACT</span>
            </div>
            <div class="cluster-bar">
                <div class="cluster-bar-fill" style="width: ${(data.count / maxCount) * 100}%"></div>
            </div>
        </div>
    `).join('');
}

function populateIntelList(containerId, items) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const topItems = items.slice(0, 8); // Top 8 items
    if (topItems.length === 0) {
        container.innerHTML = '<span style="font-size:0.7rem; color:rgba(255,255,255,0.2)">NO DATA COLLECTED</span>';
        return;
    }

    container.innerHTML = topItems.map(item => `
        <div class="intel-item">
            <span class="intel-name">${item.name.toUpperCase()}</span>
            <span class="intel-val">${item.count}</span>
        </div>
    `).join('');
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
        const filtered = query
            ? pastes.filter(p => p.title.toLowerCase().includes(query.toLowerCase()) || p.id.includes(query))
            : pastes;

        els.list.innerHTML = filtered.map(p => `
            <div class="paste-item" onclick="loadPasteForEdit('${p.id}')">
                <div class="paste-item-header">
                    <span class="paste-item-title">${escapeHtml(p.title)}</span>
                    <span class="meta-pill">${p.id}</span>
                </div>
                <div class="paste-item-meta">
                    <span class="meta-pill">👁️ ${p.views || 0}</span>
                    <span class="meta-pill">📝 ${p.language}</span>
                    <span class="meta-pill">📅 ${new Date(p.createdAt).toLocaleDateString()}</span>
                </div>
                <div class="paste-item-actions">
                    <button class="btn btn-glass" onclick="event.stopPropagation(); window.open('/v/${p.id}', '_blank')">View</button>
                    <button class="btn btn-glass" onclick="event.stopPropagation(); showAnalytics('${p.id}')">Stats</button>
                    <button class="btn btn-glass" style="color:#ff006e" onclick="event.stopPropagation(); deletePaste('${p.id}')">Del</button>
                </div>
            </div>
        `).join('');
    } catch (e) {
        console.error('List load failed:', e);
    }
}

async function createPaste() {
    const content = els.content.value.trim();
    if (!content) return alert('Enter content');

    const config = {
        title: els.title.value || 'Untitled',
        language: els.lang.value,
        isPublic: els.public.checked,
        burnAfterRead: els.burn.checked,
        password: els.pass.value || null
    };

    try {
        if (currentLocalPasteId) {
            await storage.updatePaste(currentLocalPasteId, content, config);
            alert('Updated');
        } else {
            const id = await storage.createPaste(content, config);
            alert('Created: ' + id);
        }
        loadPasteList();
    } catch (e) { alert(e.message); }
}

async function deletePaste(id) {
    if (!confirm('Delete?')) return;
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
                <div class="matrix-title">
                    <span class="matrix-label">NODE ANALYSIS: ${id}</span>
                    <span class="matrix-sub">CRITICAL METRIC OVERVIEW</span>
                </div>
            </div>

            <div class="stat-group">
                <div class="stat-box">
                    <span class="stat-label">Total Volume</span>
                    <span class="stat-value">${data.totalViews || 0}</span>
                </div>
                <div class="stat-box">
                    <span class="stat-label">Unique Nodes</span>
                    <span class="stat-value">${data.uniqueIPs || 0}</span>
                </div>
            </div>

            <div class="detail-grid">
                <div class="detail-box">
                    <h4>GEOGRAPHIC ORIGINS</h4>
                    <div class="intel-list detail-list">
                        ${(data.locations || []).slice(0, 5).map(l => `
                            <div class="intel-item">
                                <span class="intel-name">${l.name.toUpperCase()}</span>
                                <span class="intel-val">${l.count}</span>
                            </div>
                        `).join('') || '<span style="opacity:0.3">No Logged Locations</span>'}
                    </div>
                </div>
                <div class="detail-box">
                    <h4>NETWORK INFRASTRUCTURE</h4>
                    <div class="intel-list detail-list">
                        ${(data.isps || []).slice(0, 5).map(i => `
                            <div class="intel-item">
                                <span class="intel-name">${i.name.toUpperCase()}</span>
                                <span class="intel-val">${i.count}</span>
                            </div>
                        `).join('') || '<span style="opacity:0.3">No Network Data</span>'}
                    </div>
                </div>
            </div>

            <div class="detail-box" style="margin-top:30px">
                <h4>RECENT ACCESS LOGS</h4>
                <div class="detail-list" style="padding:0">
                    <table class="log-table" style="font-size: 0.7rem">
                        <thead>
                            <tr>
                                <th>TIME</th>
                                <th>LOCATION</th>
                                <th>IP</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(data.recentViews || []).slice(0, 10).map(v => `
                                <tr>
                                    <td>${timeAgo(v.timestamp)}</td>
                                    <td class="location">${v.city || 'Unknown'}</td>
                                    <td class="ip">${v.ip}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        document.getElementById('analyticsModal').classList.add('active');
    } catch (e) {
        console.error(e);
        alert('Failed to load detailed analytics');
    }
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
    div.textContent = text;
    return div.innerHTML;
}

// Global binds
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
            document.getElementById('clearBtn').textContent = 'Cancel Edit';
        }
    } catch (e) { }
};

// Event Listeners
if (document.getElementById('createPasteBtn')) document.getElementById('createPasteBtn').onclick = createPaste;
if (document.getElementById('refreshBtn')) document.getElementById('refreshBtn').onclick = () => loadPasteList();
if (els.search) els.search.oninput = (e) => loadPasteList(e.target.value);
if (document.getElementById('clearBtn')) document.getElementById('clearBtn').onclick = () => {
    currentLocalPasteId = null;
    els.title.value = '';
    els.content.value = '';
    document.getElementById('clearBtn').textContent = 'Clear';
};
if (document.getElementById('logoutBtn')) document.getElementById('logoutBtn').onclick = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/adminperm/login.html';
};
