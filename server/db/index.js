import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, '..', '..', 'data');

if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'database.sqlite'));

// Initial Schema Creation - Broken down for better resilience
const initialTables = [
    {
        name: 'folders',
        sql: `CREATE TABLE IF NOT EXISTS folders (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
    },
    {
        name: 'pastes',
        sql: `CREATE TABLE IF NOT EXISTS pastes (
            id TEXT PRIMARY KEY,
            title TEXT,
            content TEXT,
            language TEXT DEFAULT 'plaintext',
            views INTEGER DEFAULT 0,
            isPublic INTEGER DEFAULT 1,
            burnAfterRead INTEGER DEFAULT 0,
            expiresAt DATETIME,
            folderId TEXT,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(folderId) REFERENCES folders(id) ON DELETE SET NULL
        )`
    },
    {
        name: 'paste_views',
        sql: `CREATE TABLE IF NOT EXISTS paste_views (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pasteId TEXT,
            ip TEXT,
            country TEXT,
            countryCode TEXT,
            region TEXT,
            regionName TEXT,
            city TEXT,
            zip TEXT,
            lat REAL,
            lon REAL,
            isp TEXT,
            org TEXT,
            asName TEXT,
            userAgent TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(pasteId) REFERENCES pastes(id) ON DELETE CASCADE
        )`
    },
    {
        name: 'paste_reactions',
        sql: `CREATE TABLE IF NOT EXISTS paste_reactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pasteId TEXT,
            type TEXT,
            ip TEXT,
            country TEXT,
            countryCode TEXT,
            region TEXT,
            regionName TEXT,
            city TEXT,
            zip TEXT,
            lat REAL,
            lon REAL,
            isp TEXT,
            org TEXT,
            asName TEXT,
            userAgent TEXT,
            discordId TEXT,
            userId TEXT,
            username TEXT,
            avatarUrl TEXT,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(pasteId) REFERENCES pastes(id) ON DELETE CASCADE
        )`
    },
    {
        name: 'page_accesses',
        sql: `CREATE TABLE IF NOT EXISTS page_accesses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            path TEXT NOT NULL,
            method TEXT DEFAULT 'GET',
            ip TEXT,
            country TEXT,
            countryCode TEXT,
            region TEXT,
            regionName TEXT,
            city TEXT,
            zip TEXT,
            lat REAL,
            lon REAL,
            isp TEXT,
            org TEXT,
            asName TEXT,
            userAgent TEXT,
            referrer TEXT,
            hostname TEXT,
            isBlocked INTEGER DEFAULT 0,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
    },
    {
        name: 'firewall_settings',
        sql: `CREATE TABLE IF NOT EXISTS firewall_settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )`
    }
];

initialTables.forEach(t => {
    try {
        db.exec(t.sql);
    } catch (e) {
        console.error(`❌ Failed to create table ${t.name}:`, e.message);
    }
});

// Create Missing Indices
try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_page_accesses_path ON page_accesses(path)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_page_accesses_timestamp ON page_accesses(timestamp)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_paste_views_pasteId ON paste_views(pasteId)`);
} catch (e) {
    console.error('❌ Failed to create indices:', e.message);
}

// Migration Helper
function migrateTable(tableName, columns) {
    try {
        const tableInfo = db.prepare(`PRAGMA table_info(${tableName})`).all();
        const existing = tableInfo.map(c => c.name.toLowerCase());

        columns.forEach(col => {
            if (!existing.includes(col.name.toLowerCase())) {
                console.log(`🔧 Migrating: Adding ${col.name} to ${tableName}`);
                db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${col.name} ${col.type}`);
            }
        });
    } catch (e) {
        console.warn(`Migration failed for ${tableName}:`, e.message);
    }
}

// Reaction User Info
migrateTable('paste_reactions', [
    { name: 'discordId', type: 'TEXT' },
    { name: 'userId', type: 'TEXT' },
    { name: 'username', type: 'TEXT' },
    { name: 'avatarUrl', type: 'TEXT' },
    { name: 'hostname', type: 'TEXT' }
]);

// Ensure ALL analytics columns exist (CRITICAL FIX)
const deepLocColumns = [
    { name: 'country', type: 'TEXT' },
    { name: 'countryCode', type: 'TEXT' },
    { name: 'region', type: 'TEXT' },
    { name: 'regionName', type: 'TEXT' },
    { name: 'city', type: 'TEXT' },
    { name: 'zip', type: 'TEXT' },
    { name: 'lat', type: 'REAL' },
    { name: 'lon', type: 'REAL' },
    { name: 'isp', type: 'TEXT' },
    { name: 'org', type: 'TEXT' },
    { name: 'asName', type: 'TEXT' },
    { name: 'userAgent', type: 'TEXT' },
    { name: 'hostname', type: 'TEXT' },
    { name: 'proxy', type: 'INTEGER' },
    { name: 'hosting', type: 'INTEGER' },
    { name: 'mobile', type: 'INTEGER' },
    { name: 'reverse', type: 'TEXT' },
    { name: 'isBlocked', type: 'INTEGER DEFAULT 0' },
    { name: 'district', type: 'TEXT' },
    { name: 'timezone', type: 'TEXT' },
    { name: 'currency', type: 'TEXT' }
];

migrateTable('paste_views', deepLocColumns);
migrateTable('paste_reactions', deepLocColumns);
migrateTable('page_accesses', deepLocColumns);

// Ensure all extra columns exist
migrateTable('page_accesses', [
    { name: 'referrer', type: 'TEXT' }
]);

// Ensure all paste columns exist
migrateTable('pastes', [
    { name: 'burnAfterRead', type: 'INTEGER DEFAULT 0' },
    { name: 'isPublic', type: 'INTEGER DEFAULT 1' },
    { name: 'expiresAt', type: 'DATETIME' },
    { name: 'folderId', type: 'TEXT' },
    { name: 'password', type: 'TEXT' },
    { name: 'embedUrl', type: 'TEXT' },
    { name: 'userId', type: 'TEXT' },
    { name: 'burned', type: 'INTEGER DEFAULT 0' }
]);

// Access Keys Table
db.exec(`
    CREATE TABLE IF NOT EXISTS access_keys (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        discordId TEXT,
        email TEXT,
        status TEXT DEFAULT 'active',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

// Blocked Countries Table
db.exec(`
    CREATE TABLE IF NOT EXISTS blocked_countries (
        countryCode TEXT PRIMARY KEY,
        countryName TEXT,
        status INTEGER DEFAULT 1, -- 1 = active block
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

// Users Table (Auth)
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        googleId TEXT,
        discordId TEXT,
        avatarUrl TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

// Link keys to users
migrateTable('access_keys', [
    { name: 'userId', type: 'TEXT' },
    { name: 'claimedIp', type: 'TEXT' },
    { name: 'claimedFingerprint', type: 'TEXT' },
    { name: 'lastUsedAt', type: 'DATETIME' }
]);

// Ensure Users have display names
migrateTable('users', [
    { name: 'username', type: 'TEXT' },
    { name: 'displayName', type: 'TEXT' }
]);

// Seed default Firewall Settings
try {
    const settings = [
        { key: 'lockdown_active', value: '0' },
        { key: 'europe_block', value: '0' },
        { key: 'usa_block', value: '0' }
    ];
    const stmt = db.prepare('INSERT OR IGNORE INTO firewall_settings (key, value) VALUES (?, ?)');
    settings.forEach(s => stmt.run(s.key, s.value));
} catch (e) {
    console.warn('Firewall seeding failed:', e.message);
}

console.log('✅ SQLite Database Migrations Complete (All columns verified)');

export default db;
