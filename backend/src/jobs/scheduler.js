const cron = require("node-cron");
const notifications = require("../modules/notifications/notifications.service");

// Daily run: overdue invoice reminders + renewal auto-invoices + renewal expiry alerts.
// Schedule is configurable via NOTIFY_CRON (default 9:00 AM IST). Set DISABLE_CRON=1 to turn off.
function startScheduler() {
  if (String(process.env.DISABLE_CRON || "") === "1") {
    console.log("[scheduler] disabled (DISABLE_CRON=1)");
    return;
  }
  const expr = process.env.NOTIFY_CRON || "0 9 * * *";
  cron.schedule(
    expr,
    async () => {
      console.log("[scheduler] daily notifications run started");
      try {
        const results = await notifications.runDailyJobs();
        console.log("[scheduler] done:", JSON.stringify(results));
      } catch (e) {
        console.error("[scheduler] failed:", e);
      }
    },
    { timezone: "Asia/Kolkata" }
  );
  console.log(`[scheduler] daily notifications scheduled: "${expr}" (Asia/Kolkata)`);
}

module.exports = { startScheduler };
