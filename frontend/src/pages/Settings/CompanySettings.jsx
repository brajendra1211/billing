import { useEffect, useState } from "react";
import { companyApi } from "../../api/company.api";
import { API_BASE_URL } from "../../api/axios";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

const empty = {
  name: "",
  legal_name: "",
  gstin: "",
  pan: "",
  billing_address_line1: "",
  billing_address_line2: "",
  billing_city: "",
  billing_state: "",
  billing_pincode: "",
  bank_name: "",
  bank_account_no: "",
  bank_ifsc: "",
  upi_id: "",

  logo_url: "",
  signature_url: "",
};

export default function CompanySettings() {
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await companyApi.getMe();
      setForm({ ...empty, ...(res.data || {}) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onChange = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      delete payload.logo_url;
      delete payload.signature_url;

      await companyApi.updateMe(payload);
      alert("Company settings saved ✅");
      await load();
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Company Settings</h2>
          <div className="text-sm text-muted-foreground">
            Update company profile, bank details and invoice logo/signature
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="rounded-full">
            ADMIN only
          </Badge>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>

      {/* Basic */}
      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Basic</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label>Company Name</Label>
            <Input name="name" value={form.name || ""} onChange={onChange} />
          </div>

          <div className="grid gap-2">
            <Label>Legal Name</Label>
            <Input name="legal_name" value={form.legal_name || ""} onChange={onChange} />
          </div>

          <div className="grid gap-2">
            <Label>GSTIN</Label>
            <Input name="gstin" value={form.gstin || ""} onChange={onChange} />
          </div>

          <div className="grid gap-2">
            <Label>PAN</Label>
            <Input name="pan" value={form.pan || ""} onChange={onChange} />
          </div>
        </CardContent>
      </Card>

      {/* Billing Address */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Billing Address</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label>Address Line 1</Label>
            <Input
              name="billing_address_line1"
              value={form.billing_address_line1 || ""}
              onChange={onChange}
            />
          </div>

          <div className="grid gap-2">
            <Label>Address Line 2</Label>
            <Input
              name="billing_address_line2"
              value={form.billing_address_line2 || ""}
              onChange={onChange}
            />
          </div>

          <div className="grid gap-2">
            <Label>City</Label>
            <Input name="billing_city" value={form.billing_city || ""} onChange={onChange} />
          </div>

          <div className="grid gap-2">
            <Label>State</Label>
            <Input
              name="billing_state"
              value={form.billing_state || ""}
              onChange={onChange}
            />
          </div>

          <div className="grid gap-2 md:col-span-2">
            <Label>Pincode</Label>
            <Input
              name="billing_pincode"
              value={form.billing_pincode || ""}
              onChange={onChange}
            />
          </div>
        </CardContent>
      </Card>

      {/* Bank / UPI */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Bank / UPI</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label>Bank Name</Label>
            <Input name="bank_name" value={form.bank_name || ""} onChange={onChange} />
          </div>

          <div className="grid gap-2">
            <Label>Account No</Label>
            <Input
              name="bank_account_no"
              value={form.bank_account_no || ""}
              onChange={onChange}
            />
          </div>

          <div className="grid gap-2">
            <Label>IFSC</Label>
            <Input name="bank_ifsc" value={form.bank_ifsc || ""} onChange={onChange} />
          </div>

          <div className="grid gap-2">
            <Label>UPI ID</Label>
            <Input name="upi_id" value={form.upi_id || ""} onChange={onChange} />
          </div>
        </CardContent>
      </Card>

      {/* Logo / Signature */}
      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Logo / Signature</CardTitle>
          <Badge variant="secondary" className="rounded-full">
            max 2MB
          </Badge>
        </CardHeader>

        <CardContent className="grid gap-4 md:grid-cols-2">
          {/* Logo */}
          <div className="rounded-xl border p-4 space-y-3">
            <div className="space-y-1">
              <div className="font-medium">Logo</div>
              <div className="text-xs text-muted-foreground">
                PNG/JPG/WEBP (recommended: transparent PNG)
              </div>
            </div>

            <Input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  await companyApi.uploadLogo(file);
                  alert("Logo uploaded ✅");
                  await load();
                } catch (err) {
                  alert(err?.response?.data?.error || err.message);
                } finally {
                  e.target.value = "";
                }
              }}
            />

            {form.logo_url ? (
              <div className="rounded-lg border bg-muted/20 p-3 flex items-center justify-center">
                <img
                  src={`${API_BASE_URL}${form.logo_url}`}
                  alt="logo"
                  className="max-h-[70px] max-w-[220px] rounded-md"
                />
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No logo uploaded</div>
            )}
          </div>

          {/* Signature */}
          <div className="rounded-xl border p-4 space-y-3">
            <div className="space-y-1">
              <div className="font-medium">Signature</div>
              <div className="text-xs text-muted-foreground">
                PNG/JPG/WEBP (recommended: sign in black on white/transparent)
              </div>
            </div>

            <Input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  await companyApi.uploadSignature(file);
                  alert("Signature uploaded ✅");
                  await load();
                } catch (err) {
                  alert(err?.response?.data?.error || err.message);
                } finally {
                  e.target.value = "";
                }
              }}
            />

            {form.signature_url ? (
              <div className="rounded-lg border bg-muted/20 p-3 flex items-center justify-center">
                <img
                  src={`${API_BASE_URL}${form.signature_url}`}
                  alt="signature"
                  className="max-h-[70px] max-w-[220px] rounded-md"
                />
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No signature uploaded</div>
            )}
          </div>

          <Separator className="md:col-span-2" />

          <div className="md:col-span-2 text-xs text-muted-foreground">
            Note: Only ADMIN can update settings and upload logo/signature.
          </div>
        </CardContent>
      </Card>

      {/* Bottom Save (optional duplicate button) */}
      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
