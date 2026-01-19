// Analytics Command Center JS
const storage = new PasteStorage();

// Initialize map
let map = null;
let markers = [];

function initMap() {
    map = L.map('map', {
        center: [20, 0],
        zoom: 2,
        zoomControl: true,
        attributionControl: false
    });

    // Dark theme tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
    }).addTo(map);
}

// Load analytics data
async function loadAnalytics() {
    try {
        const response = await fetch('/api/pastes/analytics', {
            credentials: 'include'
        });

        if (!response.ok) throw new Error('Failed to load analytics');

        const data = await response.json();

        updateStats(data);
        updateMap(data.locations || []);
        updatePlatforms(data.platforms || {});
        updateDevices(data.devices || {});

    } catch (error) {
        console.error('Analytics error:', error);
    }
}

function updateStats(data) {
    document.getElementById('totalVisits').textContent = data.totalVisits || 0;
    document.getElementById('uniqueVisitors').textContent = data.uniqueVisitors || 0;
    document.getElementById('activeNow').textContent = data.activeNow || 0;
    document.getElementById('geoReach').textContent = data.uniqueLocations || 0;
    document.getElementById('newVisitors').textContent = data.newVisitors || 0;
    document.getElementById('returningVisitors').textContent = data.returningVisitors || 0;
}

function updateDevices(devices) {
    document.getElementById('avgCpuCores').textContent = devices.avgCpu || '0.0';
    document.getElementById('avgRam').textContent = (devices.avgRam || 0).toFixed(1) + ' GB';
    document.getElementById('touchDevices').textContent = devices.touchCount || 0;
    document.getElementById('desktopDevices').textContent = devices.desktopCount || 0;
}

function updateMap(locations) {
    // Clear existing markers
    markers.forEach(marker => marker.remove());
    markers = [];

    if (!locations || locations.length === 0) return;

    // Add markers for each location
    locations.forEach(loc => {
        if (loc.lat && loc.lon) {
            const marker = L.circleMarker([loc.lat, loc.lon], {
                radius: 8 + Math.log(loc.count || 1) * 3,
                fillColor: '#ff006e',
                color: '#fff',
                weight: 2,
                opacity: 0.8,
                fillOpacity: 0.6
            }).addTo(map);

            marker.bindPopup(`
                <div style="font-family: Inter, sans-serif;">
                    <strong>${loc.city || 'Unknown'}, ${loc.country || '??'}</strong><br>
                    Visits: ${loc.count || 1}
                </div>
            `);

            markers.push(marker);
        }
    });

    // Fit map to markers if any exist
    if (markers.length > 0) {
        const group = new L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.1));
    }
}

function updatePlatforms(platforms) {
    const container = document.getElementById('platformBars');
    container.innerHTML = '';

    const platformData = Object.entries(platforms)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5); // Top 5

    const maxCount = platformData[0]?.[1] || 1;

    platformData.forEach(([name, count]) => {
        const percentage = (count / maxCount) * 100;

        const item = document.createElement('div');
        item.className = 'platform-item';
        item.innerHTML = `
            <span class="platform-name">${name}</span>
            <div class="platform-bar-container">
                <div class="platform-bar" style="width: ${percentage}%"></div>
            </div>
            <span class="platform-count">${count}</span>
        `;
        container.appendChild(item);
    });
}

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const tabName = tab.getAttribute('data-tab');
        console.log('Switched to tab:', tabName);
        // Future: Load different data based on tab
    });
});

// Logout
document.getElementById('logoutBtn').addEventListener('click', async () => {
    try {
        await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });
        window.location.href = '/adminperm/login.html';
    } catch (error) {
        console.error('Logout error:', error);
        window.location.href = '/adminperm/login.html';
    }
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadAnalytics();

    // Auto-refresh every 30 seconds
    setInterval(loadAnalytics, 30000);
});
