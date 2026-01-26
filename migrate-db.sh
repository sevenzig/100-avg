#!/bin/bash
# Database migration script for production
# Run with: docker exec wingspan-score-prod sh /tmp/migrate-db.sh

docker exec wingspan-score-prod node -e '
const Database = require("better-sqlite3");
const db = new Database("/app/database/wingspan.db");
db.pragma("foreign_keys = ON");

try {
  const tableInfo = db.prepare("PRAGMA table_info(users)").all();
  const columns = tableInfo.map(col => col.name);
  
  console.log("Current columns:", columns.join(", "));
  
  if (!columns.includes("display_name")) {
    db.exec("ALTER TABLE users ADD COLUMN display_name TEXT");
    console.log("✅ Added display_name column");
  } else {
    console.log("✓ display_name already exists");
  }
  
  if (!columns.includes("platforms")) {
    db.exec("ALTER TABLE users ADD COLUMN platforms TEXT DEFAULT '\''[]'\''");
    db.exec("UPDATE users SET platforms = '\''[]'\'' WHERE platforms IS NULL");
    console.log("✅ Added platforms column");
  } else {
    console.log("✓ platforms already exists");
    db.exec("UPDATE users SET platforms = '\''[]'\'' WHERE platforms IS NULL");
  }
  
  const finalInfo = db.prepare("PRAGMA table_info(users)").all();
  console.log("\n📋 Final columns:");
  finalInfo.forEach(col => console.log("  -", col.name, "(" + col.type + ")"));
  
  db.close();
  console.log("\n✅ Migration complete!");
} catch (error) {
  console.error("❌ Error:", error.message);
  db.close();
  process.exit(1);
}
'
