# Production Database Migration Guide

## Problem
Database schema changes (like adding `display_name` and `platforms` columns) aren't automatically applied in production because:

1. **Database persists in Docker volume** - The database file survives container restarts
2. **initDatabase() may fail silently** - Error handling catches "duplicate column" errors, but SQLite error messages vary
3. **Container needs restart** - Code changes require container rebuild and restart

## Solution: Manual Migration (Recommended)

Since the migration script isn't in the production container yet, run the migration manually:

### Step 1: Run Migration via Node.js

SSH into your production server and run:

```bash
docker exec wingspan-score-prod node -e "
const Database = require('better-sqlite3');
const db = new Database('/app/database/wingspan.db');
db.pragma('foreign_keys = ON');

try {
  const tableInfo = db.prepare('PRAGMA table_info(users)').all();
  const columns = tableInfo.map(col => col.name);
  
  console.log('Current columns:', columns.join(', '));
  
  if (!columns.includes('display_name')) {
    db.exec('ALTER TABLE users ADD COLUMN display_name TEXT');
    console.log('✅ Added display_name column');
  } else {
    console.log('✓ display_name already exists');
  }
  
  if (!columns.includes('platforms')) {
    db.exec(\"ALTER TABLE users ADD COLUMN platforms TEXT DEFAULT '[]'\");
    db.exec(\"UPDATE users SET platforms = '[]' WHERE platforms IS NULL\");
    console.log('✅ Added platforms column');
  } else {
    console.log('✓ platforms already exists');
    db.exec(\"UPDATE users SET platforms = '[]' WHERE platforms IS NULL\");
  }
  
  const finalInfo = db.prepare('PRAGMA table_info(users)').all();
  console.log('\n📋 Final columns:');
  finalInfo.forEach(col => console.log('  -', col.name, '(' + col.type + ')'));
  
  db.close();
  console.log('\n✅ Migration complete!');
} catch (error) {
  console.error('❌ Error:', error.message);
  db.close();
  process.exit(1);
}
"
```

### Step 2: Verify Migration

```bash
docker exec wingspan-score-prod node -e "
const Database = require('better-sqlite3');
const db = new Database('/app/database/wingspan.db');
const info = db.prepare('PRAGMA table_info(users)').all();
console.log('Users table columns:');
info.forEach(col => console.log('  -', col.name));
db.close();
"
```

### Step 3: Restart Container

```bash
docker restart wingspan-score-prod
```

## Why initDatabase() Might Not Work

The `initDatabase()` function in `src/lib/utils/db.ts` tries to add columns, but:

1. **Error messages vary** - SQLite might return different error messages than expected
2. **Silent failures** - Errors are caught and only re-thrown if they don't contain "duplicate column"
3. **Timing** - If the database is locked or in use, the migration might fail

## Future: Automatic Migration

After deploying the new code with the migration script, you can use:

```bash
docker exec wingspan-score-prod npm run migrate-profile
```

But this requires:
1. Code to be deployed (with the migration script)
2. Container to be rebuilt
3. Migration script to be available in the container

## Alternative: Check initDatabase() Logs

To see if `initDatabase()` is running and what errors it encounters:

```bash
docker logs wingspan-score-prod | grep -i "database\|migration\|error"
```

Or check all recent logs:

```bash
docker logs --tail 100 wingspan-score-prod
```

## Quick Fix Summary

1. **Run manual migration** (Node.js one-liner above)
2. **Verify columns exist** (verification command above)
3. **Restart container** (`docker restart wingspan-score-prod`)
4. **Test the application** (try editing profile)
