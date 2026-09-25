import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { invoicesApi } from "../../api/invoices.api";
import { API_BASE_URL } from "../../api/axios";
import { paymentsApi } from "../../api/payments.api";

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
                    <td className="py-3 pr-4 text-right">{it.qty}</td>
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
