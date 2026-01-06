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

// Realistic Schema
db.exec(`
    CREATE TABLE IF NOT EXISTS folders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS pastes (
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
    );

    CREATE TABLE IF NOT EXISTS paste_views (
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
    );

    CREATE TABLE IF NOT EXISTS paste_reactions (
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
        username TEXT,
        avatarUrl TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(pasteId) REFERENCES pastes(id) ON DELETE CASCADE
    );
`);

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
    { name: 'username', type: 'TEXT' },
    { name: 'avatarUrl', type: 'TEXT' },
    { name: 'hostname', type: 'TEXT' }
]);

// Ensure ALL analytics columns exist (CRITICAL FIX)
migrateTable('paste_views', [
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
    { name: 'hostname', type: 'TEXT' }
]);

// Ensure all paste columns exist
migrateTable('pastes', [
    { name: 'burnAfterRead', type: 'INTEGER DEFAULT 0' },
    { name: 'isPublic', type: 'INTEGER DEFAULT 1' },
    { name: 'expiresAt', type: 'DATETIME' },
    { name: 'folderId', type: 'TEXT' },
    { name: 'password', type: 'TEXT' },
    { name: 'embedUrl', type: 'TEXT' }
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
    { name: 'lastUsedAt', type: 'DATETIME' }
]);

// Ensure Users have display names
migrateTable('users', [
    { name: 'username', type: 'TEXT' },
    { name: 'displayName', type: 'TEXT' }
]);

console.log('✅ SQLite Database Migrations Complete (All columns verified)');

export default db;
