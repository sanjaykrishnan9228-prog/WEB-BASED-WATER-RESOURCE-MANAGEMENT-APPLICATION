const express = require("express");
const router = express.Router();
const pool = require("../db");

// Get all electrolyzers
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        equipment_code,
        name,
        technology,
        status,
        temperature,
        pressure,
        load_percent,
        created_at
      FROM electrolyzers
      ORDER BY id
    `);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error("Electrolyzers API error:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to retrieve electrolyzer data",
    });
  }
});

module.exports = router;