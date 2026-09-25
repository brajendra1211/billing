import { Routes, Route } from "react-router-dom";
import Layout from "../components/layout/Layout";
import Dashboard from "../pages/Dashboard/Dashboard";
import CustomersPage from "../pages/Customers/CustomersPage";
import ItemsPage from "../pages/Items/ItemsPage";
import Login from "../pages/Auth/Login";
import ProtectedRoute from "./ProtectedRoute";
import InvoicesList from "../pages/Invoices/InvoicesList";
import InvoiceCreate from "../pages/Invoices/InvoiceCreate";
import InvoiceView from "../pages/Invoices/InvoiceView";
import CompanySettings from "../pages/Settings/CompanySettings";
import UsersPage from "../pages/Users/UsersPage";
import ReportsDashboard from "../pages/Reports/ReportsDashboard";
import InvoiceEdit from "@/pages/Invoices/InvoiceEdit";
import ExpensesList from "../pages/Expenses/ExpensesList";
import ExpenseCategories from "../pages/Expenses/ExpenseCategories";
import VendorsPage from "../pages/Vendors/VendorsPage";
import VendorServices from "../pages/Vendors/VendorServices";
import VendorConsumption from "../pages/Vendors/VendorConsumption";
import VendorBills from "../pages/Vendors/VendorBills";
import RenewalsList from "@/pages/Renewals/RenewalsList";
import RenewalCreate from "@/pages/Renewals/RenewalCreate";
import RenewalView from "@/pages/Renewals/RenewalView";
import NotificationSettings from "@/pages/Settings/NotificationSettings";
import CustomerPortal from "@/pages/Portal/CustomerPortal";



export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/portal/:token" element={<CustomerPortal />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/items" element={<ItemsPage />} />
          <Route path="/invoices" element={<InvoicesList />} />
          <Route path="/invoices/create" element={<InvoiceCreate />} />
          <Route path="/invoices/:id" element={<InvoiceView />} />
          <Route path="/settings/company" element={<CompanySettings />} />
          <Route path="/users" element={<UsersPage />} />
         <Route path="/reports" element={<ReportsDashboard />} />
         <Route path="/invoices/:id/edit" element={<InvoiceEdit />} />
         <Route path="/expenses" element={<ExpensesList />} />
         <Route path="/expenses/categories" element={<ExpenseCategories />} />
         
          <Route path="/vendors" element={<VendorsPage />} />
          <Route path="/vendors/services" element={<VendorServices />} />
          <Route path="/vendors/consumption" element={<VendorConsumption />} />
          <Route path="/vendors/consumption/bulk" element={<VendorConsumption />} />
          <Route path="/vendors/bills" element={<VendorBills />} />
          <Route path="/renewals" element={<RenewalsList />} />
          <Route path="/renewals/create" element={<RenewalCreate />} />
          <Route path="/renewals/:id" element={<RenewalView />} />
          <Route path="/settings/notifications" element={<NotificationSettings />} />
          


        </Route>
      </Route>
    </Routes>
  );
}
