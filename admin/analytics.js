
// Nexus Intelligence - Analytics Engine (Vanilla)
const api = new PasteAPI();



// Global State
let currentData = null;
let feedSearchQuery = '';
let amRoot = null;
let polygonSeries = null;

/**
 * Core Data Pipeline
 */
async function loadAnalytics() {
    try {
        const data = await api.getGlobalAnalytics();
        if (!data) return;
        currentData = data;

        updateGlobalStats(data);
        updateHeatmap(data.locations || []);
        updateEnvironmentCharts(data);
        updateActivityFeed(data);

    } catch (error) {
        console.error('❌ [Nexus] Data fetch failure:', error);
    }
}

/**
 * Initializes and updates the amCharts 5 Heatmap
 */
function updateHeatmap(locations) {
    if (!amRoot) {
        initAmCharts();
    }

    if (!polygonSeries) return;

    // Map data to amCharts format
    const mapData = (locations || []).map(l => ({
        id: l.countryCode,
        value: l.count
    }));

    polygonSeries.data.setAll(mapData);
}

function initAmCharts() {
    try {
        if (typeof am5 === 'undefined') {
            console.error('❌ [Nexus] amCharts not loaded yet');
            return;
        }

        const root = am5.Root.new("chartdiv");
        amRoot = root;

        root.setThemes([
            am5themes_Animated.new(root)
        ]);

        const chart = root.container.children.push(am5map.MapChart.new(root, {
            panX: "rotateX",
            panY: "translateY",
            projection: am5map.geoMercator(),
            homeGeoPoint: { latitude: 20, longitude: 0 },
            homeZoomLevel: 1
        }));

        // Create main polygon series for countries
        const series = chart.series.push(am5map.MapPolygonSeries.new(root, {
            geoJSON: am5geodata_worldLow,
            calculateAggregates: true,
            valueField: "value"
        }));
        polygonSeries = series;

        series.mapPolygons.template.setAll({
            tooltipText: "{name}: {value} Sessions",
            interactive: true,
            fill: am5.color(0x1a1a2e),
            stroke: am5.color(0x333344),
            strokeWidth: 0.5
        });

        series.mapPolygons.template.states.create("hover", {
            fill: am5.color(0x7b42ff)
        });

        series.set("heatRules", [{
            target: series.mapPolygons.template,
            dataField: "value",
            min: am5.color(0x1a1a2e),
            max: am5.color(0x00f5ff),
            key: "fill"
        }]);

        // Add zoom control
        chart.set("zoomControl", am5map.ZoomControl.new(root, {}));

        // Set up "Home" button
        chart.appear(1000, 100);

    } catch (e) {
        console.error('❌ [Nexus] amCharts failure:', e);
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
                            <td><span class="type-tag type-view">${v.source === 'paste' ? 'Paste' : 'Veroe'}</span></td>
                            <td class="mono" style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${v.path}</td>
                            <td>${v.countryCode ? getFlagEmoji(v.countryCode) : '🌐'} ${v.city || 'Unknown Location'}</td>
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
async function initAnalytics() {
    await loadAnalytics();
    setInterval(loadAnalytics, 30000);
}

document.addEventListener('DOMContentLoaded', () => {
    initAnalytics();

    // Tab Logic
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.getAttribute('data-tab');
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
            const targetContent = document.querySelector(`[data-tab-content="${target}"]`);
            if (targetContent) targetContent.style.display = 'block';

            if (target === 'overview') {
                // Map handling removed
            }
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
    // Logout flow
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        if (confirm("Terminate secure session?")) {
            await api.logout();
            window.location.href = '/adminperm/login.html';
        }
    });

});
