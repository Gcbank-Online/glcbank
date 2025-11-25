// init-db.js
// Simple migration runner: initializes DB if no public tables exist.
const fs = require('fs');
const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function runMigrations() {
  try {
    await client.connect();
    console.log("🔄 Checking database...");

    const res = await client.query(`
      SELECT COUNT(*)
      FROM information_schema.tables
      WHERE table_schema = 'public';
    `);

    if (parseInt(res.rows[0].count) === 0) {
      console.log("📦 No tables found. Initializing database...");
      const sql = fs.readFileSync("/usr/src/app/001_schema.sql", "utf8");
      await client.query(sql);
      console.log("✅ Database initialized successfully!");
    } else {
      console.log("✅ Database already initialized. Skipping migration.");
    }
  } catch (err) {
    console.error("❌ Error initializing database:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
