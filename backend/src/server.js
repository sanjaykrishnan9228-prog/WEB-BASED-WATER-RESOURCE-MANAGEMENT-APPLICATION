require("dotenv").config();

const express = require("express");
const cors = require("cors");
const pool = require("./db");

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    name: "HydroPulse API",
    status: "running",
  });
});

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      success: true,
      message: "HydroPulse API and PostgreSQL are connected",
    });
  } catch (error) {
    console.error("Database health error:", error.message);

    res.status(503).json({
      success: false,
      message: "PostgreSQL connection failed",
    });
  }
});

app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api/electrolyzers", require("./routes/electrolyzers"));
app.use("/api/production", require("./routes/production"));
app.use("/api/resources", require("./routes/resources"));
app.use("/api/alerts", require("./routes/alerts"));


app.listen(PORT, () => {
  console.log(`HydroPulse API running at http://localhost:${PORT}`);
});