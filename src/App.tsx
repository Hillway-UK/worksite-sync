import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Login from "./pages/Login";
import Clock from "./pages/Clock";
import Admin from "./pages/Admin";
import AdminWorkers from "./pages/AdminWorkers";
import AdminJobs from "./pages/AdminJobs";
import AdminReports from "./pages/AdminReports";
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
            <Route path="/login" element={<Login />} />
            <Route 
              path="/clock" 
              element={
                <ProtectedRoute requireRole="worker">
                  <Clock />
                </ProtectedRoute>
              } 
            />
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
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
