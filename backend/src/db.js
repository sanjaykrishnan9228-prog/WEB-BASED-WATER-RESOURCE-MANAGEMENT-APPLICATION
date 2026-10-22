require("dotenv").config();

const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || "hydropulse",
  user: process.env.DB_USER || process.env.USER,
  password: process.env.DB_PASSWORD || "",
});

pool.on("error", (error) => {
  console.error("PostgreSQL error:", error.message);
});

module.exports = pool;npm run dev