import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Landing from "./pages/Landing";
import Pricing from "./pages/Pricing";
import DemoRequest from "./pages/DemoRequest";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import UpdatePassword from "./pages/UpdatePassword";
import SuperAdmin from "./pages/SuperAdmin";
import OrganizationDetail from "./pages/OrganizationDetail";
import Dashboard from "./pages/Dashboard";
import Index from "./pages/Index";
import Onboarding from "./pages/Onboarding";
import Profile from "./pages/Profile";
import Timesheets from "./pages/Timesheets";
import Amendments from "./pages/Amendments";
import Reports from "./pages/Reports";
import Admin from "./pages/Admin";
import AdminWorkers from "./pages/AdminWorkers";
import AdminJobs from "./pages/AdminJobs";
import AdminReports from "./pages/AdminReports";
import AdminAmendments from "./pages/AdminAmendments";
import AdminProfile from "./pages/AdminProfile";
import OrganizationDashboard from "./pages/OrganizationDashboard";
import OrganizationSettings from "./pages/OrganizationSettings";
import AuthConfirm from "./pages/AuthConfirm";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/demo-request" element={<DemoRequest />} />
            <Route path="/admin-portal" element={<Index />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/update-password" element={<UpdatePassword />} />
        <Route path="/auth/confirm" element={<AuthConfirm />} />
            <Route path="/onboarding" element={<Onboarding />} />
            
            {/* Super Admin Routes */}
            <Route 
              path="/super-admin" 
              element={
                <ProtectedRoute requireRole="super_admin">
                  <SuperAdmin />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/organization/:id" 
              element={
                <ProtectedRoute requireRole="super_admin">
                  <OrganizationDetail />
                </ProtectedRoute>
              } 
            />
              
            {/* Organization Routes - accessible by super users only */}
            <Route 
              path="/organization" 
              element={
                <ProtectedRoute requireRole="super">
                  <OrganizationSettings />
                </ProtectedRoute>
              } 
            />
              
            {/* Worker Routes */}
            <Route 
              path="/clock" 
              element={
                <ProtectedRoute requireRole="worker">
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute requireRole="worker">
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/profile" 
              element={
                <ProtectedRoute requireRole="worker">
                  <Profile />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/timesheets" 
              element={
                <ProtectedRoute requireRole="worker">
                  <Timesheets />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/amendments" 
              element={
                <ProtectedRoute requireRole="worker">
                  <Amendments />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/reports" 
              element={
                <ProtectedRoute requireRole="worker">
                  <Reports />
                </ProtectedRoute>
              } 
            />

            {/* Manager Routes (accessible by super_admin too) */}
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute requireRole="manager">
                  <Admin />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/workers" 
              element={
                <ProtectedRoute requireRole="manager">
                  <AdminWorkers />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/jobs" 
              element={
                <ProtectedRoute requireRole="manager">
                  <AdminJobs />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/reports" 
              element={
                <ProtectedRoute requireRole="manager">
                  <AdminReports />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/amendments" 
              element={
                <ProtectedRoute requireRole="manager">
                  <AdminAmendments />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/profile" 
              element={
                <ProtectedRoute requireRole="manager">
                  <AdminProfile />
                </ProtectedRoute>
              } 
            />
              
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
