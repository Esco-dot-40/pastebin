// ENERG Premium Analytics Console - veroe.space & ENERG
const storage = new PasteStorage();

// State
let mainMap = null;
let mainMapMarkers = [];
let globalAnalyticsData = null;
let trafficChart = null;

// Elements
const els = {
    totalHits: document.getElementById('totalHits'),
    uniqueReaders: document.getElementById('uniqueReaders'),
    geoReach: document.getElementById('geoReach'),
    activeVisitors: document.getElementById('activeVisitors'),
    browserList: document.getElementById('browserList'),
    ispList: document.getElementById('ispList'),
    trafficLogBody: document.getElementById('trafficLogBody'),
    clusterGrid: document.getElementById('clusterGrid'),
    packetCounter: document.getElementById('packetCounter'),
    // Editor references
    editorOverlay: document.getElementById('editorOverlay'),
    pasteTitle: document.getElementById('pasteTitle'),
    pasteContent: document.getElementById('pasteContent'),
    pasteLanguage: document.getElementById('pasteLanguage'),
    pasteExpiration: document.getElementById('pasteExpiration'),
    createPasteBtn: document.getElementById('createPasteBtn'),
    closeEditorBtn: document.getElementById('closeEditorBtn')
};

// Languages Configuration
const LANGUAGES = [
    { id: 'plaintext', name: 'Plain Text' },
    { id: 'javascript', name: 'JavaScript' },
    { id: 'python', name: 'Python' },
    { id: 'html', name: 'HTML' },
    { id: 'css', name: 'CSS' },
    { id: 'json', name: 'JSON' },
    { id: 'markdown', name: 'Markdown' }
];

// Initialize
window.addEventListener('DOMContentLoaded', async () => {
    initChart();
    populateEditorConfig();

    // Initial data load
    await loadGlobalAnalytics();

    // Leaflet Init
    setTimeout(initMainMap, 100);

    // Refresh cycles
    setInterval(loadGlobalAnalytics, 15000); // 15s refresh
});

function populateEditorConfig() {
    if (els.pasteLanguage) {
        els.pasteLanguage.innerHTML = LANGUAGES.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
    }
}

async function loadGlobalAnalytics() {
    try {
        const data = await storage.getGlobalAnalytics();
        globalAnalyticsData = data;

        // Populate Stats
        if (els.totalHits) els.totalHits.textContent = data.totalVisits || 0;
        if (els.uniqueReaders) els.uniqueReaders.textContent = data.uniqueVisitors || 0;
        if (els.geoReach) els.geoReach.textContent = data.uniqueLocations || 0;
        if (els.activeVisitors) els.activeVisitors.textContent = `${data.activeNow || 0} Active Visitors`;

        // Update Matrix Components
        updateMainMap(data.locations || []);
        updateTopPastes(data.pageAccesses?.byPage || []);
        updateTrafficChart(data);

        // Populate Intel
        populateIntelList('browserList', data.browsers || []);
        populateIntelList('ispList', data.isps || []);

        // Log Stream
        const activity = [...(data.recentViews || []), ...(data.pageAccesses?.recent || [])]
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 50);
        populateTrafficLog(activity);

        if (els.packetCounter) {
            els.packetCounter.textContent = `SYNCING ${data.totalVisits % 25 + 5} PACKETS...`;
        }

    } catch (e) {
        console.error('Data sync failed:', e);
    }
}

function initMainMap() {
    if (mainMap) return;
    const container = document.getElementById('mainHeatmap');
    if (!container) return;

    mainMap = L.map('mainHeatmap', {
        center: [20, 0],
        zoom: 2,
        zoomControl: false,
        attributionControl: false
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(mainMap);

    if (globalAnalyticsData) {
        updateMainMap(globalAnalyticsData.locations || []);
    }
}

function updateMainMap(locations) {
    if (!mainMap) return;
    mainMapMarkers.forEach(m => m.remove());
    mainMapMarkers = [];

    locations.forEach(loc => {
        const lat = parseFloat(loc.lat);
        const lon = parseFloat(loc.lon);
        if (!isNaN(lat) && !isNaN(lon)) {
            const size = 10 + Math.log(loc.count || 1) * 6;
            const ring = L.circleMarker([lat, lon], {
                radius: size,
                fillColor: '#8B5CF6',
                color: '#8B5CF6',
                weight: 1,
                opacity: 0.3,
                fillOpacity: 0.15
            }).addTo(mainMap);

            const dot = L.circleMarker([lat, lon], {
                radius: 2,
                fillColor: '#fff',
                color: '#fff',
                weight: 1,
                opacity: 1,
                fillOpacity: 1
            }).addTo(mainMap);

            mainMapMarkers.push(ring, dot);
        }
    });

    if (mainMapMarkers.length > 0 && !mainMap._fitted) {
        const group = new L.featureGroup(mainMapMarkers);
        mainMap.fitBounds(group.getBounds().pad(0.1));
        mainMap._fitted = true;
    }
}

function initChart() {
    const ctx = document.getElementById('trafficChart');
    if (!ctx) return;

    trafficChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
            datasets: [{
                label: 'System Load',
                data: [45, 12, 67, 34, 89, 56, 23], // Placeholder till we have historical
                backgroundColor: 'rgba(139, 92, 246, 0.5)',
                borderWidth: 0,
                borderRadius: 8,
                barThickness: 15
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { display: false },
                y: { display: false }
            }
        }
    });
}

function updateTrafficChart(data) {
    if (!trafficChart) return;
    // Map browsers to the chart for visual variety if real history isn't ready
    const counts = (data.browsers || []).map(b => b.count).slice(0, 7);
    if (counts.length > 0) {
        trafficChart.data.datasets[0].data = counts;
        trafficChart.update();
    }
}

function updateTopPastes(pages) {
    const container = document.getElementById('topPastesList');
    if (!container) return;

    // Filter out root/admin paths
    const filtered = pages.filter(p => p.name.startsWith('/v/') || p.name.includes('paste')).slice(0, 5);

    container.innerHTML = filtered.map(p => `
        <div class="payload-node-item" onclick="window.open('${p.name}', '_blank')">
            <div class="node-info">
                <span class="node-name">${p.name.split('/').pop().toUpperCase() || 'ROOT'}</span>
                <span class="node-meta">${p.count} PROPAGATIONS</span>
            </div>
            <div class="node-charge">${Math.floor((p.count / (globalAnalyticsData?.totalVisits || 1)) * 100)}%</div>
        </div>
    `).join('') || '<div style="opacity:0.2; padding:20px; text-align:center;">NO NODES ACTIVE</div>';
}

function updateClusterSummary(locations) {
    if (!els.clusterGrid) return;
    const sorted = locations.sort((a, b) => b.count - a.count).slice(0, 4);

    els.clusterGrid.innerHTML = sorted.map(loc => `
        <div class="cluster-row">
            <span class="label">${loc.city.toUpperCase()} NODE</span>
            <span class="val">${loc.count}</span>
        </div>
    `).join('') || '<div class="cluster-row"><span class="label">NO NODES ACTIVE</span></div>';
}

function populateIntelList(id, items) {
    const container = document.getElementById(id);
    if (!container) return;
    container.innerHTML = items.slice(0, 5).map(item => `
        <div class="intel-item">
            <span class="name">${item.name.toUpperCase()}</span>
            <span class="count">${item.count}</span>
        </div>
    `).join('') || '<span style="opacity:0.2">DATA_IDLE</span>';
}

function populateTrafficLog(activity) {
    if (!els.trafficLogBody) return;
    els.trafficLogBody.innerHTML = activity.map(item => `
        <tr>
            <td style="color:var(--text-secondary)">${timeAgo(item.timestamp)}</td>
            <td style="color:var(--accent-purple); font-weight:700">${item.pasteId ? '/p/' + item.pasteId : item.path}</td>
            <td style="color:var(--accent-green)">${item.city || '??'}, ${item.countryCode || '??'}</td>
            <td>${(item.isp || 'PRIVATE').substring(0, 20)}</td>
            <td style="font-family:var(--font-mono); opacity:0.6">${item.ip || '---'}</td>
        </tr>
    `).join('');
}

function timeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return seconds + "s";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + "m";
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + "h";
    return Math.floor(hours / 24) + "d";
}

// Sidebar Navigation
document.querySelectorAll('.nav-item').forEach(item => {
    item.onclick = (e) => {
        e.preventDefault();
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        // Tab switching logic can go here
        if (item.dataset.tab === 'active') {
            // Option to show something else
        }
    };
});

// Logout
if (document.getElementById('logoutBtn')) {
    document.getElementById('logoutBtn').onclick = async () => {
        if (!confirm('TERMINATE SESSION?')) return;
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/adminperm/login.html';
    };
}

// Modal Toggle Logic
function toggleEditor(show = true) {
    if (els.editorOverlay) {
        show ? els.editorOverlay.classList.add('active') : els.editorOverlay.classList.remove('active');
    }
}

if (els.closeEditorBtn) els.closeEditorBtn.onclick = () => toggleEditor(false);

// Allow opening editor with shortcut or just click (I should add a dedicated button if missing)
// Adding a listener to any stat card as a temporary entry point or shortcut
document.querySelector('.hero-stat-card').onclick = () => toggleEditor(true);

if (els.createPasteBtn) {
    els.createPasteBtn.onclick = async () => {
        const content = els.pasteContent.value.trim();
        if (!content) return alert('Payload empty');

        try {
            const id = await storage.createPaste(content, {
                title: els.pasteTitle.value || 'Untitled',
                language: els.pasteLanguage.value,
                expiresAt: calculateExpiration(els.pasteExpiration.value)
            });
            alert('PAYLOAD PROPAGATED: ' + id);
            toggleEditor(false);
        } catch (e) { alert(e.message); }
    };
}

function calculateExpiration(val) {
    if (val === 'never') return null;
    const now = new Date();
    const map = { '1h': 3600000, '1d': 86400000 };
    return new Date(now.getTime() + (map[val] || 0)).toISOString();
}
