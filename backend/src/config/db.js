const mysql = require("mysql2/promise");
const { DB_HOST, DB_USER, DB_PASS, DB_NAME, DB_PORT } = require("./env");

const pool = mysql.createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASS,
  database: DB_NAME,
  port: DB_PORT,
  // Return DATE/DATETIME as plain strings ("YYYY-MM-DD") instead of JS Date objects,
  // otherwise dates get shifted by the IST->UTC offset when serialized to JSON.
  dateStrings: true,
  waitForConnections: true,
  connectionLimit: 10,
});

module.exports = pool;
