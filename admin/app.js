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
            <h3>Analytics for ${id}</h3>
            <div class="stat-group" style="margin-top:20px">
                <div class="stat-box">
                    <span class="stat-label">Total Views</span>
                    <span class="stat-value">${data.totalViews}</span>
                </div>
                <div class="stat-box">
                    <span class="stat-label">Unique IPs</span>
                    <span class="stat-value">${data.uniqueIPs}</span>
                </div>
            </div>
        `;
        document.getElementById('analyticsModal').classList.add('active');
    } catch (e) { alert(e.message); }
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
