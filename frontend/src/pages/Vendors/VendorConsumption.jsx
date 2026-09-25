import { useEffect, useMemo, useState } from "react";
import { vendorsApi } from "../../api/vendors.api";

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

function Money({ value }) {
  const n = Number(value || 0);
  return <span>₹ {Number.isFinite(n) ? n.toLocaleString("en-IN") : value}</span>;
}

export default function VendorConsumption() {
  const [vendors, setVendors] = useState([]);
  const [vendorId, setVendorId] = useState("");
  const [date, setDate] = useState(todayISO());

  // template+saved merged rows
  // shape: { service_id, service_name, unit, rate, qty, amount }
  const [lines, setLines] = useState([]);

  // recent entries (your existing list)
  const [rows, setRows] = useState([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const totalAmount = useMemo(() => {
    return lines.reduce((sum, l) => sum + Number(l.amount || 0), 0);
  }, [lines]);

  const loadVendors = async () => {
    const r = await vendorsApi.list();
    setVendors(r.data || []);
  };

  // ✅ NEW: load day template merged (preferred)
  const loadDay = async (vid, day) => {
    // If you have this endpoint:
    // GET /api/vendors/:vendorId/consumption/day?date=YYYY-MM-DD
    // return { data: [{service_id, service_name, unit, rate, qty, amount}] }
    try {
      const res = await vendorsApi.consumptionDay(vid, day);
      setLines(res?.data || []);
      return;
    } catch {
      // fallback: old flow (servicesList + existing consumptionList)
      const svc = await vendorsApi.servicesList(vid);
      const services = svc.data || [];

      const list = await vendorsApi.consumptionList({
        vendor_id: vid,
        from: day,
        to: day,
      });
      const existing = list.data || [];

      // merge by service
      const map = new Map();
      existing.forEach((e) => {
        map.set(Number(e.service_id), {
          service_id: Number(e.service_id),
          service_name: e.service_name,
          unit: e.unit,
          rate: Number(e.rate || 0),
          qty: Number(e.qty || 0),
          amount: Number(e.amount || 0),
        });
      });

      const merged = services.map((s) => {
        const key = Number(s.id);
        const found = map.get(key);
        const qty = found ? Number(found.qty || 0) : 0;
        const rate = Number(s.rate || found?.rate || 0);
        return {
          service_id: key,
          service_name: s.name,
          unit: s.unit,
          rate,
          qty,
          amount: Number((qty * rate).toFixed(2)),
        };
      });

      setLines(merged);
    }
  };

  const loadRecent = async (vid) => {
    const r = await vendorsApi.consumptionList({
      vendor_id: vid || "",
      from: "",
      to: "",
    });
    setRows(r.data || []);
  };

  useEffect(() => {
    loadVendors();
  }, []);

  useEffect(() => {
    const run = async () => {
      if (!vendorId) {
        setLines([]);
        setRows([]);
        return;
      }
      setLoading(true);
      try {
        await loadDay(vendorId, date);
        await loadRecent(vendorId);
      } finally {
        setLoading(false);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId, date]);

  const setQty = (serviceId, qty) => {
    const q = Math.max(0, Number(qty || 0));
    setLines((prev) =>
      prev.map((l) => {
        if (Number(l.service_id) !== Number(serviceId)) return l;
        const rate = Number(l.rate || 0);
        return {
          ...l,
          qty: q,
          amount: Number((q * rate).toFixed(2)),
        };
      })
    );
  };

  const inc = (serviceId, delta) => {
    const line = lines.find((x) => Number(x.service_id) === Number(serviceId));
    const cur = Number(line?.qty || 0);
    setQty(serviceId, cur + delta);
  };

  const saveAll = async () => {
    if (!vendorId) return alert("Select vendor");

    // only non-zero qty lines
    const payloadLines = lines
      .filter((l) => Number(l.qty || 0) > 0)
      .map((l) => ({
        service_id: Number(l.service_id),
        qty: Number(l.qty || 0),
        notes: null,
      }));

    if (payloadLines.length === 0) return alert("Enter qty for at least one item");

    setSaving(true);
    try {
      // ✅ Preferred bulk endpoint
      if (vendorsApi.consumptionBulk) {
        await vendorsApi.consumptionBulk({
          vendor_id: Number(vendorId),
          consume_date: date,
          lines: payloadLines,
        });
      } else {
        // fallback (existing single insert API)
        for (const ln of payloadLines) {
          await vendorsApi.consumptionCreate({
            vendor_id: Number(vendorId),
            service_id: Number(ln.service_id),
            consume_date: date,
            qty: Number(ln.qty),
            notes: null,
          });
        }
      }

      await loadDay(vendorId, date);
      await loadRecent(vendorId);
      alert("Saved ✅");
    } catch (e) {
      alert(e?.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Daily Consumption</h2>
          <div className="text-sm text-muted-foreground">
            Tea / Water / Stationery — daily qty entry (fast mode)
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="rounded-full">
            Total: <span className="ml-1 font-medium"><Money value={totalAmount} /></span>
          </Badge>
            <Button type="button" onClick={saveAll} disabled={!vendorId || saving || loading}>
            {saving ? "Saving..." : "Save All"}
            </Button>

        </div>
      </div>

      {/* Filters */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Select Vendor & Date</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label>Vendor</Label>
            <select
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">Select vendor</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Template lines */}
      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Today’s Items</CardTitle>
          <Badge variant="secondary" className="rounded-full">
            {lines.length}
          </Badge>
        </CardHeader>

        <CardContent>
          {!vendorId ? (
            <div className="text-sm text-muted-foreground">Select vendor to load template.</div>
          ) : loading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : (
            <div className="space-y-3">
              {lines.map((l) => (
                <div
                  key={l.service_id}
                  className="flex flex-col gap-2 rounded-xl border p-3 md:flex-row md:items-center"
                >
                  <div className="flex-1">
                    <div className="font-medium">{l.service_name}</div>
                    <div className="text-xs text-muted-foreground">
                      Unit: {l.unit} • Rate: {l.rate}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => inc(l.service_id, -1)}
                    >
                      -
                    </Button>

                    <Input
                      type="number"
                      value={l.qty}
                      onChange={(e) => setQty(l.service_id, e.target.value)}
                      className="w-[110px]"
                      min="0"
                    />

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => inc(l.service_id, 1)}
                    >
                      +
                    </Button>
                  </div>

                  <div className="text-right md:w-[140px]">
                    <div className="text-xs text-muted-foreground">Amount</div>
                    <div className="font-semibold">
                      <Money value={l.amount} />
                    </div>
                  </div>
                </div>
              ))}

              {lines.length === 0 && (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  No template items found.
                  <div className="mt-2">
                    Go to <span className="font-medium">Vendor Services</span> and add Tea/Water services.
                  </div>
                </div>
              )}

              <Separator />

              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Grand Total</div>
                <div className="text-lg font-semibold">
                  <Money value={totalAmount} />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent entries */}
      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent Entries</CardTitle>
          <Badge variant="secondary" className="rounded-full">
            {rows.length}
          </Badge>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-3 pr-4">Date</th>
                  <th className="py-3 pr-4">Vendor</th>
                  <th className="py-3 pr-4">Item</th>
                  <th className="py-3 pr-4 text-right">Qty</th>
                  <th className="py-3 pr-4 text-right">Rate</th>
                  <th className="py-3 text-right">Amount</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-muted/40">
                    <td className="py-3 pr-4">{r.consume_date}</td>
                    <td className="py-3 pr-4">{r.vendor_name}</td>
                    <td className="py-3 pr-4">
                      {r.service_name} <span className="text-muted-foreground">({r.unit})</span>
                    </td>
                    <td className="py-3 pr-4 text-right">{r.qty}</td>
                    <td className="py-3 pr-4 text-right">{r.rate}</td>
                    <td className="py-3 text-right font-medium">
                      <Money value={r.amount} />
                    </td>
                  </tr>
                ))}

                {rows.length === 0 && (
                  <tr>
                    <td colSpan="6" className="py-10 text-center text-muted-foreground">
                      No entries
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
