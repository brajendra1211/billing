const app = require("./app");
const { PORT } = require("./config/env");
const { startScheduler } = require("./jobs/scheduler");

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
  startScheduler();
});
