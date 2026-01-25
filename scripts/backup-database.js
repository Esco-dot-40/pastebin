#!/usr/bin/env node
/**
 * MANUAL DATABASE BACKUP SCRIPT
 * Run this before making any dangerous changes to your database
 * Usage: node scripts/backup-database.js [optional-backup-name]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, '..', 'data');
const backupDir = path.join(__dirname, '..', 'backups');
const dbPath = path.join(dataDir, 'database.sqlite');

// Create backup directory if it doesn't exist
if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
    console.log('✅ Created backups directory');
}

// Generate backup filename
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const customName = process.argv[2] ? `-${process.argv[2]}` : '';
const backupFilename = `database-backup-${timestamp}${customName}.sqlite`;
const backupPath = path.join(backupDir, backupFilename);

try {
    // Check if source database exists
    if (!fs.existsSync(dbPath)) {
        console.error('❌ Source database not found:', dbPath);
        process.exit(1);
    }

    // Get database file size
    const stats = fs.statSync(dbPath);
    const fileSizeKB = (stats.size / 1024).toFixed(2);

    console.log('\n🔄 Starting database backup...');
    console.log(`📂 Source: ${dbPath} (${fileSizeKB} KB)`);
    console.log(`💾 Backup: ${backupFilename}`);

    // Copy the database file
    fs.copyFileSync(dbPath, backupPath);

    // Verify backup
    const backupStats = fs.statSync(backupPath);
    if (backupStats.size === stats.size) {
        console.log(`✅ Backup created successfully! (${(backupStats.size / 1024).toFixed(2)} KB)`);
        console.log(`📍 Location: ${backupPath}\n`);

        // List all backups
        const backups = fs.readdirSync(backupDir)
            .filter(f => f.endsWith('.sqlite'))
            .sort()
            .reverse();

        console.log(`📚 Total backups: ${backups.length}`);
        if (backups.length > 10) {
            console.log(`⚠️  You have ${backups.length} backups. Consider running cleanup.`);
        }
    } else {
        console.error('❌ Backup verification failed - size mismatch');
        process.exit(1);
    }
} catch (error) {
    console.error('❌ Backup failed:', error.message);
    process.exit(1);
}
