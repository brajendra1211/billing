import { useState } from "react";
import api, { API_BASE_URL } from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

export default function Login() {
  const [email, setEmail] = useState("admin@urgent.com");
  const [password, setPassword] = useState("Admin@123");
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post("/api/auth/login", { email, password });
      login({ token: res.data.token, user: res.data.user });
      nav("/", { replace: true });
    } catch (err) {
      alert(err?.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-svh flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-4">
        {/* Brand Header */}
        <div className="text-center space-y-1">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/10" />
          <div className="text-2xl font-semibold tracking-tight">Urgent Billing</div>
          <div className="text-sm text-muted-foreground">
            Login to continue
          </div>
        </div>

        <Card className="rounded-2xl">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Sign in</CardTitle>
              <Badge variant="secondary" className="rounded-full">
                Admin / Staff
              </Badge>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={submit} className="grid gap-4">
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@urgent.com"
                  autoComplete="email"
                />
              </div>

              <div className="grid gap-2">
                <Label>Password</Label>
                <Input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  type="password"
                  autoComplete="current-password"
                />
              </div>

              <Button disabled={loading} className="w-full">
                {loading ? "Please wait..." : "Login"}
              </Button>

              <Separator />

              <div className="text-xs text-muted-foreground">
                Tip: If login fails, check backend running on{" "}
                <span className="font-medium">{API_BASE_URL}</span>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Urgent Billing
        </div>
      </div>
    </div>
  );
}
