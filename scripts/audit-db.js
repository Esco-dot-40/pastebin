
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, '..', 'data', 'database.sqlite'));

try {
    console.log('--- TABLE LIST ---');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log(tables.map(t => t.name).join(', '));

    for (const table of tables) {
        console.log(`\n--- SCHEMA: ${table.name} ---`);
        const schema = db.prepare(`PRAGMA table_info(${table.name})`).all();
        console.log(schema.map(c => `${c.name} (${c.type})`).join(', '));

        const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get().count;
        console.log(`Row count: ${count}`);
    }

    console.log('\n--- LATEST PASTES ---');
    const pastes = db.prepare('SELECT id, title, isPublic, createdAt FROM pastes ORDER BY createdAt DESC LIMIT 5').all();
    console.log(pastes);

} catch (err) {
    console.error('Diagnostic error:', err);
} finally {
    db.close();
}
