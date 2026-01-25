// Simple check using server's DB pattern
import db from '../server/db/index.js';

console.log('=== REACTION DATA CHECK ===\n');

try {
    const count = db.prepare('SELECT COUNT(*) as count FROM paste_reactions').get();
    console.log(`Total reactions in database: ${count.count}`);

    if (count.count === 0) {
        console.log('\n⚠️  NO REACTIONS FOUND - Data was cleared/lost.');
        console.log('Cannot restore without a backup.');
    } else {
        console.log('\n✅ Reactions exist! Showing sample:');
        const sample = db.prepare('SELECT * FROM paste_reactions LIMIT 20').all();
        sample.forEach(r => console.log(r));
    }
} catch (e) {
    console.error('Error:', e.message);
}
