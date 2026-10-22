const express = require("express");
const router = express.Router();
const pool = require("../db");

// Get latest resource readings
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, power_kwh, water_litres, efficiency, recorded_at
      FROM resource_usage
      ORDER BY recorded_at DESC, id DESC
      LIMIT 1
    `);

    res.json({
      success: true,
      data: result.rows[0] || null,
    });
  } catch (error) {
    console.error("Resources API error:", error.message);
    res.status(500).json({
      success: false,
      message: "Unable to load resource data",
    });
  }
});

// Add a resource reading
router.post("/", async (req, res) => {
  try {
    const { power_kwh, water_litres, efficiency } = req.body;

    const power = Number(power_kwh);
    const water = Number(water_litres);
    const efficiencyValue = Number(efficiency);

    if (
      !Number.isFinite(power) ||
      !Number.isFinite(water) ||
      !Number.isFinite(efficiencyValue) ||
      power < 0 ||
      water < 0 ||
      efficiencyValue < 0 ||
      efficiencyValue > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Provide valid resource values; efficiency must be 0–100",
      });
    }

    const result = await pool.query(
      `INSERT INTO resource_usage
       (power_kwh, water_litres, efficiency)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [power, water, efficiencyValue]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Resources insert error:", error.message);
    res.status(500).json({
      success: false,
      message: "Unable to save resource data",
    });
  }
});

module.exports = router;