/**
 * SYSTEM FIREWALL v4.0 Controller
 */

const EUROPEAN_COUNTRIES = [
    { code: 'AD', name: 'Andorra' }, { code: 'AL', name: 'Albania' }, { code: 'AT', name: 'Austria' },
    { code: 'AX', name: 'Aland Islands' }, { code: 'BA', name: 'Bosnia' }, { code: 'BE', name: 'Belgium' },
    { code: 'BG', name: 'Bulgaria' }, { code: 'BY', name: 'Belarus' }, { code: 'CH', name: 'Switzerland' },
    { code: 'CZ', name: 'Czechia' }, { code: 'DE', name: 'Germany' }, { code: 'DK', name: 'Denmark' },
    { code: 'EE', name: 'Estonia' }, { code: 'ES', name: 'Spain' }, { code: 'FI', name: 'Finland' },
    { code: 'FO', name: 'Faroe Islands' }, { code: 'FR', name: 'France' }, { code: 'GB', name: 'UK' },
    { code: 'GG', name: 'Guernsey' }, { code: 'GI', name: 'Gibraltar' }, { code: 'GR', name: 'Greece' },
    { code: 'HR', name: 'Croatia' }, { code: 'HU', name: 'Hungary' }, { code: 'IE', name: 'Ireland' },
    { code: 'IM', name: 'Isle of Man' }, { code: 'IS', name: 'Iceland' }, { code: 'IT', name: 'Italy' },
    { code: 'JE', name: 'Jersey' }, { code: 'LI', name: 'Liechtenstein' }, { code: 'LT', name: 'Lithuania' },
    { code: 'LU', name: 'Luxembourg' }, { code: 'LV', name: 'Latvia' }, { code: 'MC', name: 'Monaco' },
    { code: 'MD', name: 'Moldova' }, { code: 'ME', name: 'Montenegro' }, { code: 'MK', name: 'N. Macedonia' },
    { code: 'MT', name: 'Malta' }, { code: 'NL', name: 'Netherlands' }, { code: 'NO', name: 'Norway' },
    { code: 'PL', name: 'Poland' }, { code: 'PT', name: 'Portugal' }, { code: 'RO', name: 'Romania' },
    { code: 'RS', name: 'Serbia' }, { code: 'RU', name: 'Russia' }, { code: 'SE', name: 'Sweden' },
    { code: 'SI', name: 'Slovenia' }, { code: 'SJ', name: 'Svalbard' }, { code: 'SK', name: 'Slovakia' },
    { code: 'SM', name: 'San Marino' }, { code: 'UA', name: 'Ukraine' }, { code: 'VA', name: 'Vatican' }
];

// Full global list for the dropdown
const ALL_COUNTRIES = [...EUROPEAN_COUNTRIES,
{ code: 'US', name: 'United States' }, { code: 'CA', name: 'Canada' }, { code: 'AU', name: 'Australia' },
{ code: 'CN', name: 'China' }, { code: 'BR', name: 'Brazil' }, { code: 'IN', name: 'India' },
{ code: 'JP', name: 'Japan' }, { code: 'KR', name: 'South Korea' }
].sort((a, b) => a.name.localeCompare(b.name));

async function fetchStatus() {
    try {
        const res = await fetch('/api/firewall/status');
        const data = await res.json();
        if (data.success) {
            renderDashboard(data);
        }
    } catch (e) {
        console.error('Failed to fetch firewall status:', e);
    }
}

function renderDashboard(data) {
    // Toggles
    document.getElementById('europe-block-toggle').checked = data.europeBlock;
    document.getElementById('usa-block-toggle').checked = data.usaBlock;
    document.getElementById('lockdown-toggle').checked = data.lockdown;
    document.getElementById('admin-ip-input').value = data.adminIp || '';

    // Style toggle cards
    document.getElementById('europe-block-toggle').closest('.toggle-card').classList.toggle('blocked', data.europeBlock);
    document.getElementById('usa-block-toggle').closest('.toggle-card').classList.toggle('blocked', data.usaBlock);

    // Stats
    document.getElementById('stat-blocked-regions').innerText = data.blocklist.length + (data.europeBlock ? 50 : 0);
    document.getElementById('stat-threats').innerText = data.statistics?.blocked_attempts || 0;

    // Country Grid
    const grid = document.getElementById('country-grid');
    grid.innerHTML = '';

    EUROPEAN_COUNTRIES.forEach(country => {
        const isBlocked = data.blocklist.includes(country.code) || data.europeBlock;
        const node = document.createElement('div');
        node.className = `country-node ${isBlocked ? 'blocked' : ''}`;
        node.onclick = () => toggleCountry(country.code);
        node.innerHTML = `
            <span class="code">${country.code}</span>
            <span class="name">${country.name}</span>
        `;
        grid.appendChild(node);
    });

    // Populate Dropdown
    const select = document.getElementById('country-toggle-select');
    if (select.options.length <= 1) {
        ALL_COUNTRIES.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.code;
            const isBlocked = data.blocklist.includes(c.code);
            opt.innerText = `${c.name} (${c.code}) ${isBlocked ? '[BLOCKED]' : ''}`;
            select.appendChild(opt);
        });
    }
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
            notify('FIREWALL_PROTOCOL_UPDATED');
            fetchStatus();
        }
    } catch (e) {
        notify('CORE_ERROR: UPDATE_FAILED');
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
            notify(`${code}_PROTOCOL_${data.action.toUpperCase()}`);
            fetchStatus();
        }
    } catch (e) {
        notify('GRANULAR_AUTH_ERROR');
    }
}

function toggleCountryFromSelect() {
    const select = document.getElementById('country-toggle-select');
    if (select.value) {
        toggleCountry(select.value);
        select.value = '';
    }
}

function notify(msg) {
    const box = document.getElementById('notifications');
    const note = document.createElement('div');
    note.className = 'note';
    note.style.fontFamily = 'monospace';
    note.style.fontSize = '12px';
    note.style.color = '#00f5ff';
    note.style.background = 'rgba(0,0,0,0.8)';
    note.style.padding = '10px 20px';
    note.style.borderRadius = '5px';
    note.style.border = '1px solid #00f5ff';
    note.style.marginBottom = '10px';
    note.innerText = `> ${msg}`;
    box.appendChild(note);
    setTimeout(() => note.remove(), 3000);
}

// Global notification area styles
const style = document.createElement('style');
style.innerHTML = `
#notifications {
    position: fixed;
    bottom: 20px;
    left: 20px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
}
`;
document.head.appendChild(style);

// Initial Load
fetchStatus();
setInterval(fetchStatus, 30000); // Auto-refresh metrics every 30s
