// ENERG Premium Analytics Console - veroe.space & ENERG
const storage = new PasteStorage();

// State
let mainMap = null;
let mainMapMarkers = [];
let globalAnalyticsData = null;
let trafficChart = null;
let currentTab = 'overview';

// Elements
const els = {
    totalHits: document.getElementById('totalHits'),
    uniqueReaders: document.getElementById('uniqueReaders'),
    geoReach: document.getElementById('geoReach'),
    activeVisitors: document.getElementById('activeVisitors'),
    browserList: document.getElementById('browserList'),
    ispList: document.getElementById('ispList'),
    trafficLogBody: document.getElementById('trafficLogBody'),
    packetCounter: document.getElementById('packetCounter'),
    // Tab Specific
    fullNodesBody: document.getElementById('fullNodesBody'),
    accessKeyList: document.getElementById('accessKeyList'),
    adminUsersList: document.getElementById('adminUsersList'),
    browserDetailList: document.getElementById('browserDetailList'),
    ispDetailList: document.getElementById('ispDetailList'),
    referrerList: document.getElementById('referrerList'),
    tabTitle: document.getElementById('tabTitle'),
    tabSub: document.getElementById('tabSub'),
    generateKeyBtn: document.getElementById('generateKeyBtn'),
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
    await loadTabDedicatedData();

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

        // Populate Intel (Overview)
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

        // Populate Network Tab Data if active
        if (currentTab === 'network') populateNetworkTab(data);

    } catch (e) {
        console.error('Data sync failed:', e);
    }
}

async function loadTabDedicatedData() {
    if (currentTab === 'active') await populateActiveNodes();
    if (currentTab === 'security') await populateSecurityTab();
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
                data: [45, 12, 67, 34, 89, 56, 23],
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
    const counts = (data.browsers || []).map(b => b.count).slice(0, 7);
    if (counts.length > 0) {
        trafficChart.data.datasets[0].data = counts;
        trafficChart.update();
    }
}

function updateTopPastes(pages) {
    const container = document.getElementById('topPastesList');
    if (!container) return;
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

function populateIntelList(id, items) {
    const container = typeof id === 'string' ? document.getElementById(id) : id;
    if (!container) return;
    container.innerHTML = items.slice(0, 8).map(item => `
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

// TAB POPULATION LOGIC
async function populateActiveNodes() {
    if (!els.fullNodesBody) return;
    try {
        const pastes = await storage.getAllPastes();
        els.fullNodesBody.innerHTML = pastes.map(p => `
            <tr>
                <td style="font-family:var(--font-mono); font-size:10px">${p.id}</td>
                <td style="font-weight:700">${p.title}</td>
                <td style="font-size:11px; color:var(--text-secondary)">${new Date(p.createdAt).toLocaleDateString()}</td>
                <td style="color:var(--accent-purple); font-weight:800">${p.views}</td>
                <td>
                    <div style="display:flex; gap:10px">
                        <button onclick="window.open('/v/${p.id}', '_blank')" class="btn-outline" style="padding:4px 10px; font-size:10px">VIEW</button>
                        <button onclick="deleteNode('${p.id}')" class="btn-outline" style="padding:4px 10px; font-size:10px; border-color:#FF5E5E; color:#FF5E5E">DELETE</button>
                    </div>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="5" style="text-align:center; opacity:0.3; padding:40px">NO_NODES_FOUND</td></tr>';
    } catch (e) {
        console.error('Failed to load nodes:', e);
    }
}

async function populateSecurityTab() {
    try {
        // Access Keys
        const keys = await storage.getAllAccessKeys();
        if (els.accessKeyList) {
            els.accessKeyList.innerHTML = keys.map(k => `
                <div class="intel-item" style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.02)">
                    <div style="display:flex; flex-direction:column">
                        <span class="name" style="font-family:var(--font-mono); color:white">${k.key}</span>
                        <span style="font-size:10px; color:var(--text-secondary)">${k.userEmail || 'UNCLAIMED'}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:15px">
                        <span class="count" style="color:${k.status === 'active' ? 'var(--accent-green)' : '#FF5E5E'}">${k.status.toUpperCase()}</span>
                        <button onclick="revokeKey('${k.id}')" class="btn-outline" style="padding:2px 8px; font-size:9px; border-color:#FF5E5E; color:#FF5E5E">REVOKE</button>
                    </div>
                </div>
            `).join('') || '<span style="opacity:0.2">NO_KEYS_GENERATED</span>';
        }

        // Admin Users
        const users = await storage.getAllUsers();
        if (els.adminUsersList) {
            els.adminUsersList.innerHTML = users.map(u => `
                <div class="intel-item">
                    <span class="name">${u.username || u.email}</span>
                    <span class="count" style="color:var(--accent-purple)">${u.isAdmin ? 'ADMIN' : 'USER'}</span>
                </div>
            `).join('') || '<span style="opacity:0.2">NO_USERS_FOUND</span>';
        }
    } catch (e) {
        console.error('Security tab error:', e);
    }
}

function populateNetworkTab(data) {
    populateIntelList(els.browserDetailList, data.browsers || []);
    populateIntelList(els.ispDetailList, data.isps || []);
    populateIntelList(els.referrerList, data.referrers || []);
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
    item.onclick = async (e) => {
        e.preventDefault();
        const tab = item.dataset.tab;
        currentTab = tab;

        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        document.getElementById(`tab-${tab}`).classList.add('active');

        // Update titles
        if (tab === 'overview') { els.tabTitle.textContent = 'Energy Terminal'; els.tabSub.textContent = 'System-wide traffic monitoring and node propagation.'; }
        if (tab === 'active') { els.tabTitle.textContent = 'Payload Repository'; els.tabSub.textContent = 'Inventory of all active content nodes.'; await populateActiveNodes(); }
        if (tab === 'security') { els.tabTitle.textContent = 'Security Core'; els.tabSub.textContent = 'Management of access protocols and encryption keys.'; await populateSecurityTab(); }
        if (tab === 'network') { els.tabTitle.textContent = 'Propagation Network'; els.tabSub.textContent = 'Detailed analysis of traffic carriers and origins.'; if (globalAnalyticsData) populateNetworkTab(globalAnalyticsData); }
    };
});

window.deleteNode = async (id) => {
    if (!confirm(`WIPE NODE ${id}?`)) return;
    await storage.deletePaste(id);
    await populateActiveNodes();
};

// Key Management
if (els.generateKeyBtn) {
    els.generateKeyBtn.onclick = async () => {
        try {
            const res = await storage.generateAccessKey();
            alert('NEW KEY PROPAGATED:\n' + res.key);
            await populateSecurityTab();
        } catch (e) { alert(e.message); }
    };
}

window.revokeKey = async (id) => {
    if (!confirm('TERMINATE ACCESS KEY?')) return;
    try {
        await storage.revokeAccessKey(id);
        await populateSecurityTab();
    } catch (e) { alert(e.message); }
};

// Logout
if (document.getElementById('logoutBtn')) {
    document.getElementById('logoutBtn').onclick = async () => {
        if (!confirm('TERMINATE SESSION?')) return;
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.reload();
    };
}

// Modal Toggle Logic
function toggleEditor(show = true) {
    if (els.editorOverlay) {
        show ? els.editorOverlay.classList.add('active') : els.editorOverlay.classList.remove('active');
    }
}
window.toggleEditor = toggleEditor;

if (els.closeEditorBtn) els.closeEditorBtn.onclick = () => toggleEditor(false);

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
            if (currentTab === 'active') await populateActiveNodes();
        } catch (e) { alert(e.message); }
    };
}

function calculateExpiration(val) {
    if (val === 'never') return null;
    const now = new Date();
    const map = { '1h': 3600000, '1d': 86400000 };
    return new Date(now.getTime() + (map[val] || 0)).toISOString();
}
