import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { invoicesApi } from "../../api/invoices.api";
import { API_BASE_URL } from "../../api/axios";
import { paymentsApi } from "../../api/payments.api";
import { useAuth } from "../../context/AuthContext";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function StatusBadge({ status }) {
  const s = String(status || "").toUpperCase();
  if (s === "FINAL")
    return (
      <Badge className="rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
        FINAL
      </Badge>
    );
  if (s === "CANCELLED")
    return (
      <Badge className="rounded-full bg-red-100 text-red-700 hover:bg-red-100">
        CANCELLED
      </Badge>
    );
  return (
    <Badge variant="secondary" className="rounded-full">
      DRAFT
    </Badge>
  );
}

function Money({ value, className = "" }) {
  const n = Number(value || 0);
  return <span className={className}>₹ {Number.isFinite(n) ? n : value}</span>;
}

export default function InvoiceView() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [payments, setPayments] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(true);
  const [finalizing, setFinalizing] = useState(false);
  const [sending, setSending] = useState(false);
  const { user } = useAuth();
  const isAdmin = String(user?.role || localStorage.getItem("role") || "").toUpperCase() === "ADMIN";
  const [creditData, setCreditData] = useState({ notes: [], lines: [] });
  const [paymentLinks, setPaymentLinks] = useState([]);
  const [linkBusy, setLinkBusy] = useState(false);
  const [cnOpen, setCnOpen] = useState(false);
  const [cnSaving, setCnSaving] = useState(false);
  const [cnForm, setCnForm] = useState({
    cn_date: todayISO(),
    reason: "",
    qty: {},
    refund_amount: "",
    refund_mode: "UPI",
    refund_reference: "",
  });
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailForm, setEmailForm] = useState({ to: "", cc: "", message: "" });

  const [payForm, setPayForm] = useState({
    payment_date: todayISO(),
    amount: "",
    mode: "UPI",
    reference_no: "",
    notes: "",
  });
  const [reminderForm, setReminderForm] = useState({
    reminder_date: todayISO(),
    channel: "CALL",
    note: "",
  });

  const openPdf = async (url) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return alert(`PDF failed (${res.status}) ${text}`);
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank");
    } catch (e) {
      alert(e.message);
    }
  };

  const downloadPdf = async (url, filename) => {
    const token = localStorage.getItem("token");
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`PDF failed (${res.status})`);
    const blobUrl = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
  };

  const load = async () => {
    setLoading(true);
    try {
      const inv = await invoicesApi.get(id);
      setData(inv.data);

      const pay = await paymentsApi.listByInvoice(id);
      setPayments(pay.data || []);

      const rem = await invoicesApi.reminders(id);
      setReminders(rem.data || []);

      const auditRes = await invoicesApi.audit(id);
      setAudit(auditRes.data || []);

      const cnRes = await invoicesApi.creditNotes(id);
      setCreditData(cnRes.data || { notes: [], lines: [] });

      const plRes = await invoicesApi.paymentLinks(id);
      setPaymentLinks(plRes.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [id]);

  const onPayChange = (e) =>
    setPayForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  const onReminderChange = (e) =>
    setReminderForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const addPayment = async (e) => {
    e.preventDefault();
    if (!payForm.amount) return alert("Enter amount");

    try {
      await paymentsApi.addToInvoice(id, {
        payment_date: payForm.payment_date,
        amount: Number(payForm.amount),
        mode: payForm.mode,
        reference_no: payForm.reference_no || null,
        notes: payForm.notes || null,
      });

      setPayForm({
        payment_date: todayISO(),
        amount: "",
        mode: "UPI",
        reference_no: "",
        notes: "",
      });

      await load();
      alert("Payment added ✅");
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    }
  };

  const finalizeInvoice = async () => {
    if (!confirm("Finalize invoice and generate invoice number?")) return;
    setFinalizing(true);
    try {
      await invoicesApi.finalize(id);
      await load();
      alert("Invoice finalized");
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    } finally {
      setFinalizing(false);
    }
  };

  const createPaymentLink = async () => {
    setLinkBusy(true);
    try {
      const res = await invoicesApi.createPaymentLink(id);
      await load();
      try {
        await navigator.clipboard.writeText(res.data.short_url);
      } catch {
        // clipboard may be blocked; the link is shown on the page
      }
      alert(`Payment link ready (copied): ${res.data.short_url}`);
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    } finally {
      setLinkBusy(false);
    }
  };

  const syncPaymentLink = async () => {
    setLinkBusy(true);
    try {
      const res = await invoicesApi.syncPaymentLink(id);
      await load();
      const paid = (res.data?.results || []).includes("paid");
      alert(paid ? "Online payment mil gaya ✅" : "Abhi tak payment nahi aaya");
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    } finally {
      setLinkBusy(false);
    }
  };

  const shareLinkWhatsapp = (url) => {
    const phone = String(invoice?.customer_phone || "").replace(/\D/g, "").replace(/^0+/, "");
    const num = phone.length === 10 ? `91${phone}` : phone;
    const text = `Dear ${invoice?.customer_name || "Customer"},
Please pay ₹ ${invoice?.due_total} for invoice ${invoice?.invoice_no || `#${invoice?.id}`} online:
${url}

Thank you!`;
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(text)}`, "_blank");
  };

  const deletePayment = async (p) => {
    const reason = prompt(`Payment #${p.id} (₹ ${p.amount}) delete karne ka reason likhein:`);
    if (reason === null) return;
    if (reason.trim().length < 3) return alert("Reason kam se kam 3 characters ka hona chahiye");
    try {
      await paymentsApi.remove(id, p.id, reason.trim());
      await load();
      alert("Payment deleted");
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    }
  };

  const openCreditNote = () => {
    setCnForm({ cn_date: todayISO(), reason: "", qty: {}, refund_amount: "", refund_mode: "UPI", refund_reference: "" });
    setCnOpen(true);
  };

  const fillFullCredit = () => {
    const qty = {};
    for (const l of creditData.lines) qty[l.id] = Number(l.remaining_qty || 0);
    setCnForm((p) => ({ ...p, qty }));
  };

  // Preview mirrors the backend: proportional share of each line's taxable + tax
  const cnPreview = useMemo(() => {
    let total = 0;
    for (const l of creditData.lines) {
      const q = Number(cnForm.qty[l.id] || 0);
      if (!(q > 0) || !(Number(l.qty) > 0)) continue;
      const lineTotal = Number(l.taxable_amount) + Number(l.cgst_amount) + Number(l.sgst_amount) + Number(l.igst_amount);
      total += (lineTotal * q) / Number(l.qty);
    }
    return Math.round(total * 100) / 100;
  }, [creditData.lines, cnForm.qty]);

  const saveCreditNote = async (e) => {
    e.preventDefault();
    const lines = Object.entries(cnForm.qty)
      .map(([invoice_item_id, qty]) => ({ invoice_item_id: Number(invoice_item_id), qty: Number(qty || 0) }))
      .filter((l) => l.qty > 0);
    if (!lines.length) return alert("Kam se kam ek line ki qty dalein");
    if (cnForm.reason.trim().length < 3) return alert("Reason likhein");
    if (!confirm(`Credit note ₹ ${cnPreview} ka banega. Ye wapas nahi hoga. Continue?`)) return;

    setCnSaving(true);
    try {
      const res = await invoicesApi.createCreditNote(id, {
        cn_date: cnForm.cn_date,
        reason: cnForm.reason.trim(),
        lines,
        refund_amount: Number(cnForm.refund_amount || 0),
        refund_mode: Number(cnForm.refund_amount || 0) > 0 ? cnForm.refund_mode : null,
        refund_reference: cnForm.refund_reference || null,
      });
      setCnOpen(false);
      await load();
      alert(`Credit note ${res.data.cn_no} ban gaya ✅`);
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    } finally {
      setCnSaving(false);
    }
  };

  const openEmail = () => {
    setEmailForm({ to: invoice?.customer_email || "", cc: "", message: "" });
    setEmailOpen(true);
  };

  const sendEmail = async (e) => {
    e.preventDefault();
    if (!emailForm.to) return alert("Email address required");
    setSending(true);
    try {
      const res = await invoicesApi.sendEmail(id, {
        to: emailForm.to,
        cc: emailForm.cc || null,
        message: emailForm.message || null,
      });
      setEmailOpen(false);
      await load();
      alert(`Invoice email sent ✅ (${res.data?.to})`);
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    } finally {
      setSending(false);
    }
  };

  // WhatsApp can't receive a file from a link, so download the PDF for the user to attach
  const sendWhatsapp = async () => {
    const win = window.open("", "_blank"); // open synchronously so the popup isn't blocked
    setSending(true);
    try {
      const res = await invoicesApi.whatsappLink(id);
      if (win) win.location.href = res.data.url;
      else window.open(res.data.url, "_blank");
      await downloadPdf(pdfUrl, `Invoice-${invoice?.invoice_no || `DRAFT-${id}`}.pdf`.replace(/[/\\]/g, "_"));
      await invoicesApi.markSent(id, { channel: "WHATSAPP" });
      await load();
    } catch (err) {
      if (win) win.close();
      alert(err?.response?.data?.error || err.message);
    } finally {
      setSending(false);
    }
  };

  const addReminder = async (e) => {
    e.preventDefault();
    try {
      await invoicesApi.addReminder(id, {
        reminder_date: reminderForm.reminder_date,
        channel: reminderForm.channel,
        note: reminderForm.note || null,
      });
      setReminderForm({ reminder_date: todayISO(), channel: "CALL", note: "" });
      await load();
      alert("Reminder saved");
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    }
  };

  const invoice = data?.invoice;
  const items = data?.items || [];

  const isPaid = useMemo(() => Number(invoice?.due_total || 0) <= 0, [invoice]);
  const due = Number(invoice?.due_total || 0);
  const pdfUrl = `${API_BASE_URL}/api/invoices/${id}/pdf`;
  const isCancelled = String(invoice?.status || "").toUpperCase() === "CANCELLED";

  if (loading) return <div className="text-sm text-muted-foreground">Loading...</div>;
  if (!data) return <div className="text-sm text-muted-foreground">Invoice not found</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">
              Invoice: {invoice.invoice_no || `#${invoice.id}`}
            </h2>
            <StatusBadge status={invoice.status} />
            {isPaid && (
              <Badge className="rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                PAID
              </Badge>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            Date: <span className="font-medium text-foreground">{invoice.invoice_date}</span>
            {" • "}
            Customer:{" "}
            <span className="font-medium text-foreground">
              {invoice.customer_name || invoice.customer_id}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => openPdf(`${API_BASE_URL}/api/invoices/${id}/pdf`)}
          >
            Invoice PDF
          </Button>
          <Button type="button" variant="outline" disabled={sending || isCancelled} onClick={openEmail}>
            Email
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={sending || isCancelled}
            onClick={sendWhatsapp}
            title="WhatsApp khulega aur PDF download hoga — chat mein attach kar dein"
          >
            WhatsApp
          </Button>

          {String(invoice.status).toUpperCase() === "DRAFT" && (
            <>
              <Button onClick={finalizeInvoice} disabled={finalizing}>
                {finalizing ? "Finalizing..." : "Finalize"}
              </Button>
              <Link to={`/invoices/${id}/edit`}>
                <Button variant="outline">Edit</Button>
              </Link>
            </>
          )}


          <Link to="/invoices">
            <Button variant="outline">Back</Button>
          </Link>
        </div>
      </div>

      {emailOpen && (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Email invoice (PDF attached)</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={sendEmail} className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>To *</Label>
                <Input
                  value={emailForm.to}
                  onChange={(e) => setEmailForm((p) => ({ ...p, to: e.target.value }))}
                  placeholder="customer@example.com"
                />
              </div>
              <div className="grid gap-2">
                <Label>CC (optional, comma separated)</Label>
                <Input
                  value={emailForm.cc}
                  onChange={(e) => setEmailForm((p) => ({ ...p, cc: e.target.value }))}
                />
              </div>
              <div className="grid gap-2 md:col-span-2">
                <Label>Message (optional)</Label>
                <textarea
                  className="min-h-[80px] rounded-md border bg-background px-3 py-2 text-sm"
                  value={emailForm.message}
                  onChange={(e) => setEmailForm((p) => ({ ...p, message: e.target.value }))}
                  placeholder="Please find attached invoice..."
                />
              </div>
              <div className="flex gap-2 md:col-span-2">
                <Button type="submit" disabled={sending}>{sending ? "Sending..." : "Send Email"}</Button>
                <Button type="button" variant="outline" onClick={() => setEmailOpen(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Summary KPIs */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">Grand Total</div>
            <div className="mt-1 text-2xl font-semibold">
              <Money value={invoice.grand_total} />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">Paid</div>
            <div className="mt-1 text-2xl font-semibold text-emerald-700">
              <Money value={invoice.paid_total} />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">Due</div>
            <div className={`mt-1 text-2xl font-semibold ${due > 0 ? "text-red-600" : "text-emerald-700"}`}>
              <Money value={invoice.due_total} />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">Tax</div>
            <div className="mt-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">CGST</span>
                <span className="font-medium"><Money value={invoice.cgst_total} /></span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">SGST</span>
                <span className="font-medium"><Money value={invoice.sgst_total} /></span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">IGST</span>
                <span className="font-medium"><Money value={invoice.igst_total} /></span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Summary */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Invoice Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium"><Money value={invoice.subtotal} /></span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discount</span>
                <span className="font-medium"><Money value={invoice.discount_total} /></span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Taxable</span>
                <span className="font-medium"><Money value={invoice.taxable_total} /></span>
              </div>
              <Separator />
              <div className="flex justify-between text-base">
                <span className="font-semibold">Grand Total</span>
                <span className="font-semibold"><Money value={invoice.grand_total} /></span>
              </div>
              {Number(invoice.credit_total || 0) > 0 && (
                <div className="flex justify-between text-amber-700">
                  <span>Credit Notes</span>
                  <span className="font-medium">- <Money value={invoice.credit_total} /></span>
                </div>
              )}
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Place of supply</span>
                <span className="font-medium">{invoice.place_of_supply_state || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Interstate</span>
                <span className="font-medium">{Number(invoice.is_interstate) === 1 ? "Yes" : "No"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Notes</span>
                <span className="font-medium">{invoice.notes || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Terms</span>
                <span className="font-medium">{invoice.terms || "—"}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Line Items</CardTitle>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-3 pr-4">#</th>
                  <th className="py-3 pr-4">Type</th>
                  <th className="py-3 pr-4">Description</th>
                  <th className="py-3 pr-4 text-right">Qty</th>
                  <th className="py-3 pr-4 text-right">Rate</th>
                  <th className="py-3 pr-4 text-right">Disc%</th>
                  <th className="py-3 pr-4 text-right">GST%</th>
                  <th className="py-3 text-right">Line Total</th>
                </tr>
              </thead>

              <tbody>
                {items.map((it, idx) => (
                  <tr key={it.id} className="border-b hover:bg-muted/40">
                    <td className="py-3 pr-4">{idx + 1}</td>
                    <td className="py-3 pr-4">
                      <span className="rounded-full bg-muted px-2 py-1 text-xs">
                        {it.type}
                      </span>
                    </td>
                    <td className="py-3 pr-4">{it.description}</td>
                    <td className="py-3 pr-4 text-right">
                      {it.qty}
                      {Number(it.billing_months || 1) > 1 && (
                        <span className="text-muted-foreground"> × {Number(it.billing_months)} mo</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-right">{it.rate}</td>
                    <td className="py-3 pr-4 text-right">{it.discount_percent}</td>
                    <td className="py-3 pr-4 text-right">{it.tax_percent}</td>
                    <td className="py-3 text-right font-medium">{it.line_total}</td>
                  </tr>
                ))}

                {items.length === 0 && (
                  <tr>
                    <td colSpan="8" className="py-10 text-center text-muted-foreground">
                      No items
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Payments */}
      <div className="grid gap-3 lg:grid-cols-2">
        {/* Add payment */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Add Payment</CardTitle>
          </CardHeader>

          <CardContent>
            <form onSubmit={addPayment} className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Payment Date</Label>
                  <Input
                    type="date"
                    name="payment_date"
                    value={payForm.payment_date}
                    onChange={onPayChange}
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    name="amount"
                    value={payForm.amount}
                    onChange={onPayChange}
                    placeholder="e.g. 1000"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Mode</Label>
                  <select
                    name="mode"
                    value={payForm.mode}
                    onChange={onPayChange}
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CARD">Card</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label>Reference No</Label>
                  <Input
                    name="reference_no"
                    value={payForm.reference_no}
                    onChange={onPayChange}
                    placeholder="UTR/Txn/Cheque"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Notes</Label>
                <Input
                  name="notes"
                  value={payForm.notes}
                  onChange={onPayChange}
                  placeholder="Optional"
                />
              </div>

              <Button type="submit" disabled={isPaid}>
                Add Payment
              </Button>

              {isPaid && (
                <div className="text-sm font-medium text-emerald-700">
                  Invoice fully paid ✅
                </div>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Payments list */}
        <Card className="rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Payments</CardTitle>
            <Badge variant="secondary" className="rounded-full">
              {payments.length}
            </Badge>
          </CardHeader>

          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-3 pr-4">ID</th>
                    <th className="py-3 pr-4">Date</th>
                    <th className="py-3 pr-4 text-right">Amount</th>
                    <th className="py-3 pr-4">Mode</th>
                    <th className="py-3 pr-4">Ref</th>
                    <th className="py-3 pr-4">Notes</th>
                    <th className="py-3 text-right">Receipt</th>
                  </tr>
                </thead>

                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b hover:bg-muted/40">
                      <td className="py-3 pr-4">{p.id}</td>
                      <td className="py-3 pr-4">{p.payment_date}</td>
                      <td className="py-3 pr-4 text-right">{p.amount}</td>
                      <td className="py-3 pr-4">{p.mode}</td>
                      <td className="py-3 pr-4">{p.reference_no || "—"}</td>
                      <td className="py-3 pr-4">{p.notes || "—"}</td>
                      <td className="py-3 text-right">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            openPdf(
                              `${API_BASE_URL}/api/invoices/${id}/payments/${p.id}/receipt.pdf`
                            )
                          }
                        >
                          Receipt PDF
                        </Button>
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="ml-1 text-red-600 hover:text-red-700"
                            onClick={() => deletePayment(p)}
                          >
                            Delete
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}

                  {payments.length === 0 && (
                    <tr>
                      <td colSpan="7" className="py-10 text-center text-muted-foreground">
                        No payments yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Online payment link */}
      {!isCancelled && (Number(invoice.due_total || 0) > 0 || paymentLinks.length > 0) && (
        <Card className="rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Online Payment Link</CardTitle>
            <div className="flex gap-2">
              {paymentLinks.some((l) => l.status === "CREATED") && (
                <Button size="sm" variant="outline" disabled={linkBusy} onClick={syncPaymentLink}>
                  Check status
                </Button>
              )}
              {Number(invoice.due_total || 0) > 0 && (
                <Button size="sm" disabled={linkBusy} onClick={createPaymentLink}>
                  {linkBusy ? "Please wait..." : "Get payment link"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {paymentLinks.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                Razorpay link banakar customer ko bhejein. Payment hote hi invoice apne aap update ho jayega.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-4">Link</th>
                      <th className="py-2 pr-4 text-right">Amount</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Created</th>
                      <th className="py-2 text-right"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentLinks.map((l) => (
                      <tr key={l.id} className="border-b last:border-0">
                        <td className="py-2 pr-4">
                          <a className="underline" href={l.short_url} target="_blank" rel="noreferrer">
                            {l.short_url}
                          </a>
                        </td>
                        <td className="py-2 pr-4 text-right"><Money value={l.amount} /></td>
                        <td className="py-2 pr-4">
                          <Badge
                            className={`rounded-full ${
                              l.status === "PAID"
                                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                                : l.status === "CREATED"
                                  ? "bg-amber-100 text-amber-800 hover:bg-amber-100"
                                  : "bg-slate-100 text-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            {l.status === "CREATED" ? "OPEN" : l.status}
                          </Badge>
                        </td>
                        <td className="py-2 pr-4 whitespace-nowrap">{String(l.created_at).slice(0, 16)}</td>
                        <td className="py-2 text-right">
                          {l.status === "CREATED" && (
                            <Button size="sm" variant="secondary" onClick={() => shareLinkWhatsapp(l.short_url)}>
                              WhatsApp
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Credit notes */}
      {(String(invoice.status).toUpperCase() === "FINAL" || creditData.notes.length > 0) && (
        <Card className="rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Credit Notes</CardTitle>
            {isAdmin && String(invoice.status).toUpperCase() === "FINAL" && !cnOpen && (
              <Button size="sm" variant="outline" onClick={openCreditNote}>
                + Credit Note
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {cnOpen && (
              <form onSubmit={saveCreditNote} className="space-y-4 rounded-xl border p-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="grid gap-2">
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={cnForm.cn_date}
                      onChange={(e) => setCnForm((p) => ({ ...p, cn_date: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-2 md:col-span-2">
                    <Label>Reason *</Label>
                    <Input
                      value={cnForm.reason}
                      onChange={(e) => setCnForm((p) => ({ ...p, reason: e.target.value }))}
                      placeholder="e.g. Service cancelled / Wrong rate billed"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-2 pr-4">Item</th>
                        <th className="py-2 pr-4 text-right">Invoice qty</th>
                        <th className="py-2 pr-4 text-right">Already credited</th>
                        <th className="py-2 text-right">Credit qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {creditData.lines.map((l) => (
                        <tr key={l.id} className="border-b">
                          <td className="py-2 pr-4">{l.description}</td>
                          <td className="py-2 pr-4 text-right">{l.qty}</td>
                          <td className="py-2 pr-4 text-right">{Number(l.credited_qty)}</td>
                          <td className="py-2 text-right">
                            <Input
                              type="number"
                              min={0}
                              max={l.remaining_qty}
                              step="0.01"
                              className="ml-auto w-28 text-right"
                              disabled={!(Number(l.remaining_qty) > 0)}
                              value={cnForm.qty[l.id] ?? ""}
                              onChange={(e) =>
                                setCnForm((p) => ({ ...p, qty: { ...p.qty, [l.id]: e.target.value } }))
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="grid gap-2">
                    <Label>Refund to customer (optional)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={cnForm.refund_amount}
                      onChange={(e) => setCnForm((p) => ({ ...p, refund_amount: e.target.value }))}
                      placeholder="0"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Refund mode</Label>
                    <select
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      value={cnForm.refund_mode}
                      onChange={(e) => setCnForm((p) => ({ ...p, refund_mode: e.target.value }))}
                    >
                      <option value="UPI">UPI</option>
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                      <option value="CASH">Cash</option>
                      <option value="CHEQUE">Cheque</option>
                      <option value="CARD">Card</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Refund reference</Label>
                    <Input
                      value={cnForm.refund_reference}
                      onChange={(e) => setCnForm((p) => ({ ...p, refund_reference: e.target.value }))}
                      placeholder="UTR / Txn"
                    />
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Refund sirf tab dein jab customer ne credit ke baad zyada payment kiya ho.
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="secondary" onClick={fillFullCredit}>
                    Full credit (poora invoice)
                  </Button>
                  <div className="text-sm">
                    Credit amount: <b>₹ {cnPreview}</b>
                  </div>
                  <div className="ml-auto flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setCnOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={cnSaving}>
                      {cnSaving ? "Saving..." : "Create Credit Note"}
                    </Button>
                  </div>
                </div>
              </form>
            )}

            {creditData.notes.length === 0 ? (
              !cnOpen && (
                <div className="text-sm text-muted-foreground">
                  Koi credit note nahi. FINAL invoice ko cancel ya kam karne ke liye credit note banayein.
                </div>
              )
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-4">Credit Note</th>
                      <th className="py-2 pr-4">Date</th>
                      <th className="py-2 pr-4">Reason</th>
                      <th className="py-2 pr-4 text-right">Amount</th>
                      <th className="py-2 pr-4 text-right">Refund</th>
                      <th className="py-2 text-right">PDF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {creditData.notes.map((n) => (
                      <tr key={n.id} className="border-b">
                        <td className="py-2 pr-4 font-medium">{n.cn_no}</td>
                        <td className="py-2 pr-4">{n.cn_date}</td>
                        <td className="py-2 pr-4">{n.reason}</td>
                        <td className="py-2 pr-4 text-right"><Money value={n.grand_total} /></td>
                        <td className="py-2 pr-4 text-right">
                          {Number(n.refund_amount) > 0 ? <Money value={n.refund_amount} /> : "—"}
                        </td>
                        <td className="py-2 text-right">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => openPdf(`${API_BASE_URL}/api/credit-notes/${n.id}/pdf`)}
                          >
                            PDF
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Reminder history */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Add Reminder</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={addReminder} className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Reminder Date</Label>
                  <Input type="date" name="reminder_date" value={reminderForm.reminder_date} onChange={onReminderChange} />
                </div>
                <div className="grid gap-2">
                  <Label>Channel</Label>
                  <select
                    name="channel"
                    value={reminderForm.channel}
                    onChange={onReminderChange}
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="CALL">Call</option>
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="EMAIL">Email</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Note</Label>
                <Input name="note" value={reminderForm.note} onChange={onReminderChange} placeholder="e.g. Customer promised payment by Friday" />
              </div>
              <Button type="submit" disabled={isPaid}>Save Reminder</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Reminder History</CardTitle>
            <Badge variant="secondary" className="rounded-full">{reminders.length}</Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {reminders.map((r) => (
                <div key={r.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="font-medium">{r.channel}</span>
                    <span className="text-muted-foreground">{r.reminder_date}</span>
                  </div>
                  <div className="mt-1 text-muted-foreground">{r.note || "No note"}</div>
                </div>
              ))}
              {reminders.length === 0 && (
                <div className="py-8 text-center text-sm text-muted-foreground">No reminders yet</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Audit Trail</CardTitle>
          <Badge variant="secondary" className="rounded-full">{audit.length}</Badge>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {audit.slice(0, 8).map((a) => (
              <div key={a.id} className="flex flex-col gap-1 rounded-lg border p-3 text-sm md:flex-row md:items-center md:justify-between">
                <div>
                  <span className="font-medium">{a.action}</span>
                  {a.note ? <span className="text-muted-foreground"> - {a.note}</span> : null}
                </div>
                <div className="text-xs text-muted-foreground">{a.created_at}</div>
              </div>
            ))}
            {audit.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">No audit entries yet</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
