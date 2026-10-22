const express = require("express");
const router = express.Router();
const pool = require("../db");

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) AS total_units,
        COUNT(*) FILTER (WHERE status = 'Running') AS running_units,
        COUNT(*) FILTER (WHERE status = 'Warning') AS warning_units
      FROM electrolyzers
    `);

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Dashboard API error:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to load dashboard data.",
      error: error.message,
    });
  }
});

module.exports = router;