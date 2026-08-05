require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
// First check what enum values exist for role
pool.query(`SELECT DISTINCT role FROM employee ORDER BY role`)
.then(r => {
  console.log('Role values:', r.rows.map(x => x.role));
  pool.end();
}).catch(e => { console.error(e.message); pool.end(); });
