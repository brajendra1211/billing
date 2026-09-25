import { useEffect, useState } from "react";
import { vendorsApi } from "../../api/vendors.api";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function VendorsPage() {
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    gstin: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await vendorsApi.list();
      setRows(res?.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const add = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return alert("Vendor name required");

    setSaving(true);
    try {
      await vendorsApi.create({
        name: form.name.trim(),
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        gstin: form.gstin || null,
        is_active: 1,
      });
      setForm({ name: "", phone: "", email: "", address: "", gstin: "" });
      await load();
      alert("Vendor added ✅");
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Vendors</h2>
          <div className="text-sm text-muted-foreground">
            Manage tea/water/stationery vendors and their details
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="rounded-full">
            Total: <span className="ml-1 font-medium">{rows.length}</span>
          </Badge>
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      {/* Add Vendor */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Add Vendor</CardTitle>
        </CardHeader>

        <CardContent>
          <form onSubmit={add} className="grid gap-5">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="grid gap-2">
                <Label>Vendor Name</Label>
                <Input
                  name="name"
                  value={form.name}
                  onChange={onChange}
                  placeholder="e.g. Tea Vendor / Water Supplier"
                />
              </div>

              <div className="grid gap-2">
                <Label>Phone</Label>
                <Input name="phone" value={form.phone} onChange={onChange} placeholder="Phone" />
              </div>

              <div className="grid gap-2">
                <Label>Email</Label>
                <Input name="email" value={form.email} onChange={onChange} placeholder="Email" />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="grid gap-2">
                <Label>GSTIN</Label>
                <Input name="gstin" value={form.gstin} onChange={onChange} placeholder="GSTIN (optional)" />
              </div>

              <div className="grid gap-2 md:col-span-2">
                <Label>Address</Label>
                <Input name="address" value={form.address} onChange={onChange} placeholder="Address" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Vendor"}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => setForm({ name: "", phone: "", email: "", address: "", gstin: "" })}
                disabled={saving}
              >
                Clear
              </Button>
            </div>

            <div className="text-xs text-muted-foreground">
              Tip: Vendor services add karne ke liye “Vendor Services” page use karo.
            </div>
          </form>
        </CardContent>
      </Card>

      {/* List */}
      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Vendors List</CardTitle>
          <Badge variant="secondary" className="rounded-full">
            {rows.length}
          </Badge>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-3 pr-4">ID</th>
                    <th className="py-3 pr-4">Name</th>
                    <th className="py-3 pr-4">Phone</th>
                    <th className="py-3 pr-4">Email</th>
                    <th className="py-3 pr-4">GSTIN</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b hover:bg-muted/40">
                      <td className="py-3 pr-4 font-medium">#{r.id}</td>
                      <td className="py-3 pr-4">{r.name}</td>
                      <td className="py-3 pr-4">{r.phone || "—"}</td>
                      <td className="py-3 pr-4">{r.email || "—"}</td>
                      <td className="py-3 pr-4">{r.gstin || "—"}</td>
                    </tr>
                  ))}

                  {rows.length === 0 && (
                    <tr>
                      <td colSpan="5" className="py-10 text-center text-muted-foreground">
                        No vendors
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <Separator className="my-4" />
              <div className="text-xs text-muted-foreground">
                {/* Next: yahi list me Edit/Deactivate bhi add kar sakte hain. */}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
