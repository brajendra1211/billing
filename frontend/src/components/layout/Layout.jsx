import { Link, NavLink, Outlet } from "react-router-dom";
import { API_BASE_URL } from "../../api/axios";
import { useMemo } from "react";
import {
  LayoutDashboard,
  Users2,
  Package,
  FileText,
  Settings,
  Users,
  LogOut,
  BarChart3,
  Menu,
  Wallet,
  Building2,   // ✅ add
  ReceiptText, // ✅ add
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/context/AuthContext";

function navClass({ isActive }) {
  return [
    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition",
    isActive
      ? "bg-muted text-foreground font-medium"
      : "text-muted-foreground hover:bg-muted hover:text-foreground",
  ].join(" ");
}

function RoleBadge({ role }) {
  const r = String(role || "").toUpperCase();
  const label = r || "GUEST";

  return (
    <Badge variant="secondary" className="rounded-full">
      {label}
    </Badge>
  );
}

function SidebarNav({ role }) {
  const r = String(role || "").toUpperCase();

  return (
    <div className="flex flex-col gap-2">
      <NavLink to="/" end className={navClass}>
        <LayoutDashboard className="h-4 w-4" />
        Dashboard
      </NavLink>

      {(r === "ADMIN" || r === "STAFF") && (
        <>
          <NavLink to="/customers" className={navClass}>
            <Users2 className="h-4 w-4" />
            Customers
          </NavLink>

          <NavLink to="/items" className={navClass}>
            <Package className="h-4 w-4" />
            Items
          </NavLink>
        </>
      )}

      <NavLink to="/invoices" className={navClass}>
        <FileText className="h-4 w-4" />
        Invoices
      </NavLink>

      <NavLink to="/reports" className={navClass}>
        <BarChart3 className="h-4 w-4" />
        Reports
      </NavLink>

      {(r === "ADMIN" || r === "STAFF") && (
      <>
        <NavLink to="/expenses" className={navClass}>
          <Wallet className="h-4 w-4" />
          Expenses
        </NavLink>

        <NavLink to="/expenses/categories" className={navClass}>
          <Wallet className="h-4 w-4" />
          Expense Categories
        </NavLink>
      </>
    )}

          {/* Vendors module (ADMIN + STAFF) */}
      {(r === "ADMIN" || r === "STAFF") && (
        <>
          <Separator className="my-2" />

          <div className="px-3 pt-1 text-xs font-medium text-muted-foreground">
            Vendors & Monthly Bills
          </div>

          <NavLink to="/vendors" className={navClass}>
            <Building2 className="h-4 w-4" />
            Vendors
          </NavLink>

          <NavLink to="/vendors/services" className={navClass}>
            <ReceiptText className="h-4 w-4" />
            Vendor Services
          </NavLink>

          <NavLink to="/vendors/consumption" className={navClass}>
            <ReceiptText className="h-4 w-4" />
            Daily Consumption
          </NavLink>

          <NavLink to="/vendors/bills" className={navClass}>
            <ReceiptText className="h-4 w-4" />
            Vendor Bills
          </NavLink>
        </>
      )}

      <NavLink to="/renewals" className={navClass}>
        <FileText className="h-4 w-4" />
        Renewals
      </NavLink>




      {r === "ADMIN" && (
        <>
          <Separator className="my-2" />

          <NavLink to="/users" className={navClass}>
            <Users className="h-4 w-4" />
            Users
          </NavLink>

          <NavLink to="/settings/company" className={navClass}>
            <Settings className="h-4 w-4" />
            Company Settings
          </NavLink>
        </>
      )}
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();

  const role = useMemo(() => {
    return (
      String(user?.role || localStorage.getItem("role") || "").toUpperCase() || "GUEST"
    );
  }, [user]);

  const name = user?.full_name || user?.name || user?.email || "User";

  const onLogout = () => {
    logout();
    window.location.href = "/login";
  };

  return (
    <div className="min-h-svh bg-background">
      {/* Topbar */}
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4">
          {/* Mobile menu */}
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] p-0">
                <div className="p-4">
                  <Link to="/" className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-xl bg-primary/10" />
                    <div className="leading-tight">
                      <div className="font-semibold">Urgent Billing</div>
                      <div className="text-xs text-muted-foreground">Admin Panel</div>
                    </div>
                  </Link>

                  <div className="mt-4">
                    <SidebarNav role={role} />
                  </div>

                  <Separator className="my-4" />

                  <div className="text-xs text-muted-foreground">
                    Backend: <span className="font-medium">{API_BASE_URL}</span>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-primary/10" />
            <div className="leading-tight">
              <div className="font-semibold">Urgent Billing</div>
              <div className="text-xs text-muted-foreground hidden sm:block">
                Billing • Invoices • Reports
              </div>
            </div>
          </Link>

          <div className="flex-1" />

          {/* Right */}
          <div className="flex items-center gap-3">
            <RoleBadge role={role} />
            <div className="hidden sm:flex flex-col leading-tight">
              <div className="text-sm font-medium">{name}</div>
              <div className="text-xs text-muted-foreground">Signed in</div>
            </div>

            <Button variant="outline" onClick={onLogout} className="gap-2">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main layout */}
      {/* Main layout */}
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 md:grid-cols-[260px_1fr] h-[calc(100svh-56px)]">
        {/* Sidebar desktop */}
        <aside className="hidden md:block border-r overflow-y-auto">
          <div className="p-4">
            <div className="rounded-xl border bg-card p-3">
              <div className="flex items-center gap-2 px-2 py-1">
                <div className="h-8 w-8 rounded-xl bg-primary/10" />
                <div className="leading-tight">
                  <div className="font-semibold">Navigation</div>
                  <div className="text-xs text-muted-foreground">Quick access</div>
                </div>
              </div>

              <Separator className="my-3" />
              <SidebarNav role={role} />

              <Separator className="my-4" />
              <div className="px-2 text-xs text-muted-foreground">
                Backend: <span className="font-medium">{API_BASE_URL}</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Content */}
        <main className="overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>

    </div>
  );
}
