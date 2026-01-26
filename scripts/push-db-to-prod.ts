/**
 * Script to push local database to production
 * 
 * This script copies the local database file to the production Docker volume.
 * 
 * Usage:
 *   npm run push-db-to-prod
 * 
 * Or manually:
 *   npx tsx scripts/push-db-to-prod.ts
 */

import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const dbDir = join(process.cwd(), 'database');
const localDbPath = join(dbDir, 'wingspan.db');
const backupDbPath = join(dbDir, 'wingspan.db.backup');

console.log('🔄 Pushing local database to production...\n');

// Check if local database exists
if (!existsSync(localDbPath)) {
	console.error('❌ Local database not found at:', localDbPath);
	console.error('   Please ensure the database exists before pushing to production.');
	process.exit(1);
}

// Create backup of local database first
console.log('📦 Creating backup of local database...');
try {
	const dbContent = readFileSync(localDbPath);
	writeFileSync(backupDbPath, dbContent);
	console.log('   ✓ Backup created at:', backupDbPath);
} catch (error: any) {
	console.error('❌ Failed to create backup:', error.message);
	process.exit(1);
}

console.log('\n📋 Choose deployment method:\n');
console.log('1. Docker Compose (if using docker-compose.prod.yml)');
console.log('2. Dokploy (if using Dokploy platform)');
console.log('3. Manual Docker commands\n');

// For Docker Compose method
console.log('🐳 Docker Compose Method:');
console.log('   Run these commands:\n');
console.log('   # Stop the production container');
console.log('   docker-compose -f docker-compose.prod.yml stop app\n');
console.log('   # Copy database to container volume');
console.log(`   docker cp ${localDbPath} wingspan-score-prod:/app/database/wingspan.db\n`);
console.log('   # Or copy to volume directly (if volume is accessible)');
console.log('   # Find volume path:');
console.log('   docker volume inspect wingspan-score_wingspan-db-prod\n');
console.log('   # Start the container');
console.log('   docker-compose -f docker-compose.prod.yml start app\n');

// For Dokploy method
console.log('\n🚀 Dokploy Method:');
console.log('   Option 1: Via Dokploy UI');
console.log('   1. SSH into your Dokploy server');
console.log('   2. Find your container name:');
console.log('      docker ps | grep wingspan\n');
console.log('   3. Copy database to container:');
console.log(`      docker cp ${localDbPath} <container-name>:/app/database/wingspan.db\n`);
console.log('   4. Restart container via Dokploy UI or:');
console.log('      docker restart <container-name>\n');
console.log('   Option 2: Via Dokploy File Manager (if available)');
console.log('   1. Use Dokploy UI file manager');
console.log('   2. Upload database file to /app/database/wingspan.db');
console.log('   3. Restart the application\n');

// For manual Docker method
console.log('\n🔧 Manual Docker Method:');
console.log('   # Find your production container');
console.log('   docker ps | grep wingspan\n');
console.log('   # Copy database (replace <container-name> with actual name)');
console.log(`   docker cp ${localDbPath} <container-name>:/app/database/wingspan.db\n`);
console.log('   # Restart container');
console.log('   docker restart <container-name>\n');

console.log('⚠️  IMPORTANT NOTES:');
console.log('   - This will REPLACE the production database');
console.log('   - Make sure to backup production database first if needed');
console.log('   - The local database backup is saved at:', backupDbPath);
console.log('   - After pushing, verify the database in production\n');

console.log('✅ Local database is ready to push!');
console.log('   Follow the instructions above for your deployment method.\n');
