import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { paymentPlansApi } from "../../api/paymentPlans.api";
import { useAuth } from "../../context/AuthContext";
import { money, fmtDate } from "./planUtils";
import MilestoneStatus from "./MilestoneStatus";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

async function openPdf(url) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || `PDF failed (${res.status})`);
  }
  window.open(URL.createObjectURL(await res.blob()), "_blank");
}

export default function PaymentPlanView() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const role = String(user?.role || localStorage.getItem("role") || "").toUpperCase();
  const canEdit = role === "ADMIN" || role === "STAFF";

  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(null); // milestone id being worked on
  const [emailFor, setEmailFor] = useState(null); // milestone for the email form
  const [emailForm, setEmailForm] = useState({ to: "", cc: "", message: "" });

  const load = async () => {
    try {
      const res = await paymentPlansApi.get(id);
      setData(res.data);
    } catch (e) {
      alert(e?.response?.data?.error || e.message);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [id]);

  const run = async (mid, fn) => {
    setBusy(mid);
    try {
      await fn();
    } catch (e) {
      alert(e?.response?.data?.error || e.message);
    } finally {
      setBusy(null);
    }
  };

  const viewDemand = (m) => run(m.id, async () => {
    await openPdf(paymentPlansApi.demandPdfUrl(m.id));
    await load(); // demand number may have just been assigned
  });

  const openEmail = (m) => {
    setEmailFor(m);
    setEmailForm({ to: data.plan.customer_email || "", cc: "", message: "" });
  };

  const sendEmail = (e) => {
    e.preventDefault();
    run(emailFor.id, async () => {
      const res = await paymentPlansApi.sendDemandEmail(emailFor.id, {
        to: emailForm.to || null,
        cc: emailForm.cc || null,
        message: emailForm.message || null,
      });
      setEmailFor(null);
      await load();
      alert(`Demand letter ${res.data.demand_no} bhej diya ✅ (${res.data.to})`);
    });
  };

  const sendWhatsapp = (m) => {
    const win = window.open("", "_blank"); // open now so the popup isn't blocked
    run(m.id, async () => {
      try {
        const res = await paymentPlansApi.demandWhatsapp(m.id);
        if (win) win.location.href = res.data.url;
        else window.open(res.data.url, "_blank");
        await load();
      } catch (e) {
        if (win) win.close();
        throw e;
      }
    });
  };

  const createInvoice = (m) => {
    if (!confirm(`Milestone "${m.title}" ka GST tax invoice banayein? (${money(m.amount)} + GST)`)) return;
    run(m.id, async () => {
      const res = await paymentPlansApi.createInvoice(m.id);
      await load();
      if (confirm("Invoice ban gaya (DRAFT). Invoice kholein?")) nav(`/invoices/${res.data.invoiceId}`);
    });
  };

  const cancelPlan = async () => {
    if (!confirm("Plan cancel karein? Bane hue invoices waise hi rahenge, aage demand/invoice nahi banenge.")) return;
    try {
      await paymentPlansApi.cancel(id);
      await load();
    } catch (e) {
      alert(e?.response?.data?.error || e.message);
    }
  };

  if (!data) return <div className="text-sm text-muted-foreground">Loading...</div>;
  const { plan, milestones, summary: s } = data;
  const active = plan.status === "ACTIVE";
  const pct = s.total_payable > 0 ? Math.min(100, Math.round((s.received / s.total_payable) * 100)) : 0;

  return (
    <div className="w-full max-w-[1200px] mx-auto space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">{plan.title}</h2>
            {!active && <Badge className="rounded-full bg-red-100 text-red-700 hover:bg-red-100">Cancelled</Badge>}
            {s.completed && active && <Badge className="rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Completed</Badge>}
          </div>
          <div className="text-sm text-muted-foreground">
            {plan.customer_name} • GST {Number(plan.tax_percent)}%{plan.description ? ` • ${plan.description}` : ""}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && active && (
            <Link to={`/payment-plans/${id}/edit`}>
              <Button variant="outline">Edit</Button>
            </Link>
          )}
          {role === "ADMIN" && active && (
            <Button variant="outline" className="text-red-600" onClick={cancelPlan}>Cancel plan</Button>
          )}
          <Link to="/payment-plans">
            <Button variant="outline">Back</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card className="rounded-2xl"><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Project value</div>
          <div className="text-lg font-semibold">{money(s.total_payable)}</div>
          <div className="text-xs text-muted-foreground">{money(s.total_taxable)} + GST {money(s.total_tax)}</div>
        </CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Invoiced</div>
          <div className="text-lg font-semibold">{money(s.invoiced)}</div>
        </CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Received</div>
          <div className="text-lg font-semibold text-emerald-700">{money(s.received)}</div>
          <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-1.5 bg-emerald-500" style={{ width: `${pct}%` }} /></div>
        </CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Balance</div>
          <div className="text-lg font-semibold text-red-600">{money(Math.max(0, s.total_payable - s.received))}</div>
          <div className="text-xs text-muted-foreground">{s.milestones_paid}/{s.milestones_total} installments paid</div>
        </CardContent></Card>
      </div>

      {emailFor && (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">
              Demand letter email: installment {emailFor.seq} ({emailFor.title})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={sendEmail} className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>To *</Label>
                <Input value={emailForm.to} onChange={(e) => setEmailForm((p) => ({ ...p, to: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>CC</Label>
                <Input value={emailForm.cc} onChange={(e) => setEmailForm((p) => ({ ...p, cc: e.target.value }))} />
              </div>
              <div className="grid gap-2 md:col-span-2">
                <Label>Message (optional)</Label>
                <textarea
                  className="min-h-[70px] rounded-md border bg-background px-3 py-2 text-sm"
                  value={emailForm.message}
                  onChange={(e) => setEmailForm((p) => ({ ...p, message: e.target.value }))}
                />
              </div>
              <div className="flex gap-2 md:col-span-2">
                <Button type="submit" disabled={busy === emailFor.id}>{busy === emailFor.id ? "Sending..." : "Send"}</Button>
                <Button type="button" variant="outline" onClick={() => setEmailFor(null)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Installments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {milestones.map((m) => {
            const hasInvoice = m.invoice_id && m.inv_status !== "CANCELLED";
            const gst = (Number(m.amount) * Number(plan.tax_percent)) / 100;
            return (
              <div key={m.id} className="rounded-xl border p-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{m.seq}. {m.title}</span>
                    <MilestoneStatus status={m.status} />
                    {m.percent !== null && <span className="text-xs text-muted-foreground">{Number(m.percent)}%</span>}
                  </div>
                  <div className="text-sm mt-1">
                    {money(m.amount)} + GST {money(gst)} = <b>{money(Number(m.amount) + gst)}</b>
                    <span className="text-muted-foreground"> • Due: {fmtDate(m.due_date)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {m.demand_no ? `Demand ${m.demand_no} • sent ${m.demand_count}×` : "Demand abhi nahi bheja"}
                    {hasInvoice && (
                      <>
                        {" • Invoice "}
                        <Link className="underline" to={`/invoices/${m.invoice_id}`}>{m.invoice_no || `#${m.invoice_id} (draft)`}</Link>
                        {Number(m.inv_paid_total) > 0 && ` • paid ${money(m.inv_paid_total)}`}
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 shrink-0">
                  <Button size="sm" variant="outline" disabled={busy === m.id} onClick={() => viewDemand(m)}>
                    Demand PDF
                  </Button>
                  {canEdit && active && m.status !== "PAID" && (
                    <>
                      <Button size="sm" variant="outline" disabled={busy === m.id} onClick={() => openEmail(m)}>
                        Email
                      </Button>
                      <Button size="sm" variant="outline" disabled={busy === m.id} onClick={() => sendWhatsapp(m)}>
                        WhatsApp
                      </Button>
                    </>
                  )}
                  {canEdit && active && !hasInvoice && (
                    <Button size="sm" disabled={busy === m.id} onClick={() => createInvoice(m)}>
                      Create invoice
                    </Button>
                  )}
                  {hasInvoice && (
                    <Link to={`/invoices/${m.invoice_id}`}>
                      <Button size="sm" variant="secondary">Open invoice</Button>
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
          <div className="text-xs text-muted-foreground">
            Demand letter tax invoice nahi hai. GST ke hisaab se har installment ka tax invoice uski due date tak banayein
            (ya Reminders & Alerts mein "auto invoice" on karein). Payment invoice page pe record karein.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
