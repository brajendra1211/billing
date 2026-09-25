import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { portalApi } from "../../api/portal.api";
import { API_BASE_URL } from "../../api/axios";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function money(n) {
  return `₹ ${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(String(d).slice(0, 10) + "T00:00:00");
  return Number.isNaN(dt.getTime())
    ? d
    : dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function InvoiceStatus({ inv }) {
  const due = Number(inv.due_total || 0);
  if (due <= 0)
    return <Badge className="rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Paid</Badge>;
  if (inv.due_date && String(inv.due_date).slice(0, 10) < todayISO())
    return <Badge className="rounded-full bg-red-100 text-red-700 hover:bg-red-100">Overdue</Badge>;
  return <Badge className="rounded-full bg-amber-100 text-amber-800 hover:bg-amber-100">Due</Badge>;
}

export default function CustomerPortal() {
  const { token } = useParams();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(null); // invoice id being paid / downloaded
  const [notice, setNotice] = useState(null);
  const [showLedger, setShowLedger] = useState(false);

  const load = async () => {
    try {
      const res = await portalApi.overview(token);
      setData(res.data);
      setError("");
    } catch (e) {
      setError(e?.response?.data?.error || "Link invalid ya expire ho gaya hai");
    }
  };

  useEffect(() => {
    (async () => {
      // Back from Razorpay: confirm the payment before showing the list
      const paidId = params.get("paid");
      if (paidId) {
        try {
          const res = await portalApi.sync(token, paidId);
          setNotice(
            res.data.paid
              ? { ok: true, text: `Payment received for invoice ${res.data.invoice_no || "#" + res.data.id}. Thank you!` }
              : { ok: false, text: "Payment abhi confirm nahi hua. Agar amount kat gaya hai to kuch der mein update ho jayega." }
          );
        } catch {
          // ignore; the list below still loads
        }
        params.delete("paid");
        params.delete("razorpay_payment_id");
        params.delete("razorpay_payment_link_id");
        params.delete("razorpay_payment_link_reference_id");
        params.delete("razorpay_payment_link_status");
        params.delete("razorpay_signature");
        setParams(params, { replace: true });
      }
      await load();
    })();
    // eslint-disable-next-line
  }, [token]);

  const payNow = async (inv) => {
    setBusy(inv.id);
    try {
      const res = await portalApi.pay(token, inv.id);
      window.location.href = res.data.url;
    } catch (e) {
      alert(e?.response?.data?.error || e.message);
      setBusy(null);
    }
  };

  const downloadPdf = async (inv) => {
    setBusy(inv.id);
    try {
      const res = await fetch(portalApi.pdfUrl(token, inv.id));
      if (!res.ok) throw new Error(`PDF failed (${res.status})`);
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `Invoice-${inv.invoice_no || inv.id}.pdf`.replace(/[/\\]/g, "_");
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(null);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full rounded-2xl">
          <CardContent className="p-6 text-center space-y-2">
            <div className="text-lg font-semibold">Link not valid</div>
            <div className="text-sm text-muted-foreground">{error}</div>
            <div className="text-sm text-muted-foreground">Naye link ke liye apne service provider se sampark karein.</div>
          </CardContent>
        </Card>
      </div>
    );
  }
  if (!data) return <div className="p-6 text-sm text-muted-foreground">Loading...</div>;

  const { company, customer, invoices, ledger } = data;
  const address = [company.billing_address_line1, company.billing_city, company.billing_state].filter(Boolean).join(", ");

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto w-full max-w-4xl px-4 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          {company.logo_url && (
            <img
              src={`${API_BASE_URL}${company.logo_url}`}
              alt=""
              className="h-12 w-12 rounded-lg border bg-white object-contain"
            />
          )}
          <div className="min-w-0">
            <div className="text-lg font-semibold truncate">{company.name}</div>
            <div className="text-xs text-muted-foreground truncate">
              {[address, company.phone, company.email].filter(Boolean).join(" • ")}
            </div>
          </div>
        </div>

        {notice && (
          <div
            className={`rounded-xl border p-3 text-sm ${
              notice.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"
            }`}
          >
            {notice.text}
          </div>
        )}

        {/* Summary */}
        <Card className="rounded-2xl">
          <CardContent className="p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Hello,</div>
              <div className="text-lg font-semibold">{customer.contact_person || customer.name}</div>
              {customer.contact_person && <div className="text-sm text-muted-foreground">{customer.name}</div>}
            </div>
            <div className="sm:text-right">
              <div className="text-sm text-muted-foreground">Total outstanding</div>
              <div className={`text-2xl font-semibold ${data.total_due > 0 ? "text-red-600" : "text-emerald-700"}`}>
                {money(data.total_due)}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invoices */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Your invoices</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {invoices.length === 0 && <div className="text-sm text-muted-foreground">No invoices yet.</div>}
            {invoices.map((inv) => (
              <div key={inv.id} className="rounded-xl border bg-background p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{inv.invoice_no || `Invoice #${inv.id}`}</span>
                    <InvoiceStatus inv={inv} />
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {fmtDate(inv.invoice_date)}
                    {inv.due_date ? ` • Due ${fmtDate(inv.due_date)}` : ""}
                    {" • "}Total {money(inv.grand_total)}
                  </div>
                  {Number(inv.due_total) > 0 && (
                    <div className="text-sm mt-1">
                      Balance: <b>{money(inv.due_total)}</b>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button variant="outline" size="sm" disabled={busy === inv.id} onClick={() => downloadPdf(inv)}>
                    PDF
                  </Button>
                  {data.online_payment && Number(inv.due_total) > 0 && (
                    <Button size="sm" disabled={busy === inv.id} onClick={() => payNow(inv)}>
                      {busy === inv.id ? "Please wait..." : `Pay ${money(inv.due_total)}`}
                    </Button>
                  )}
                </div>
              </div>
            ))}

            {data.total_due > 0 && !data.online_payment && company.upi_id && (
              <div className="rounded-xl bg-muted p-3 text-sm">
                Pay via UPI to <b>{company.upi_id}</b>. The invoice PDF has a QR code you can scan.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ledger */}
        {ledger.length > 0 && (
          <Card className="rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Account statement</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowLedger((v) => !v)}>
                {showLedger ? "Hide" : "Show"}
              </Button>
            </CardHeader>
            {showLedger && (
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3">Details</th>
                      <th className="py-2 pr-3 text-right">Debit</th>
                      <th className="py-2 pr-3 text-right">Credit</th>
                      <th className="py-2 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map((e, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(e.entry_date)}</td>
                        <td className="py-2 pr-3">{e.note}</td>
                        <td className="py-2 pr-3 text-right">{Number(e.debit) ? money(e.debit) : ""}</td>
                        <td className="py-2 pr-3 text-right">{Number(e.credit) ? money(e.credit) : ""}</td>
                        <td className="py-2 text-right font-medium">{money(e.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            )}
          </Card>
        )}

        <div className="text-center text-xs text-muted-foreground pb-4">
          {company.legal_name || company.name}
          {company.gstin ? ` • GSTIN ${company.gstin}` : ""}
        </div>
      </div>
    </div>
  );
}
