// Analytics Command Center JS
const storage = new PasteStorage();

// Initialize map
let map = null;
let markers = [];
let currentData = null;

function initMap() {
    try {
        const mapContainer = document.getElementById('map');
        if (!mapContainer) return;

        map = L.map('map', {
            center: [20, 0],
            zoom: 2,
            zoomControl: true,
            attributionControl: false
        });

        // OpenStreetMap Dark theme tiles
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        }).addTo(map);

        console.log('✅ Map initialized');
    } catch (e) {
        console.error('❌ Map initialization failed:', e);
    }
}

// Load analytics data
async function loadAnalytics() {
    try {
        console.log('📡 Fetching analytics data...');
        const response = await fetch('/api/pastes/analytics', {
            credentials: 'include'
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}: Failed to load analytics`);

        const data = await response.json();
        console.log('✅ Analytics data received:', data);
        currentData = data;

        // stats always first
        updateStats(data);

        // Run updates safely
        const runner = (fn, name, ...args) => {
            try {
                fn(...args);
            } catch (e) {
                console.error(`❌ Error in ${name}:`, e);
            }
        };

        runner(updateMap, 'updateMap', data.locations || []);
        runner(updatePlatforms, 'updatePlatforms', data.platforms || []);
        runner(updateDevices, 'updateDevices', data.devices || {});

        // Update tab-specific content
        runner(updateBrowsersTab, 'updateBrowsersTab', data.browsers || []);
        runner(updateISPTab, 'updateISPTab', data.isps || []);
        runner(updateResolutionsTab, 'updateResolutionsTab', data.resolutions || []);
        runner(updateReferrersTab, 'updateReferrersTab', data.referrers || []);
        runner(updateConnectionsTab, 'updateConnectionsTab', data.connections || []);
        runner(updateRecentActivityTab, 'updateRecentActivityTab', (data.recentViews || []), (data.recentReactions || []));

        // Update page accesses if available
        if (data.pageAccesses) {
            runner(updatePageAccessesTab, 'updatePageAccessesTab', data.pageAccesses);
        }

        // Load top cities
        await loadTopCities();

    } catch (error) {
        console.error('❌ Analytics Load Error:', error);
    }
}

// Combine for updateRecentActivityTab call fix
function wrapRecentActivity(views, reactions) {
    updateRecentActivityTab(views, reactions);
}

// ... rest of the helper functions ...

function updateMap(locations) {
    if (!map) return;

    // Clear existing markers
    markers.forEach(marker => marker.remove());
    markers = [];

    if (!locations || locations.length === 0) {
        console.log('ℹ️ No locations to display on map');
        return;
    }

    // Add markers for each location
    locations.forEach(loc => {
        const lat = parseFloat(loc.lat);
        const lon = parseFloat(loc.lon);

        if (!isNaN(lat) && !isNaN(lon)) {
            const marker = L.circleMarker([lat, lon], {
                radius: 8 + Math.log(loc.count || 1) * 3,
                fillColor: '#ff006e',
                color: '#fff',
                weight: 2,
                opacity: 0.8,
                fillOpacity: 0.6
            }).addTo(map);

            marker.bindPopup(`
                <div style="font-family: Inter, sans-serif; color: #000;">
                    <strong>${loc.city || 'Unknown'}, ${loc.country || '??'}</strong><br>
                    Visits: ${loc.count || 1}
                </div>
            `);

            markers.push(marker);
        }
    });

    // Fit map to markers if any exist
    if (markers.length > 0) {
        try {
            const group = new L.featureGroup(markers);
            map.fitBounds(group.getBounds().pad(0.1));
        } catch (e) { console.warn('map.fitBounds failed', e); }
    }
}

function updatePlatforms(platforms) {
    const container = document.getElementById('platformBars');
    if (!container) return;
    container.innerHTML = '';

    const platformData = Array.isArray(platforms) ? platforms : Object.entries(platforms).map(([name, count]) => ({ name, count }));
    const sorted = platformData.sort((a, b) => (b.count || 0) - (a.count || 0)).slice(0, 5);

    if (sorted.length === 0) {
        container.innerHTML = '<p class="no-data">No platform data</p>';
        return;
    }

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

    const data = (Array.isArray(browsers) ? browsers : []).sort((a, b) => b.count - a.count);

    if (data.length === 0) {
        container.innerHTML = '<p class="no-data">No browser data</p>';
        return;
    }

    const maxCount = data[0]?.count || 1;

    container.innerHTML = data.map(({ name, count }) => {
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

    const data = (Array.isArray(isps) ? isps : []).sort((a, b) => b.count - a.count).slice(0, 10);

    if (data.length === 0) {
        container.innerHTML = '<p class="no-data">No ISP data</p>';
        return;
    }

    const maxCount = data[0]?.count || 1;

    container.innerHTML = data.map(({ name, count }) => {
        const percentage = (count / maxCount) * 100;
        return `
            <div class="stat-bar">
                <div class="stat-bar-label">${name || 'Unknown ISP'}</div>
                <div class="stat-bar-track">
                    <div class="stat-bar-fill" style="width: ${percentage}%; background: linear-gradient(90deg, #ff006e, #ffbe0b);"></div>
                </div>
                <div class="stat-bar-value">${count}</div>
                <button onclick="deleteLogsByISP('${name}')" style="margin-left: 10px; background: none; border: none; cursor: pointer; font-size: 0.8rem;">🗑️</button>
            </div>
        `;
    }).join('');
}

async function deleteLogsByISP(ispName) {
    if (!confirm(`Delete all logs from ISP: ${ispName}?`)) return;
    try {
        await fetch(`/api/pastes/analytics/isp/${encodeURIComponent(ispName)}`, { method: 'DELETE', credentials: 'include' });
        loadAnalytics();
    } catch (e) { console.error(e); }
}

function updateResolutionsTab(resolutions) {
    const container = document.getElementById('resolutionsContent');
    if (!container) return;

    const data = (Array.isArray(resolutions) ? resolutions : []).sort((a, b) => b.count - a.count);

    if (data.length === 0) {
        container.innerHTML = '<p class="no-data">No resolution data</p>';
        return;
    }

    const maxCount = data[0]?.count || 1;

    container.innerHTML = data.map(({ name, count }) => {
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

    const data = (Array.isArray(referrers) ? referrers : []).sort((a, b) => b.count - a.count);

    if (data.length === 0) {
        container.innerHTML = '<p class="no-data">No referrer data</p>';
        return;
    }

    const maxCount = data[0]?.count || 1;

    container.innerHTML = data.map(({ name, count }) => {
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

    const data = (Array.isArray(connections) ? connections : []).sort((a, b) => b.count - a.count);

    if (data.length === 0) {
        container.innerHTML = '<p class="no-data">No connection data</p>';
        return;
    }

    const maxCount = data[0]?.count || 1;

    container.innerHTML = data.map(({ name, count }) => {
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

    if (!views && !reactions) {
        container.innerHTML = '<p class="no-data">No recent activity</p>';
        return;
    }

    const vArr = Array.isArray(views) ? views : [];
    const rArr = Array.isArray(reactions) ? reactions : [];

    const activities = [
        ...vArr.map(v => ({ type: 'view', data: v, timestamp: new Date(v.timestamp) })),
        ...rArr.map(r => ({ type: 'reaction', data: r, timestamp: new Date(r.createdAt) }))
    ].sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);

    if (activities.length === 0) {
        container.innerHTML = '<p class="no-data">No recent activity</p>';
        return;
    }

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

// ... original helper functions (updateStats, loadTopCities, updateTopCitiesUI, deleteLogsFromCity, getReactionEmoji, formatTimeAgo, updatePageAccessesTab, etc.) ...

function updateStats(data) {
    document.getElementById('totalVisits').textContent = data.totalVisits || 0;
    document.getElementById('uniqueVisitors').textContent = data.uniqueVisitors || 0;
    document.getElementById('activeNow').textContent = data.activeNow || 0;

    const headerActive = document.getElementById('headerActiveNow');
    if (headerActive) headerActive.textContent = `${data.activeNow || 0} active now`;

    document.getElementById('geoReach').textContent = data.uniqueLocations || 0;
    document.getElementById('newVisitors').textContent = data.newVisitors || 0;
    document.getElementById('returningVisitors').textContent = data.returningVisitors || 0;
}

async function loadTopCities() {
    try {
        const response = await fetch('/api/pastes/analytics/top-cities', { credentials: 'include' });
        if (!response.ok) return;
        const cities = await response.json();
        updateTopCitiesUI(cities);
    } catch (e) { console.error(e); }
}

function updateTopCitiesUI(cities) {
    const container = document.getElementById('topCitiesContent');
    if (!container) return;

    if (!cities || cities.length === 0) {
        container.innerHTML = '<p class="no-data">No data for cities</p>';
        return;
    }

    const sorted = cities.sort((a, b) => b.count - a.count);
    const maxCount = sorted[0]?.count || 1;

    container.innerHTML = sorted.map(({ city, country, count }) => {
        const percentage = (count / maxCount) * 100;
        return `
            <div class="city-item" style="display: flex; align-items: center; gap: 12px; padding: 10px; background: rgba(255,255,255,0.03); border-radius: 8px; margin-bottom: 5px;">
                <div style="flex: 1;">
                    <div style="font-weight: 500; color: white;">${city}, ${country}</div>
                    <div style="background: rgba(255,255,255,0.1); height: 6px; border-radius: 3px; margin-top: 4px;">
                        <div style="width: ${percentage}%; height: 100%; background: linear-gradient(90deg, #ff006e, #7b42ff);"></div>
                    </div>
                </div>
                <div style="color: var(--text-secondary); font-weight: 600;">${count} hits</div>
                <button onclick="deleteLogsFromCity('${city}')" style="background:none; border:none; cursor:pointer;">🗑️</button>
            </div>
        `;
    }).join('');
}

async function deleteLogsFromCity(cityName) {
    if (!confirm(`Delete logs for ${cityName}?`)) return;
    try {
        await fetch(`/api/pastes/analytics/city/${encodeURIComponent(cityName)}`, { method: 'DELETE', credentials: 'include' });
        loadAnalytics();
    } catch (e) { console.error(e); }
}

function updateDevices(devices) {
    document.getElementById('avgCpuCores').textContent = devices.avgCpu || '0.0';
    document.getElementById('avgRam').textContent = (devices.avgRam || 0).toFixed(1) + ' GB';
    document.getElementById('touchDevices').textContent = devices.touchCount || 0;
    document.getElementById('desktopDevices').textContent = devices.desktopCount || 0;
}

function getReactionEmoji(type) {
    const emojis = { heart: '❤️', star: '⭐', like: '👍' };
    return emojis[type] || '👍';
}

function formatTimeAgo(date) {
    try {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        if (isNaN(seconds)) return 'N/A';
        if (seconds < 60) return `${seconds}s ago`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    } catch (e) { return 'N/A'; }
}

function updatePageAccessesTab(pageAccesses) {
    const container = document.getElementById('pageAccessesContent');
    if (!container) return;

    const { byPage = [], total = 0 } = pageAccesses;
    if (byPage.length === 0) {
        container.innerHTML = '<p class="no-data">No page access data</p>';
        return;
    }

    const maxCount = byPage[0]?.count || 1;
    container.innerHTML = `
        <div style="margin-bottom: 1rem;">
            <h4 style="color: var(--accent-cyan);">Total Page Hits: ${total}</h4>
        </div>
        ${byPage.map(({ path, count }) => {
        const percentage = (count / maxCount) * 100;
        return `
                <div class="stat-bar">
                    <div class="stat-bar-label" style="font-family: monospace; font-size: 0.8rem;">${path}</div>
                    <div class="stat-bar-track"><div class="stat-bar-fill" style="width: ${percentage}%; background: linear-gradient(90deg, #00ff88, #00f5ff);"></div></div>
                    <div class="stat-bar-value">${count} hits</div>
                </div>
            `;
    }).join('')}
    `;
}

// Tab Switching
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const tabName = tab.getAttribute('data-tab');
        document.querySelectorAll('.tab-content').forEach(section => section.style.display = 'none');
        const content = document.querySelector(`[data-tab-content="${tabName}"]`);
        if (content) content.style.display = 'block';
        if (tabName === 'overview' && map) setTimeout(() => map.invalidateSize(), 200);
    });
});

// Logout
document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/adminperm/login.html';
});

// Init
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadAnalytics();
    setInterval(loadAnalytics, 30000);
});
