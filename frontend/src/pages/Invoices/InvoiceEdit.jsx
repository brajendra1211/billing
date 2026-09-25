// src/pages/Invoices/InvoiceEdit.jsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { invoicesApi } from "../../api/invoices.api";
import { customersApi } from "../../api/customers.api";
import { itemsApi } from "../../api/items.api";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function normalizeList(resp) {
  // handles:
  // - array
  // - { ok:true, data:[...] }
  // - { ok:true, data:{ rows:[...] } }
  // - { data:[...] } / { rows:[...] }
  if (!resp) return [];
  if (Array.isArray(resp)) return resp;
  if (Array.isArray(resp.data)) return resp.data;
  if (Array.isArray(resp.data?.rows)) return resp.data.rows;
  if (Array.isArray(resp.rows)) return resp.rows;
  return [];
}

function stripBillingNote(description) {
  return String(description || "").replace(/\s*\|\s*Billing:\s*.*$/i, "").trim();
}

function extractBillingMonths(description) {
  const match = String(description || "").match(/Billing:\s*[\d.]+\s*x\s*([\d.]+)\s*months/i);
  return match ? Number(match[1] || 1) : 1;
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

export default function InvoiceEdit() {
  const { id } = useParams();
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const [invoiceMeta, setInvoiceMeta] = useState(null);

  const [customers, setCustomers] = useState([]);
  const [itemsMaster, setItemsMaster] = useState([]);

  const [form, setForm] = useState({
    customer_id: "",
    invoice_date: todayISO(),
    due_date: "",
    place_of_supply_state: "",
    is_interstate: 0,
    notes: "",
    terms: "",
  });

  const [items, setItems] = useState([
    { item_id: "", description: "", qty: 1, billing_months: 1, is_period_billing: false, rate: 0, discount_percent: 0, tax_percent: 18 },
  ]);

  const isDraft = useMemo(
    () => String(invoiceMeta?.status || "").toUpperCase() === "DRAFT",
    [invoiceMeta]
  );
  const hasPeriodBilling = useMemo(
    () => items.some((it) => it.is_period_billing || Number(it.billing_months || 1) > 1),
    [items]
  );

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const [invRes, custRes, itemRes] = await Promise.all([
        invoicesApi.get(id),
        customersApi.list({ limit: 200, search: "" }),
        itemsApi.list({ limit: 500, search: "" }),
      ]);

      // invoicesApi.get -> { ok:true, data:{ invoice, items } }
      const payload = invRes?.data;
      const inv = payload?.invoice;
      const invItems = payload?.items || [];

      if (!inv) {
        setErr("Invoice not found");
        return;
      }

      setInvoiceMeta(inv);

      // DRAFT only
      if (String(inv.status || "").toUpperCase() !== "DRAFT") {
        setErr("Invoice locked. Only DRAFT invoice can be edited.");
        return;
      }

      const custRows = normalizeList(custRes);
      const itemRows = normalizeList(itemRes).filter(
        (x) => x.is_active === 1 || x.is_active === true || x.is_active === undefined
      );

      setCustomers(custRows);
      setItemsMaster(itemRows);

      setForm({
        customer_id: inv.customer_id ?? "",
        invoice_date: inv.invoice_date || todayISO(),
        due_date: inv.due_date || "",
        place_of_supply_state: inv.place_of_supply_state || "",
        is_interstate: Number(inv.is_interstate) === 1 ? 1 : 0,
        notes: inv.notes || "",
        terms: inv.terms || "",
      });

      setItems(
        (invItems.length
          ? invItems
          : [{ item_id: "", description: "", qty: 1, billing_months: 1, is_period_billing: false, rate: 0, discount_percent: 0, tax_percent: 18 }]
        ).map((x) => ({
          item_id: x.item_id ?? "",
          description: stripBillingNote(x.description || ""),
          qty: Number(x.qty || 1),
          billing_months: Number(x.billing_months || extractBillingMonths(x.description || "")),
          is_period_billing: Number(x.billing_months || extractBillingMonths(x.description || "")) > 1,
          rate: Number(x.rate || 0),
          discount_percent: Number(x.discount_percent || 0),
          tax_percent: Number(x.tax_percent ?? 18),
        }))
      );
    } catch (e) {
      setErr(e?.response?.data?.error || e.message || "Failed to load invoice");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [id]);

  const onChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const onItemChange = (idx, key, value) => {
    setItems((arr) => {
      const copy = [...arr];
      copy[idx] = { ...copy[idx], [key]: value };
      return copy;
    });
  };

  const addRow = () => {
    setItems((x) => [
      ...x,
      { item_id: "", description: "", qty: 1, billing_months: 1, is_period_billing: false, rate: 0, discount_percent: 0, tax_percent: 18 },
    ]);
  };

  const removeRow = (idx) => {
    setItems((x) => x.filter((_, i) => i !== idx));
  };

  const save = async (e) => {
    e.preventDefault();
    if (!isDraft) return;

    if (!form.customer_id) return alert("Customer required");
    if (!items.length) return alert("Add at least 1 item");
    if (items.some((it) => !it.item_id)) return alert("Select item in each row");
    if (items.some((it) => Number(it.qty || 0) <= 0)) return alert("Qty must be > 0");
    if (items.some((it) => it.is_period_billing && Number(it.billing_months || 0) <= 0)) return alert("Billing months must be > 0");

    setSaving(true);
    try {
      const payload = {
        customer_id: Number(form.customer_id),
        invoice_date: form.invoice_date,
        due_date: form.due_date || null,
        place_of_supply_state: form.place_of_supply_state || null,
        is_interstate: Number(form.is_interstate) === 1 ? 1 : 0,
        notes: form.notes || null,
        terms: form.terms || null,
        items: items.map((it) => ({
          item_id: Number(it.item_id),
          description: it.description || null,
          qty: Number(it.qty || 1),
          billing_months: it.is_period_billing ? Number(it.billing_months || 1) : 1,
          rate: Number(it.rate || 0),
          discount_percent: Number(it.discount_percent || 0),
          tax_percent: Number(it.tax_percent || 0),
        })),
      };

      await invoicesApi.update(id, payload);

      alert("Invoice updated ✅");
      nav(`/invoices/${id}`);
    } catch (e2) {
      alert(e2?.response?.data?.error || e2.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-sm text-muted-foreground">Loading...</div>;

  if (err) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold tracking-tight">Edit Invoice</h2>
          <Link to={`/invoices/${id}`}>
            <Button variant="outline">Back</Button>
          </Link>
        </div>

        <Card className="rounded-2xl">
          <CardContent className="p-5 space-y-3">
            <div className="text-sm text-red-600">{err}</div>
            <div className="flex gap-2">
              <Link to={`/invoices/${id}`}>
                <Button variant="secondary">Go to Invoice</Button>
              </Link>
              <Link to="/invoices">
                <Button variant="outline">Invoices List</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">
              Edit Invoice: {invoiceMeta?.invoice_no || `#${invoiceMeta?.id}`}
            </h2>
            <StatusBadge status={invoiceMeta?.status} />
          </div>
          <div className="text-sm text-muted-foreground">DRAFT invoice only</div>
        </div>

        <div className="flex gap-2">
          <Link to={`/invoices/${id}`}>
            <Button variant="outline">Cancel</Button>
          </Link>
          <Button onClick={save} disabled={!isDraft || saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Invoice fields */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Invoice Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="grid gap-2">
              <Label>Customer</Label>
              <select
                name="customer_id"
                value={form.customer_id}
                onChange={onChange}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Select customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (#{c.id})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label>Invoice Date</Label>
              <Input type="date" name="invoice_date" value={form.invoice_date} onChange={onChange} />
            </div>

            <div className="grid gap-2">
              <Label>Due Date</Label>
              <Input type="date" name="due_date" value={form.due_date} onChange={onChange} />
            </div>

            <div className="grid gap-2">
              <Label>Place of Supply</Label>
              <Input
                name="place_of_supply_state"
                value={form.place_of_supply_state}
                onChange={onChange}
                placeholder="e.g. MH"
              />
            </div>

            <div className="grid gap-2">
              <Label>Interstate</Label>
              <select
                name="is_interstate"
                value={String(form.is_interstate)}
                onChange={onChange}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="0">No</option>
                <option value="1">Yes</option>
              </select>
            </div>
          </div>

          <Separator />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Input name="notes" value={form.notes} onChange={onChange} placeholder="Optional" />
            </div>

            <div className="grid gap-2">
              <Label>Terms</Label>
              <Input name="terms" value={form.terms} onChange={onChange} placeholder="Optional" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Line Items</CardTitle>
          <Button variant="secondary" onClick={addRow}>+ Add Row</Button>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-3 pr-4">#</th>
                  <th className="py-3 pr-4">Item</th>
                  <th className="py-3 pr-4">Description</th>
                  <th className="py-3 pr-4 text-right">Qty</th>
                  {hasPeriodBilling && <th className="py-3 pr-4 text-right">Months</th>}
                  <th className="py-3 pr-4 text-right">Rate</th>
                  <th className="py-3 pr-4 text-right">Disc%</th>
                  <th className="py-3 pr-4 text-right">GST%</th>
                  <th className="py-3 text-right">Action</th>
                </tr>
              </thead>

              <tbody>
                {items.map((it, idx) => (
                  <tr key={idx} className="border-b hover:bg-muted/40">
                    <td className="py-3 pr-4">{idx + 1}</td>

                    <td className="py-3 pr-4">
                      <select
                        value={it.item_id}
                        onChange={(e) => {
                          const selectedId = e.target.value;
                          onItemChange(idx, "item_id", selectedId);

                          const m = itemsMaster.find((x) => String(x.id) === String(selectedId));
                          if (m) {
                            onItemChange(idx, "rate", Number(m.sale_price || 0));
                            onItemChange(idx, "tax_percent", Number(m.tax_percent || 18));
                            if (!it.description) onItemChange(idx, "description", m.name || "");
                          }
                        }}
                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      >
                        <option value="">Select item</option>
                        {itemsMaster.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} (#{m.id})
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="py-3 pr-4">
                      <Input
                        value={it.description}
                        onChange={(e) => onItemChange(idx, "description", e.target.value)}
                        placeholder="Description"
                      />
                    </td>

                    <td className="py-3 pr-4 text-right">
                      <Input
                        type="number"
                        value={it.qty}
                        onChange={(e) => onItemChange(idx, "qty", e.target.value)}
                        className="text-right"
                      />
                    </td>

                    {hasPeriodBilling && (
                      <td className="py-3 pr-4 text-right">
                        {it.is_period_billing ? (
                          <Input
                            type="number"
                            value={it.billing_months}
                            onChange={(e) => onItemChange(idx, "billing_months", e.target.value)}
                            className="text-right"
                            min={1}
                            step="1"
                          />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                    )}


                    <td className="py-3 pr-4 text-right">
                      <Input
                        type="number"
                        value={it.rate}
                        onChange={(e) => onItemChange(idx, "rate", e.target.value)}
                        className="text-right"
                      />
                    </td>

                    <td className="py-3 pr-4 text-right">
                      <Input
                        type="number"
                        value={it.discount_percent}
                        onChange={(e) => onItemChange(idx, "discount_percent", e.target.value)}
                        className="text-right"
                      />
                    </td>

                    <td className="py-3 pr-4 text-right">
                      <Input
                        type="number"
                        value={it.tax_percent}
                        onChange={(e) => onItemChange(idx, "tax_percent", e.target.value)}
                        className="text-right"
                      />
                    </td>

                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant={it.is_period_billing ? "secondary" : "outline"}
                          onClick={() => onItemChange(idx, "is_period_billing", !it.is_period_billing)}
                        >
                          Monthly
                        </Button>
                        <Button variant="outline" onClick={() => removeRow(idx)}>
                          Remove
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}

                {items.length === 0 && (
                  <tr>
                    <td colSpan={hasPeriodBilling ? 9 : 8} className="py-10 text-center text-muted-foreground">
                      No items
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex gap-2">
            <Button onClick={save} disabled={!isDraft || saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
            <Link to={`/invoices/${id}`}>
              <Button variant="secondary" type="button">
                Cancel
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
