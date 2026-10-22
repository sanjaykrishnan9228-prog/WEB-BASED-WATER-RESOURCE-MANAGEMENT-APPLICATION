const express = require("express");
const router = express.Router();
const pool = require("../db");

// Get latest production readings
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, hydrogen_kg, target_kg, production_rate, recorded_at
      FROM production_logs
      ORDER BY recorded_at DESC, id DESC
      LIMIT 1
    `);

    res.json({
      success: true,
      data: result.rows[0] || null,
    });
  } catch (error) {
    console.error("Production API error:", error.message);
    res.status(500).json({
      success: false,
      message: "Unable to load production data",
    });
  }
});

// Add a production reading
router.post("/", async (req, res) => {
  try {
    const { hydrogen_kg, target_kg, production_rate } = req.body;

    if (
      !Number.isFinite(Number(hydrogen_kg)) ||
      !Number.isFinite(Number(target_kg)) ||
      !Number.isFinite(Number(production_rate)) ||
      Number(hydrogen_kg) < 0 ||
      Number(target_kg) < 0 ||
      Number(production_rate) < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Provide valid non-negative production values",
      });
    }

    const result = await pool.query(
      `INSERT INTO production_logs
       (hydrogen_kg, target_kg, production_rate)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [hydrogen_kg, target_kg, production_rate]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Production insert error:", error.message);
    res.status(500).json({
      success: false,
      message: "Unable to save production data",
    });
  }
});

module.exports = router;