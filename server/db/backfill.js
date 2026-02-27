import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, '..', '..', 'data');
const db = new Database(path.join(dataDir, 'database.sqlite'));

const pastes = db.prepare('SELECT id, content FROM pastes').all();

const updateStmt = db.prepare('UPDATE pastes SET discordThumbnail = ? WHERE id = ?');

let count = 0;
for (const paste of pastes) {
    if (!paste.content) continue;

    // Extract first image
    const imgMatch = paste.content.match(/!\[.*?\]\((.*?)\)/i) || paste.content.match(/<img.*?src=["'](.*?)["']/i);
    if (imgMatch && imgMatch[1]) {
        updateStmt.run(imgMatch[1], paste.id);
        count++;
    }
}

console.log(`✅ Refreshed ${count} thumbnails from content.`);
process.exit(0);
