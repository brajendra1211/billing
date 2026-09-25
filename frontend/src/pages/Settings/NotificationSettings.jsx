import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { notificationsApi } from "../../api/notifications.api";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const KIND_LABEL = {
  INVOICE_EMAIL: "Invoice email",
  INVOICE_REMINDER: "Payment reminder",
  RENEWAL_ALERT: "Renewal alert",
  RENEWAL_INVOICE: "Renewal invoice",
};

function StatusPill({ status }) {
  const s = String(status || "").toUpperCase();
  const cls =
    s === "SENT"
      ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
      : s === "FAILED"
        ? "bg-red-100 text-red-700 hover:bg-red-100"
        : "bg-slate-100 text-slate-700 hover:bg-slate-100";
  return <Badge className={`rounded-full ${cls}`}>{s}</Badge>;
}

function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="flex items-start gap-3 rounded-xl border p-3 cursor-pointer">
      <input
        type="checkbox"
        className="mt-1 h-4 w-4"
        checked={Boolean(checked)}
        onChange={(e) => onChange(e.target.checked ? 1 : 0)}
      />
      <div>
        <div className="font-medium text-sm">{label}</div>
        {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
      </div>
    </label>
  );
}

export default function NotificationSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState(null);
  const [form, setForm] = useState(null);
  const [log, setLog] = useState([]);
  const [testTo, setTestTo] = useState("");
  const [lastRun, setLastRun] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [s, l] = await Promise.all([notificationsApi.getSettings(), notificationsApi.log({ limit: 50 })]);
      setStatus(s.data.status);
      setForm(s.data.settings);
      setLog(l.data || []);
      setTestTo((prev) => prev || s.data.status.company_email || "");
    } catch (e) {
      alert(e?.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await notificationsApi.saveSettings({
        auto_reminders: form.auto_reminders,
        reminder_days: form.reminder_days,
        renewal_alerts: form.renewal_alerts,
        renewal_auto_invoice: form.renewal_auto_invoice,
        renewal_invoice_days_before: Number(form.renewal_invoice_days_before || 0),
      });
      setForm(res.data);
      alert("Settings saved ✅");
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    } finally {
      setSaving(false);
    }
  };

  const runNow = async () => {
    if (!confirm("Abhi saare reminders / renewal alerts / auto-invoices chalayein?")) return;
    setRunning(true);
    try {
      const res = await notificationsApi.runNow();
      setLastRun(res.data);
      await load();
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    } finally {
      setRunning(false);
    }
  };

  const testEmail = async () => {
    setTesting(true);
    try {
      const res = await notificationsApi.testEmail(testTo);
      alert(`Test email sent to ${res.data.to} ✅`);
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    } finally {
      setTesting(false);
    }
  };

  if (loading && !form) return <div className="text-sm text-muted-foreground">Loading...</div>;
  if (!form) return <div className="text-sm text-muted-foreground">Could not load settings</div>;

  return (
    <div className="w-full max-w-[1100px] mx-auto space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Reminders & Alerts</h2>
          <div className="text-sm text-muted-foreground">
            Rozana subah 9 baje apne aap chalta hai: payment reminders, renewal alerts aur renewal invoices.
          </div>
        </div>
        <Button onClick={runNow} disabled={running}>
          {running ? "Running..." : "Run now"}
        </Button>
      </div>

      {/* Setup status */}
      <div className="grid gap-3 md:grid-cols-2">
        <Card className="rounded-2xl">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-medium">Email (SMTP)</div>
              {status.smtp_configured ? (
                <Badge className="rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Connected</Badge>
              ) : (
                <Badge className="rounded-full bg-amber-100 text-amber-800 hover:bg-amber-100">Not configured</Badge>
              )}
            </div>
            {status.smtp_configured ? (
              <>
                <div className="text-sm text-muted-foreground">From: {status.mail_from}</div>
                <div className="flex gap-2">
                  <Input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="test@example.com" />
                  <Button variant="outline" onClick={testEmail} disabled={testing}>
                    {testing ? "Sending..." : "Send test"}
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">
                <code>backend/.env</code> mein <code>SMTP_HOST</code>, <code>SMTP_USER</code>, <code>SMTP_PASS</code> set
                karke backend restart karein. Tab tak emails nahi jayengi.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-medium">UPI QR on invoice</div>
              {status.upi_valid ? (
                <Badge className="rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Active</Badge>
              ) : (
                <Badge className="rounded-full bg-amber-100 text-amber-800 hover:bg-amber-100">Invalid UPI ID</Badge>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              UPI ID: <b className="text-foreground">{status.upi_id || "—"}</b>
            </div>
            {!status.upi_valid && (
              <div className="text-sm text-muted-foreground">
                UPI ID <code>name@bank</code> format mein honi chahiye (jaise <code>9876543210@ybl</code>).{" "}
                <Link to="/settings/company" className="underline">Company Settings</Link> mein theek karein.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {lastRun && (
        <Card className="rounded-2xl">
          <CardContent className="p-5 text-sm space-y-1">
            <div className="font-medium">Last run result</div>
            {lastRun.reminders && (
              <div>
                Payment reminders — sent {lastRun.reminders.sent}, skipped {lastRun.reminders.skipped}, failed{" "}
                {lastRun.reminders.failed}
              </div>
            )}
            {lastRun.renewals && (
              <div>
                Renewals — invoices created {lastRun.renewals.invoices_created}, alerts sent {lastRun.renewals.alerts_sent},
                failed {lastRun.renewals.failed}
              </div>
            )}
            {!lastRun.reminders && !lastRun.renewals && <div>Kuch bhi enabled nahi hai.</div>}
            {(lastRun.notes || []).map((n) => (
              <div key={n} className="text-amber-700">{n}</div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Settings */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Automatic settings</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Toggle
                  checked={form.auto_reminders}
                  onChange={(v) => set("auto_reminders", v)}
                  label="Overdue payment reminders (email)"
                  hint="Sirf un invoices pe jo customer ko bheje ja chuke hain (Email/WhatsApp) aur jinka payment baaki hai."
                />
                <div className="grid gap-2 pl-1">
                  <Label>Due date ke kitne din baad (comma separated)</Label>
                  <Input
                    value={form.reminder_days}
                    onChange={(e) => set("reminder_days", e.target.value)}
                    placeholder="3,7,15"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Toggle
                  checked={form.renewal_auto_invoice}
                  onChange={(v) => set("renewal_auto_invoice", v)}
                  label="Renewal se auto-invoice (DRAFT)"
                  hint="Renewal due hone se pehle customer ke naam DRAFT invoice apne aap ban jayega."
                />
                <div className="grid gap-2 pl-1">
                  <Label>Due date se kitne din pehle invoice banaye</Label>
                  <Input
                    type="number"
                    min={0}
                    max={60}
                    value={form.renewal_invoice_days_before}
                    onChange={(e) => set("renewal_invoice_days_before", e.target.value)}
                  />
                </div>
              </div>

              <Toggle
                checked={form.renewal_alerts}
                onChange={(v) => set("renewal_alerts", v)}
                label="Renewal expiry alerts (email)"
                hint="Har renewal ke 'remind before days' ke hisaab se customer ko email (company ko BCC). Invoice bana ho to PDF attach hoga."
              />
            </div>

            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save settings"}</Button>
          </form>
        </CardContent>
      </Card>

      {/* Log */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Recent activity</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {log.length === 0 ? (
            <div className="text-sm text-muted-foreground">Abhi tak kuch nahi bheja gaya.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2 pr-4">When</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">For</th>
                  <th className="py-2 pr-4">To</th>
                  <th className="py-2 pr-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {log.map((l) => (
                  <tr key={l.id} className="border-b last:border-0 align-top">
                    <td className="py-2 pr-4 whitespace-nowrap">{String(l.created_at).slice(0, 16)}</td>
                    <td className="py-2 pr-4">{KIND_LABEL[l.kind] || l.kind}</td>
                    <td className="py-2 pr-4">
                      {l.entity_type === "INVOICE" ? (
                        <Link className="underline" to={`/invoices/${l.entity_id}`}>
                          {l.invoice_no || `Invoice #${l.entity_id}`}
                        </Link>
                      ) : (
                        <Link className="underline" to={`/renewals/${l.entity_id}`}>
                          {l.renewal_name || `Renewal #${l.entity_id}`}
                        </Link>
                      )}
                    </td>
                    <td className="py-2 pr-4">{l.recipient || "—"}</td>
                    <td className="py-2 pr-4">
                      <StatusPill status={l.status} />
                      {l.error && <div className="text-xs text-red-600 mt-1 max-w-[280px]">{l.error}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
