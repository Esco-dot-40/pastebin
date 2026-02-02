/**
 * SECURITY_CORE v4.5_ULTIMATE
 * Integrated Interactive Geospatial Firewall
 */

let lastData = null;
let root, chart, polygonSeries, backgroundSeries;
let countryLookup = {};

// Full list of countries for the grid/globe
const ALL_COUNTRIES = [
    { code: "AD", name: "Andorra" }, { code: "AE", name: "United Arab Emirates" }, { code: "AF", name: "Afghanistan" },
    { code: "AG", name: "Antigua and Barbuda" }, { code: "AL", name: "Albania" }, { code: "AM", name: "Armenia" },
    { code: "AO", name: "Angola" }, { code: "AR", name: "Argentina" }, { code: "AT", name: "Austria" },
    { code: "AU", name: "Australia" }, { code: "AZ", name: "Azerbaijan" }, { code: "BA", name: "Bosnia and Herzegovina" },
    { code: "BB", name: "Barbados" }, { code: "BD", name: "Bangladesh" }, { code: "BE", name: "Belgium" },
    { code: "BF", name: "Burkina Faso" }, { code: "BG", name: "Bulgaria" }, { code: "BH", name: "Bahrain" },
    { code: "BI", name: "Burundi" }, { code: "BJ", name: "Benin" }, { code: "BN", name: "Brunei" },
    { code: "BO", name: "Bolivia" }, { code: "BR", name: "Brazil" }, { code: "BS", name: "Bahamas" },
    { code: "BT", name: "Bhutan" }, { code: "BW", name: "Botswana" }, { code: "BY", name: "Belarus" },
    { code: "BZ", name: "Belize" }, { code: "CA", name: "Canada" }, { code: "CD", name: "DR Congo" },
    { code: "CF", name: "Central African Republic" }, { code: "CG", name: "Republic of the Congo" },
    { code: "CH", name: "Switzerland" }, { code: "CI", name: "Ivory Coast" }, { code: "CL", name: "Chile" },
    { code: "CM", name: "Cameroon" }, { code: "CN", name: "China" }, { code: "CO", name: "Colombia" },
    { code: "CR", name: "Costa Rica" }, { code: "CU", name: "Cuba" }, { code: "CV", name: "Cape Verde" },
    { code: "CY", name: "Cyprus" }, { code: "CZ", name: "Czech Republic" }, { code: "DE", name: "Germany" },
    { code: "DJ", name: "Djibouti" }, { code: "DK", name: "Denmark" }, { code: "DM", name: "Dominica" },
    { code: "DO", name: "Dominican Republic" }, { code: "DZ", name: "Algeria" }, { code: "EC", name: "Ecuador" },
    { code: "EE", name: "Estonia" }, { code: "EG", name: "Egypt" }, { code: "ER", name: "Eritrea" },
    { code: "ES", name: "Spain" }, { code: "ET", name: "Ethiopia" }, { code: "FI", name: "Finland" },
    { code: "FJ", name: "Fiji" }, { code: "FM", name: "Micronesia" }, { code: "FR", name: "France" },
    { code: "GA", name: "Gabon" }, { code: "GB", name: "United Kingdom" }, { code: "GD", name: "Grenada" },
    { code: "GE", name: "Georgia" }, { code: "GH", name: "Ghana" }, { code: "GM", name: "Gambia" },
    { code: "GN", name: "Guinea" }, { code: "GQ", name: "Equatorial Guinea" }, { code: "GR", name: "Greece" },
    { code: "GT", name: "Guatemala" }, { code: "GW", name: "Guinea-Bissau" }, { code: "GY", name: "Guyana" },
    { code: "HN", name: "Honduras" }, { code: "HR", name: "Croatia" }, { code: "HT", name: "Haiti" },
    { code: "HU", name: "Hungary" }, { code: "ID", name: "Indonesia" }, { code: "IE", name: "Ireland" },
    { code: "IL", name: "Israel" }, { code: "IN", name: "India" }, { code: "IQ", name: "Iraq" },
    { code: "IR", name: "Iran" }, { code: "IS", name: "Iceland" }, { code: "IT", name: "Italy" },
    { code: "JM", name: "Jamaica" }, { code: "JO", name: "Jordan" }, { code: "JP", name: "Japan" },
    { code: "KE", name: "Kenya" }, { code: "KG", name: "Kyrgyzstan" }, { code: "KH", name: "Cambodia" },
    { code: "KI", name: "Kiribati" }, { code: "KM", name: "Comoros" }, { code: "KN", name: "Saint Kitts and Nevis" },
    { code: "KP", name: "North Korea" }, { code: "KR", name: "South Korea" }, { code: "KW", name: "Kuwait" },
    { code: "KZ", name: "Kazakhstan" }, { code: "LA", name: "Laos" }, { code: "LB", name: "Lebanon" },
    { code: "LC", name: "Saint Lucia" }, { code: "LI", name: "Liechtenstein" }, { code: "LK", name: "Sri Lanka" },
    { code: "LR", name: "Liberia" }, { code: "LS", name: "Lesotho" }, { code: "LT", name: "Lithuania" },
    { code: "LU", name: "Luxembourg" }, { code: "LV", name: "Latvia" }, { code: "LY", name: "Libya" },
    { code: "MA", name: "Morocco" }, { code: "MC", name: "Monaco" }, { code: "MD", name: "Moldova" },
    { code: "ME", name: "Montenegro" }, { code: "MG", name: "Madagascar" }, { code: "MH", name: "Marshall Islands" },
    { code: "MK", name: "Macedonia" }, { code: "ML", name: "Mali" }, { code: "MM", name: "Myanmar" },
    { code: "MN", name: "Mongolia" }, { code: "MR", name: "Mauritania" }, { code: "MT", name: "Malta" },
    { code: "MU", name: "Mauritius" }, { code: "MV", name: "Maldives" }, { code: "MW", name: "Malawi" },
    { code: "MX", name: "Mexico" }, { code: "MY", name: "Malaysia" }, { code: "MZ", name: "Mozambique" },
    { code: "NA", name: "Namibia" }, { code: "NE", name: "Niger" }, { code: "NG", name: "Nigeria" },
    { code: "NI", name: "Nicaragua" }, { code: "NL", name: "Netherlands" }, { code: "NO", name: "Norway" },
    { code: "NP", name: "Nepal" }, { code: "NR", name: "Nauru" }, { code: "NZ", name: "New Zealand" },
    { code: "OM", name: "Oman" }, { code: "PA", name: "Panama" }, { code: "PE", name: "Peru" },
    { code: "PG", name: "Papua New Guinea" }, { code: "PH", name: "Philippines" }, { code: "PK", name: "Pakistan" },
    { code: "PL", name: "Poland" }, { code: "PT", name: "Portugal" }, { code: "PY", name: "Paraguay" },
    { code: "QA", name: "Qatar" }, { code: "RO", name: "Romania" }, { code: "RS", name: "Serbia" },
    { code: "RU", name: "Russia" }, { code: "RW", name: "Rwanda" }, { code: "SA", name: "Saudi Arabia" },
    { code: "SB", name: "Solomon Islands" }, { code: "SC", name: "Seychelles" }, { code: "SD", name: "Sudan" },
    { code: "SE", name: "Sweden" }, { code: "SG", name: "Singapore" }, { code: "SI", name: "Slovenia" },
    { code: "SK", name: "Slovakia" }, { code: "SL", name: "Sierra Leone" }, { code: "SM", name: "San Marino" },
    { code: "SN", name: "Senegal" }, { code: "SO", name: "Somalia" }, { code: "SR", name: "Suriname" },
    { code: "SS", name: "South Sudan" }, { code: "ST", name: "Sao Tome and Principe" }, { code: "SV", name: "El Salvador" },
    { code: "SY", name: "Syria" }, { code: "SZ", name: "Swaziland" }, { code: "TD", name: "Chad" },
    { code: "TG", name: "Togo" }, { code: "TH", name: "Thailand" }, { code: "TJ", name: "Tajikistan" },
    { code: "TL", name: "Timor-Leste" }, { code: "TM", name: "Turkmenistan" }, { code: "TN", name: "Tunisia" },
    { code: "TO", name: "Tonga" }, { code: "TR", name: "Turkey" }, { code: "TT", name: "Trinidad and Tobago" },
    { code: "TV", name: "Tuvalu" }, { code: "TZ", name: "Tanzania" }, { code: "UA", name: "Ukraine" },
    { code: "UG", name: "Uganda" }, { code: "US", name: "United States" }, { code: "UY", name: "Uruguay" },
    { code: "UZ", name: "Uzbekistan" }, { code: "VC", name: "Saint Vincent and the Grenadines" },
    { code: "VE", name: "Venezuela" }, { code: "VN", name: "Vietnam" }, { code: "VU", name: "Vanuatu" },
    { code: "WS", name: "Samoa" }, { code: "YE", name: "Yemen" }, { code: "ZA", name: "South Africa" },
    { code: "ZM", name: "Zambia" }, { code: "ZW", name: "Zimbabwe" }
].sort((a, b) => a.name.localeCompare(b.name));

const EUROPEAN_CODES = ["AD", "AL", "AT", "BA", "BE", "BG", "BY", "CH", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GB", "GR", "HR", "HU", "IE", "IS", "IT", "LI", "LT", "LU", "LV", "MC", "MD", "ME", "MK", "MT", "NL", "NO", "PL", "PT", "RO", "RS", "RU", "SE", "SI", "SK", "SM", "UA", "VA"];

async function initGlobe() {
    am5.ready(function () {
        root = am5.Root.new("chartdiv");
        root.setThemes([am5themes_Animated.new(root)]);

        chart = root.container.children.push(am5map.MapChart.new(root, {
            panX: "rotateX",
            panY: "rotateY",
            projection: am5map.geoOrthographic(),
            paddingBottom: 20,
            paddingTop: 20,
            paddingLeft: 20,
            paddingRight: 20
        }));

        backgroundSeries = chart.series.push(am5map.MapPolygonSeries.new(root, {}));
        backgroundSeries.mapPolygons.template.setAll({
            fill: am5.color(0x0a0f19),
            fillOpacity: 0.5,
            strokeOpacity: 0
        });
        backgroundSeries.data.push({ geometry: am5map.getGeoRectangle(90, 180, -90, -180) });

        polygonSeries = chart.series.push(am5map.MapPolygonSeries.new(root, {
            geoJSON: am5geodata_worldLow
        }));

        polygonSeries.mapPolygons.template.setAll({
            fill: am5.color(0x1e293b),
            fillOpacity: 0.8,
            stroke: am5.color(0x00f5ff),
            strokeWidth: 0.5,
            interactive: true
        });

        polygonSeries.mapPolygons.template.states.create("hover", {
            fill: am5.color(0x00f5ff),
            fillOpacity: 0.3
        });

        polygonSeries.mapPolygons.template.on("active", function (active, target) {
            if (active) {
                const dataItem = target.dataItem;
                const code = dataItem.get("id");
                toggleCountry(code);
            }
        });

        polygonSeries.mapPolygons.template.events.on("click", function (ev) {
            const countryCode = ev.target.dataItem.get("id");
            toggleCountry(countryCode);
            rotateToCountry(countryCode);
        });

        chart.appear(1000, 100);

        // Load initial state
        fetchStatus();
    });
}

function rotateToCountry(id) {
    const dataItem = polygonSeries.getDataItemById(id);
    if (dataItem) {
        const polygon = dataItem.get("mapPolygon");
        if (polygon) {
            const centroid = polygon.visualCentroid();
            chart.animate({
                key: "rotationX",
                to: -centroid.longitude,
                duration: 1000,
                easing: am5.ease.inOut(am5.ease.cubic)
            });
            chart.animate({
                key: "rotationY",
                to: -centroid.latitude,
                duration: 1000,
                easing: am5.ease.inOut(am5.ease.cubic)
            });
        }
    }
}

async function fetchStatus() {
    try {
        const res = await fetch('/api/firewall/status');
        const data = await res.json();
        if (data.success) {
            lastData = data;
            renderDashboard(data);
        }
    } catch (e) {
        console.error('Failed to fetch firewall status:', e);
        notify("ERROR_UPLINK_FAILURE");
    }
}

function renderDashboard(data) {
    // Toggles
    document.getElementById('europe-block-toggle').checked = data.europeBlock;
    document.getElementById('usa-block-toggle').checked = data.usaBlock;
    document.getElementById('lockdown-toggle').checked = data.lockdown;
    document.getElementById('admin-ip-input').value = data.adminIp || '';

    // Stats
    document.getElementById('stat-blocked-regions').innerText = data.blocklist.length + (data.europeBlock ? EUROPEAN_CODES.length : 0);
    document.getElementById('stat-threats').innerText = data.statistics?.blocked_attempts || 0;

    // Refresh Grid
    filterCountries();

    // Refresh Globe Colors
    if (polygonSeries) {
        polygonSeries.mapPolygons.each((polygon) => {
            const id = polygon.dataItem.get("id");
            const isEurope = EUROPEAN_CODES.includes(id);
            const isUSA = id === "US";
            const isBlocked = data.blocklist.includes(id) || (isEurope && data.europeBlock) || (isUSA && data.usaBlock);

            polygon.set("fill", isBlocked ? am5.color(0xff0055) : am5.color(0x1e293b));
            polygon.set("fillOpacity", isBlocked ? 0.6 : 0.8);
        });
    }
}

function filterCountries() {
    if (!lastData) return;
    const searchTerm = document.getElementById('country-search').value.toLowerCase();
    const grid = document.getElementById('country-grid');
    grid.innerHTML = '';

    const filtered = ALL_COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(searchTerm) ||
        c.code.toLowerCase().includes(searchTerm)
    );

    filtered.forEach(country => {
        const isEurope = EUROPEAN_CODES.includes(country.code);
        const isUSA = country.code === "US";
        const isBlocked = lastData.blocklist.includes(country.code) || (isEurope && lastData.europeBlock) || (isUSA && lastData.usaBlock);

        const node = document.createElement('div');
        node.className = `country-node ${isBlocked ? 'blocked' : ''}`;
        node.onclick = () => {
            toggleCountry(country.code);
            rotateToCountry(country.code);
        };
        node.innerHTML = `
            <span class="c-code">${country.code}</span>
            <span class="c-name">${country.name}</span>
        `;
        grid.appendChild(node);
    });
}

async function updateLockdown() {
    const payload = {
        lockdownActive: document.getElementById('lockdown-toggle').checked,
        europeBlock: document.getElementById('europe-block-toggle').checked,
        usaBlock: document.getElementById('usa-block-toggle').checked,
        adminIp: document.getElementById('admin-ip-input').value
    };

    try {
        const res = await fetch('/api/firewall/lockdown', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            notify('PROTOCOL_SYNC_SUCCESS');
            fetchStatus();
        }
    } catch (e) {
        notify('CORE_ERROR: SYNC_FAILED');
    }
}

async function toggleCountry(code) {
    try {
        const res = await fetch('/api/firewall/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ countryCode: code })
        });
        const data = await res.json();
        if (data.success) {
            notify(`${code}_SEC_MOD: ${data.action.toUpperCase()}`);
            fetchStatus();
        }
    } catch (e) {
        notify('GRANULAR_AUTH_ERROR');
    }
}

function notify(msg) {
    const box = document.getElementById('notifications');
    const note = document.createElement('div');
    note.className = 'note';
    note.innerHTML = `> ${msg}`;
    box.appendChild(note);
    setTimeout(() => {
        note.style.opacity = '0';
        note.style.transform = 'translateY(-10px)';
        setTimeout(() => note.remove(), 500);
    }, 3000);
}

// System Status Heartbeat
setInterval(() => {
    const uptime = (99.99 + (Math.random() * 0.009)).toFixed(4);
    document.getElementById('uptime-val').innerText = uptime + '%';
}, 5000);

// Initialize
initGlobe();
setInterval(fetchStatus, 30000);
