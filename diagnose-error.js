// Quick Diagnostic - Run this to check for errors
// Usage: node diagnose-error.js

import db from './server/db/index.js';

console.log('🔍 Running diagnostics...\n');

try {
    // Test 1: Database connection
    console.log('1️⃣ Testing database connection...');
    const testQuery = db.prepare('SELECT 1 as test').get();
    console.log('   ✅ Database connected:', testQuery);

    // Test 2: Check tables exist
    console.log('\n2️⃣ Checking tables...');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('   📋 Tables found:', tables.map(t => t.name).join(', '));

    // Test 3: Check paste_views structure
    console.log('\n3️⃣ Checking paste_views columns...');
    const viewCols = db.prepare('PRAGMA table_info(paste_views)').all();
    console.log('   Columns:', viewCols.map(c => c.name).join(', '));

    // Test 4: Check for data
    console.log('\n4️⃣ Checking data...');
    const viewCount = db.prepare('SELECT COUNT(*) as count FROM paste_views').get();
    const pasteCount = db.prepare('SELECT COUNT(*) as count FROM pastes').get();
    console.log(`   📊 Views: ${viewCount.count}, Pastes: ${pasteCount.count}`);

    // Test 5: Test top cities query
    console.log('\n5️⃣ Testing top cities query...');
    const cities = db.prepare(`
        SELECT city, country, COUNT(*) as count
        FROM paste_views
        WHERE city IS NOT NULL AND city != ''
        GROUP BY city, country
        ORDER BY count DESC
        LIMIT 5
    `).all();
    console.log('   🏙️ Top cities:', cities.length > 0 ? cities : 'No city data');

    console.log('\n✅ All diagnostics passed!');
    console.log('\n💡 If you\'re still getting errors, please share:');
    console.log('   1. The exact error message');
    console.log('   2. What action triggered it');
    console.log('   3. Server console output');

} catch (error) {
    console.error('\n❌ DIAGNOSTIC ERROR:', error.message);
    console.error('Stack:', error.stack);
}
