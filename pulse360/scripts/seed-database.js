const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required to seed the database.");
  }

  const seedPath = path.join(__dirname, "..", "prisma", "seed.sql");
  const sql = fs.readFileSync(seedPath, "utf8");
  const client = new Client({ connectionString });

  await client.connect();

  try {
    await client.query(sql);
    console.log("Database seed completed.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
