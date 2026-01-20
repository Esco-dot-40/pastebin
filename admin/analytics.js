// Analytics Command Center JS
const storage = new PasteStorage();

// Initialize map
let map = null;
let markers = [];
let currentData = null;

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
        currentData = data;

        updateStats(data);
        updateMap(data.locations || []);
        updatePlatforms(data.platforms || {});
        updateDevices(data.devices || {});

        // Update tab-specific content
        updateBrowsersTab(data.browsers || []);
        updateISPTab(data.isps || []);
        updateResolutionsTab(data.resolutions || []);
        updateReferrersTab(data.referrers || []);
        updateConnectionsTab(data.connections || []);
        updateRecentActivityTab(data.recentViews || [], data.recentReactions || []);

    } catch (error) {
        console.error('Analytics error:', error);
    }
}

function updateStats(data) {
    document.getElementById('totalVisits').textContent = data.totalVisits || 0;
    document.getElementById('uniqueVisitors').textContent = data.uniqueVisitors || 0;
    document.getElementById('activeNow').textContent = data.activeNow || 0;

    // Update header indicator
    const headerActive = document.getElementById('headerActiveNow');
    if (headerActive) {
        headerActive.textContent = `${data.activeNow || 0} active now`;
    }

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
    if (!container) return;
    container.innerHTML = '';

    const platformData = Array.isArray(platforms) ? platforms : Object.entries(platforms).map(([name, count]) => ({ name, count }));
    const sorted = platformData.sort((a, b) => b.count - a.count).slice(0, 5);
    const maxCount = sorted[0]?.count || 1;

    sorted.forEach(({ name, count }) => {
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

function updateBrowsersTab(browsers) {
    const container = document.getElementById('browsersContent');
    if (!container) return;

    const sorted = (Array.isArray(browsers) ? browsers : []).sort((a, b) => b.count - a.count);
    const maxCount = sorted[0]?.count || 1;

    container.innerHTML = sorted.map(({ name, count }) => {
        const percentage = (count / maxCount) * 100;
        return `
            <div class="stat-bar">
                <div class="stat-bar-label">${name}</div>
                <div class="stat-bar-track">
                    <div class="stat-bar-fill" style="width: ${percentage}%; background: linear-gradient(90deg, #00f5ff, #7b42ff);"></div>
                </div>
                <div class="stat-bar-value">${count} visits</div>
            </div>
        `;
    }).join('');
}

function updateISPTab(isps) {
    const container = document.getElementById('ispContent');
    if (!container) return;

    const sorted = (Array.isArray(isps) ? isps : []).sort((a, b) => b.count - a.count).slice(0, 10);
    const maxCount = sorted[0]?.count || 1;

    container.innerHTML = sorted.map(({ name, count }) => {
        const percentage = (count / maxCount) * 100;
        return `
            <div class="stat-bar">
                <div class="stat-bar-label">${name || 'Unknown ISP'}</div>
                <div class="stat-bar-track">
                    <div class="stat-bar-fill" style="width: ${percentage}%; background: linear-gradient(90deg, #ff006e, #ffbe0b);"></div>
                </div>
                <div class="stat-bar-value">${count}</div>
            </div>
        `;
    }).join('');
}

function updateResolutionsTab(resolutions) {
    const container = document.getElementById('resolutionsContent');
    if (!container) return;

    const sorted = (Array.isArray(resolutions) ? resolutions : []).sort((a, b) => b.count - a.count);
    const maxCount = sorted[0]?.count || 1;

    container.innerHTML = sorted.map(({ name, count }) => {
        const percentage = (count / maxCount) * 100;
        return `
            <div class="stat-bar">
                <div class="stat-bar-label">${name}</div>
                <div class="stat-bar-track">
                    <div class="stat-bar-fill" style="width: ${percentage}%; background: linear-gradient(90deg, #00ff88, #00f5ff);"></div>
                </div>
                <div class="stat-bar-value">${count} devices</div>
            </div>
        `;
    }).join('');
}

function updateReferrersTab(referrers) {
    const container = document.getElementById('referrersContent');
    if (!container) return;

    const sorted = (Array.isArray(referrers) ? referrers : []).sort((a, b) => b.count - a.count);
    const maxCount = sorted[0]?.count || 1;

    container.innerHTML = sorted.map(({ name, count }) => {
        const percentage = (count / maxCount) * 100;
        return `
            <div class="stat-bar">
                <div class="stat-bar-label">${name}</div>
                <div class="stat-bar-track">
                    <div class="stat-bar-fill" style="width: ${percentage}%; background: linear-gradient(90deg, #7b42ff, #ff006e);"></div>
                </div>
                <div class="stat-bar-value">${count} visits</div>
            </div>
        `;
    }).join('');
}

function updateConnectionsTab(connections) {
    const container = document.getElementById('connectionsContent');
    if (!container) return;

    const sorted = (Array.isArray(connections) ? connections : []).sort((a, b) => b.count - a.count);
    const maxCount = sorted[0]?.count || 1;

    container.innerHTML = sorted.map(({ name, count }) => {
        const percentage = (count / maxCount) * 100;
        return `
            <div class="stat-bar">
                <div class="stat-bar-label">${name.toUpperCase()}</div>
                <div class="stat-bar-track">
                    <div class="stat-bar-fill" style="width: ${percentage}%; background: linear-gradient(90deg, #ffbe0b, #ff006e);"></div>
                </div>
                <div class="stat-bar-value">${count} connections</div>
            </div>
        `;
    }).join('');
}

function updateRecentActivityTab(views, reactions) {
    const container = document.getElementById('recentContent');
    if (!container) return;

    // Combine and sort by timestamp
    const activities = [
        ...views.map(v => ({ type: 'view', data: v, timestamp: new Date(v.timestamp) })),
        ...reactions.map(r => ({ type: 'reaction', data: r, timestamp: new Date(r.createdAt) }))
    ].sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);

    container.innerHTML = `
        <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; color: white;">
                <thead>
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); text-align: left;">
                        <th style="padding: 12px;">Time</th>
                        <th style="padding: 12px;">Type</th>
                        <th style="padding: 12px;">Location</th>
                        <th style="padding: 12px;">ISP</th>
                        <th style="padding: 12px;">IP</th>
                    </tr>
                </thead>
                <tbody>
                    ${activities.map(activity => {
        const d = activity.data;
        const timeAgo = formatTimeAgo(activity.timestamp);
        const location = d.city ? `${d.city}, ${d.country}` : (d.country || 'Unknown');
        const actionType = activity.type === 'view' ? '👁️ View' : `${getReactionEmoji(d.type)} Reaction`;

        return `
                            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                                <td style="padding: 12px; opacity: 0.7;">${timeAgo}</td>
                                <td style="padding: 12px;">${actionType}</td>
                                <td style="padding: 12px;">${location}</td>
                                <td style="padding: 12px; opacity: 0.8;">${d.isp || 'Unknown'}</td>
                                <td style="padding: 12px; font-family: monospace; opacity: 0.6;">${d.ip || 'N/A'}</td>
                            </tr>
                        `;
    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function getReactionEmoji(type) {
    const emojis = { heart: '❤️', star: '⭐', like: '👍' };
    return emojis[type] || '👍';
}

function formatTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

// Tab switching with content visibility
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const tabName = tab.getAttribute('data-tab');
        console.log('Switched to tab:', tabName);

        // Hide all tab content sections
        document.querySelectorAll('.tab-content').forEach(section => {
            section.style.display = 'none';
        });

        // Show selected tab content
        const selectedContent = document.querySelector(`[data-tab-content="${tabName}"]`);
        if (selectedContent) {
            selectedContent.style.display = 'block';
        }

        // Refresh map when switching to overview
        if (tabName === 'overview' && map) {
            setTimeout(() => map.invalidateSize(), 100);
        }
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
