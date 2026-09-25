require("dotenv").config();
const express = require("express");
const cors = require("cors");
const pool = require("./db");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => res.json({ ok: true, service: "urgent-billing-api" }));

app.get("/api/health", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT 1 as db_ok");
    res.json({ ok: true, db: rows[0].db_ok === 1 });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`API running on http://localhost:${port}`));
