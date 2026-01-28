
// Nexus Intelligence - Analytics Engine (Vanilla)
const api = new PasteAPI();

// Global State
let map = null;
let geoJsonLayer = null;
let currentData = null;
let feedSearchQuery = '';

// Configuration
const HEATMAP_URL = 'https://raw.githubusercontent.com/datasets/geo-boundaries-world-110m/master/countries.geojson';

/**
 * Initializes the Leaflet map with a dark theme.
 */
function initMap() {
    try {
        if (map) return;
        map = L.map('map', {
            center: [20, 0],
            zoom: 2,
            zoomControl: true,
            attributionControl: false,
            minZoom: 2,
            maxBounds: [[-85, -180], [85, 180]]
        });

        // Dark Matrix Tiles
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19
        }).addTo(map);

        console.log('📡 [Nexus] Navigation array initialized.');
    } catch (e) {
        console.error('❌ [Nexus] Map failure:', e);
    }
}

/**
 * Core Data Pipeline
 */
async function loadAnalytics() {
    try {
        const data = await api.getGlobalAnalytics();
        if (!data) return;
        currentData = data;

        updateGlobalStats(data);
        await updateHeatmap(data.locations || []);
        updateEnvironmentCharts(data);
        updateActivityFeed(data);

    } catch (error) {
        console.error('❌ [Nexus] Data fetch failure:', error);
    }
}

/**
 * Updates primary stats
 */
function updateGlobalStats(data) {
    const safeSet = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val || '0';
    };

    safeSet('totalVisits', data.totalVisits);
    safeSet('uniqueVisitors', data.uniqueVisitors);
    safeSet('activeNow', data.activeNow);
    safeSet('geoReach', data.uniqueLocations);
    if (document.getElementById('headerActiveNow')) {
        document.getElementById('headerActiveNow').textContent = `${data.activeNow || 0} active now`;
    }

    // Sub-stats
    safeSet('newVisitors', data.newVisitors);
    safeSet('returningVisitors', data.returningVisitors);
}

/**
 * Implements the Choropleth Heatmap
 */
async function updateHeatmap(locations) {
    if (!map) return;

    try {
        // Fetch GeoJSON if not already cached
        if (!window._geoJsonData) {
            const resp = await fetch(HEATMAP_URL);
            window._geoJsonData = await resp.json();
        }

        const stats = {};
        locations.forEach(l => {
            if (l.countryCode) stats[l.countryCode.toUpperCase()] = (stats[l.countryCode.toUpperCase()] || 0) + (l.count || 1);
        });

        const maxCount = Math.max(...Object.values(stats), 1);

        if (geoJsonLayer) map.removeLayer(geoJsonLayer);

        geoJsonLayer = L.geoJSON(window._geoJsonData, {
            style: (feature) => {
                const code = feature.properties.iso_a2 || feature.properties.ISO_A2;
                const count = stats[code] || 0;
                return {
                    fillColor: count > 0 ? getColor(count, maxCount) : '#1a1a1a',
                    weight: 1,
                    opacity: 1,
                    color: '#333',
                    fillOpacity: 0.8
                };
            },
            onEachFeature: (feature, layer) => {
                const code = feature.properties.iso_a2 || feature.properties.ISO_A2;
                const count = stats[code] || 0;
                const name = feature.properties.name || feature.properties.NAME;

                if (count > 0) {
                    layer.bindPopup(`
                        <div class="nexus-popup">
                            <div class="popup-header">
                                <span>${getFlagEmoji(code)}</span>
                                <strong>${name}</strong>
                            </div>
                            <div class="popup-body">
                                SESSIONS: <strong>${count}</strong>
                            </div>
                        </div>
                    `);

                    layer.on('mouseover', () => {
                        layer.setStyle({ fillOpacity: 1, weight: 2, color: '#fff' });
                    });
                    layer.on('mouseout', () => {
                        layer.setStyle({ fillOpacity: 0.8, weight: 1, color: '#333' });
                    });
                }
            }
        }).addTo(map);

    } catch (e) {
        console.error('❌ [Nexus] Heatmap sync failed:', e);
    }
}

/**
 * Color scale for heatmap
 */
function getColor(count, max) {
    const ratio = count / max;
    // Simple interpolation from #1a1a1a to #FE4A49
    // #1a1a1a -> rgb(26, 26, 26)
    // #FE4A49 -> rgb(254, 74, 73)
    const r = Math.round(26 + (254 - 26) * ratio);
    const g = Math.round(26 + (74 - 26) * ratio);
    const b = Math.round(26 + (73 - 26) * ratio);
    return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Renders simple bar charts
 */
function renderBarChart(containerId, data, colorClass = 'cyan') {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!data || data.length === 0) {
        container.innerHTML = '<div class="no-data-card">Insufficient Data Signal</div>';
        return;
    }

    const sorted = [...data].sort((a, b) => b.count - a.count).slice(0, 10);
    const max = sorted[0].count;

    container.innerHTML = sorted.map(item => `
        <div class="stat-bar">
            <span class="stat-bar-label">${item.name || item.city || 'Unknown'}</span>
            <div class="stat-bar-track">
                <div class="stat-bar-fill" style="width: ${(item.count / max) * 100}%; background: var(--accent-${colorClass})"></div>
            </div>
            <span class="stat-bar-value">${item.count}</span>
        </div>
    `).join('');
}

function updateEnvironmentCharts(data) {
    renderBarChart('platformBars', data.platforms || [], 'purple');
    renderBarChart('browsersContent', data.browsers || [], 'cyan');
    renderBarChart('resolutionsContent', data.resolutions || [], 'gold');
    renderBarChart('ispContent', data.isps || [], 'purple');
    renderBarChart('referrersContent', data.referrers || [], 'cyan');
    renderBarChart('pageAccessesContent', data.pageAccesses?.byPage.map(p => ({ name: p.path, count: p.count })) || [], 'purple');

    // Top Cities in Overview
    const citiesContainer = document.getElementById('topCitiesContent');
    if (citiesContainer && data.locations) {
        const topCities = [...data.locations].sort((a, b) => b.count - a.count).slice(0, 8);
        citiesContainer.innerHTML = topCities.map((l, i) => `
            <div style="display: flex; justify-content: space-between; padding: 10px; background: rgba(255,255,255,0.02); border-radius: 12px; font-size: 0.85rem;">
                <span style="font-weight: 700; color: var(--text-tertiary);">#${i + 1}</span>
                <span style="font-weight: 600;">${l.city}</span>
                <span style="font-family: var(--font-mono); font-weight: 800; color: var(--accent-red);">${l.count}</span>
            </div>
        `).join('');
    }
}

/**
 * Updates activity feed
 */
function updateActivityFeed(data) {
    const container = document.getElementById('recentContent');
    if (!container) return;

    const views = data.recentActivity || [];
    const activities = views.filter(v => {
        if (!feedSearchQuery) return true;
        const q = feedSearchQuery.toLowerCase();
        return (v.ip || '').toLowerCase().includes(q) || (v.city || '').toLowerCase().includes(q) || (v.path || '').toLowerCase().includes(q);
    });

    container.innerHTML = `
        <div class="activity-table-container">
            <table class="activity-table">
                <thead>
                    <tr>
                        <th>Node</th>
                        <th>Path</th>
                        <th>Location</th>
                        <th>IP Address</th>
                        <th>Signal</th>
                    </tr>
                </thead>
                <tbody>
                    ${activities.slice(0, 50).map(v => `
                        <tr>
                            <td><span class="type-tag type-view">Veroe</span></td>
                            <td class="mono" style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${v.path}</td>
                            <td>${getFlagEmoji(v.countryCode)} ${v.city}</td>
                            <td class="mono">${v.ip}</td>
                            <td class="mono">${new Date(v.timestamp).toLocaleTimeString()}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

/**
 * Utility: Unicode Flags
 */
function getFlagEmoji(countryCode) {
    if (!countryCode || countryCode === '??') return '🏳️';
    return countryCode.toUpperCase().replace(/./g, char => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadAnalytics();
    setInterval(loadAnalytics, 30000);

    // Tab Logic
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.getAttribute('data-tab');
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
            const targetContent = document.querySelector(`[data-tab-content="${target}"]`);
            if (targetContent) targetContent.style.display = 'block';

            if (target === 'overview' && map) setTimeout(() => map.invalidateSize(), 200);
        });
    });

    // Hardware Specs Logic (Network Tab)
    document.querySelector('[data-tab="network"]')?.addEventListener('click', () => {
        if (!currentData || !currentData.devices) return;
        const d = currentData.devices;
        document.getElementById('avgCpuCores').textContent = d.avgCpu || '0';
        document.getElementById('avgRam').textContent = (d.avgRam || 0).toFixed(1) + ' GB';
        document.getElementById('touchDevices').textContent = d.touchCount || 0;
        document.getElementById('desktopDevices').textContent = d.desktopCount || 0;
    });

    // Feed Search
    document.getElementById('feedSearch')?.addEventListener('input', (e) => {
        feedSearchQuery = e.target.value;
        if (currentData) updateActivityFeed(currentData);
    });
});

// Logout flow
document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    if (confirm("Terminate secure session?")) {
        await api.logout();
        window.location.href = '/adminperm/login.html';
    }
});
