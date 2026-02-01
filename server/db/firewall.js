import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, '..', '..', 'data');

if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'firewall.db'));

// Initialize Schema
db.exec(`
    CREATE TABLE IF NOT EXISTS blocked_countries (
        country_code TEXT PRIMARY KEY
    );

    CREATE TABLE IF NOT EXISTS firewall_settings (
        key TEXT PRIMARY KEY,
        value TEXT
    );

    CREATE TABLE IF NOT EXISTS page_accesses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ip TEXT,
        path TEXT,
        method TEXT,
        country TEXT,
        country_code TEXT,
        region TEXT,
        city TEXT,
        lat REAL,
        lon REAL,
        isp TEXT,
        user_agent TEXT,
        proxy INTEGER DEFAULT 0,
        hosting INTEGER DEFAULT 0,
        is_blocked INTEGER DEFAULT 0,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

// Seed default settings if they don't exist
const seedSetting = db.prepare('INSERT OR IGNORE INTO firewall_settings (key, value) VALUES (?, ?)');
seedSetting.run('lockdown_active', '0');
seedSetting.run('admin_ip', '');

export default db;
