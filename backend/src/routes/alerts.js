
const express = require("express");
const router = express.Router();
const pool = require("../db");

// Get all alerts
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, title, detail, severity, is_resolved, created_at
       FROM plant_alerts
       ORDER BY created_at DESC`
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Fetch alerts error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch alerts.",
    });
  }
});

// Create a new alert
router.post("/", async (req, res) => {
  try {
    const { title, detail, severity } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({
        success: false,
        message: "Alert title is required.",
      });
    }

    const allowedSeverities = ["critical", "warning", "info"];
    const safeSeverity = allowedSeverities.includes(severity)
      ? severity
      : "info";

    const result = await pool.query(
      `INSERT INTO plant_alerts (title, detail, severity)
       VALUES ($1, $2, $3)
       RETURNING id, title, detail, severity, is_resolved, created_at`,
      [String(title).trim(), detail || "", safeSeverity]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: "Alert created successfully.",
    });
  } catch (error) {
    console.error("Create alert error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to create alert.",
    });
  }
});

// Resolve an alert and save the change to PostgreSQL
router.patch("/:id/resolve", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid alert ID.",
      });
    }

    const result = await pool.query(
      `UPDATE plant_alerts
       SET is_resolved = TRUE
       WHERE id = $1 AND is_resolved = FALSE
       RETURNING id, title, detail, severity, is_resolved, created_at`,
      [id]
    );

    if (result.rowCount === 0) {
      const existing = await pool.query(
        "SELECT id, is_resolved FROM plant_alerts WHERE id = $1",
        [id]
      );

      if (existing.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Alert not found.",
        });
      }

      return res.json({
        success: true,
        data: existing.rows[0],
        message: "This alert is already resolved.",
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: "Alert resolved successfully.",
    });
  } catch (error) {
    console.error("Resolve alert error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to resolve alert.",
    });
  }
});

module.exports = router;
