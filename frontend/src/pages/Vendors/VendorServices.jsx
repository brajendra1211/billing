import { useEffect, useMemo, useState } from "react";
import { vendorsApi } from "../../api/vendors.api";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function VendorServices() {
  const [vendors, setVendors] = useState([]);
  const [vendorId, setVendorId] = useState("");
  const [services, setServices] = useState([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({ name: "", unit: "cup", rate: "" });

  // edit state
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", unit: "", rate: "", is_active: 1 });

  const activeCount = useMemo(
    () => services.filter((s) => Number(s.is_active || 1) === 1).length,
    [services]
  );

  const loadVendors = async () => {
    const r = await vendorsApi.list();
    setVendors(r.data || []);
  };

  const normalizeServices = (res) => {
    const arr = Array.isArray(res?.data) ? res.data : (res?.data?.data || []);
    return Array.isArray(arr) ? arr : [];
  };

  const loadServices = async (vid) => {
    setLoading(true);
    try {
      const res = await vendorsApi.servicesList(Number(vid));
      setServices(normalizeServices(res));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVendors();
  }, []);

  useEffect(() => {
    if (vendorId) loadServices(vendorId);
    else setServices([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId]);

  const add = async (e) => {
    e.preventDefault();
    if (!vendorId) return alert("Select vendor");
    if (!form.name.trim()) return alert("Service name required");
    if (!form.rate) return alert("Rate required");

    setSaving(true);
    try {
      await vendorsApi.serviceCreate({
        vendor_id: Number(vendorId),
        name: form.name.trim(),
        unit: form.unit.trim(),
        rate: Number(form.rate),
        is_active: 1,
      });

      setForm({ name: "", unit: "cup", rate: "" });
      await loadServices(vendorId);
      alert("Service added ✅");
    } catch (e2) {
      alert(e2?.response?.data?.error || e2.message);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (s) => {
    setEditingId(s.id);
    setEditForm({
      name: s.name || "",
      unit: s.unit || "",
      rate: String(s.rate ?? ""),
      is_active: Number(s.is_active ?? 1),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ name: "", unit: "", rate: "", is_active: 1 });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    if (!editForm.name.trim()) return alert("Name required");
    if (!editForm.rate) return alert("Rate required");

    setSaving(true);
    try {
      await vendorsApi.serviceUpdate(editingId, {
        name: editForm.name.trim(),
        unit: (editForm.unit || "").trim(),
        rate: Number(editForm.rate),
        is_active: Number(editForm.is_active) === 1 ? 1 : 0,
      });

      await loadServices(vendorId);
      cancelEdit();
      alert("Updated ✅");
    } catch (e) {
      alert(e?.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (s) => {
    const willActivate = Number(s.is_active || 1) === 0;
    const ok = confirm(willActivate ? "Activate this service?" : "Deactivate this service?");
    if (!ok) return;

    setSaving(true);
    try {
      if (willActivate) await vendorsApi.serviceActivate(s.id);
      else await vendorsApi.serviceDeactivate(s.id);

      await loadServices(vendorId);
      alert(willActivate ? "Activated ✅" : "Deactivated ✅");
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
          <h2 className="text-2xl font-semibold tracking-tight">Vendor Services</h2>
          <div className="text-sm text-muted-foreground">
            Tea/Water/Stationery rate list (vendor wise)
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="rounded-full">
            Active: <span className="ml-1 font-medium">{activeCount}</span>
          </Badge>
          <Badge variant="secondary" className="rounded-full">
            Total: <span className="ml-1 font-medium">{services.length}</span>
          </Badge>
        </div>
      </div>

      {/* Vendor select */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Select Vendor</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
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
        </CardContent>
      </Card>

      {/* Add service */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Add Service</CardTitle>
        </CardHeader>

        <CardContent>
          <form onSubmit={add} className="grid gap-4 md:grid-cols-3">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Tea / Water Jar / Stationery"
              />
            </div>

            <div className="grid gap-2">
              <Label>Unit</Label>
              <Input
                value={form.unit}
                onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
                placeholder="cup / jar / packet"
              />
            </div>

            <div className="grid gap-2">
              <Label>Rate</Label>
              <Input
                type="number"
                value={form.rate}
                onChange={(e) => setForm((p) => ({ ...p, rate: e.target.value }))}
                placeholder="rate per unit"
              />
            </div>

            <div className="md:col-span-3">
              <Button type="submit" disabled={!vendorId || saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
              {!vendorId && (
                <span className="ml-3 text-sm text-muted-foreground">
                  Select vendor first
                </span>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Services list */}
      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Services</CardTitle>
          <Badge variant="secondary" className="rounded-full">
            {services.length}
          </Badge>
        </CardHeader>

        <CardContent>
          {!vendorId ? (
            <div className="text-sm text-muted-foreground">Select vendor to view services.</div>
          ) : loading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-3 pr-4">ID</th>
                    <th className="py-3 pr-4">Name</th>
                    <th className="py-3 pr-4">Unit</th>
                    <th className="py-3 pr-4 text-right">Rate</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {services.map((s) => {
                    const isActive = Number(s.is_active ?? 1) === 1;
                    const isEditing = editingId === s.id;

                    return (
                      <tr key={s.id} className="border-b hover:bg-muted/40">
                        <td className="py-3 pr-4">{s.id}</td>

                        <td className="py-3 pr-4">
                          {isEditing ? (
                            <Input
                              value={editForm.name}
                              onChange={(e) =>
                                setEditForm((p) => ({ ...p, name: e.target.value }))
                              }
                            />
                          ) : (
                            <span className={isActive ? "" : "text-muted-foreground line-through"}>
                              {s.name}
                            </span>
                          )}
                        </td>

                        <td className="py-3 pr-4">
                          {isEditing ? (
                            <Input
                              value={editForm.unit}
                              onChange={(e) =>
                                setEditForm((p) => ({ ...p, unit: e.target.value }))
                              }
                            />
                          ) : (
                            <span className={isActive ? "" : "text-muted-foreground"}>
                              {s.unit}
                            </span>
                          )}
                        </td>

                        <td className="py-3 pr-4 text-right">
                          {isEditing ? (
                            <Input
                              type="number"
                              value={editForm.rate}
                              onChange={(e) =>
                                setEditForm((p) => ({ ...p, rate: e.target.value }))
                              }
                            />
                          ) : (
                            <span className={isActive ? "font-medium" : "text-muted-foreground"}>
                              {s.rate}
                            </span>
                          )}
                        </td>

                        <td className="py-3 pr-4">
                          <Badge
                            className={
                              isActive
                                ? "rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                                : "rounded-full bg-red-100 text-red-700 hover:bg-red-100"
                            }
                          >
                            {isActive ? "ACTIVE" : "INACTIVE"}
                          </Badge>
                        </td>

                        <td className="py-3 text-right">
                          {isEditing ? (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                onClick={saveEdit}
                                disabled={saving}
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={cancelEdit}
                                disabled={saving}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => startEdit(s)}
                                disabled={saving}
                              >
                                Edit
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => toggleActive(s)}
                                disabled={saving}
                              >
                                {isActive ? "Deactivate" : "Activate"}
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {services.length === 0 && (
                    <tr>
                      <td colSpan="6" className="py-10 text-center text-muted-foreground">
                        No services
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <Separator className="my-4" />

              <div className="text-xs text-muted-foreground">
                Tip: Delete ki jagah Deactivate use karo (billing safe rahega).
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
