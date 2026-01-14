import { Route, Routes } from "react-router-dom";
import { lazy, Suspense, ReactNode } from "react";

import { ProtectedRoute } from "@/components/ProtectedRoute";

// Lazy load pages for better performance
const Index = lazy(() => import("@/pages/Index"));
const Landing = lazy(() => import("@/pages/Landing"));
const Login = lazy(() => import("@/pages/Login"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const UpdatePassword = lazy(() => import("@/pages/UpdatePassword"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Admin = lazy(() => import("@/pages/Admin"));
const AdminWorkers = lazy(() => import("@/pages/AdminWorkers"));
const AdminJobs = lazy(() => import("@/pages/AdminJobs"));
const AdminReports = lazy(() => import("@/pages/AdminReports"));
const AdminAmendments = lazy(() => import("@/pages/AdminAmendments"));
const AdminProfile = lazy(() => import("@/pages/AdminProfile"));
const SuperAdmin = lazy(() => import("@/pages/SuperAdmin"));
const Timesheets = lazy(() => import("@/pages/Timesheets"));
const Reports = lazy(() => import("@/pages/Reports"));
const Amendments = lazy(() => import("@/pages/Amendments"));
const Profile = lazy(() => import("@/pages/Profile"));
const Onboarding = lazy(() => import("@/pages/Onboarding"));
const OrganizationDashboard = lazy(() => import("@/pages/OrganizationDashboard"));
const OrganizationDetail = lazy(() => import("@/pages/OrganizationDetail"));
const OrganizationSettings = lazy(() => import("@/pages/OrganizationSettings"));
const DemoRequest = lazy(() => import("@/pages/DemoRequest"));
const Pricing = lazy(() => import("@/pages/Pricing"));
const Resources = lazy(() => import("@/pages/Resources"));
const NotFound = lazy(() => import("@/pages/NotFound"));

// Loading component for Suspense
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

// Route definition type
export interface RouteDefinition {
  path: string;
  element: ReactNode;
  requireRole?: 'super_admin' | 'manager' | 'worker' | ('super_admin' | 'manager' | 'worker')[];
}

// Define all application routes
export const appRoutes: RouteDefinition[] = [
  // Public routes
  { path: "/", element: <Index /> },
  { path: "/landing", element: <Landing /> },
  { path: "/login", element: <Login /> },
  { path: "/forgot-password", element: <ForgotPassword /> },
  { path: "/reset-password", element: <ResetPassword /> },
  { path: "/update-password", element: <UpdatePassword /> },
  { path: "/demo", element: <DemoRequest /> },
  { path: "/pricing", element: <Pricing /> },
  { path: "/resources", element: <Resources /> },

  // Protected routes - Manager
  { path: "/dashboard", element: <Dashboard />, requireRole: "manager" },
  { path: "/admin", element: <Admin />, requireRole: "manager" },
  { path: "/admin/workers", element: <AdminWorkers />, requireRole: "manager" },
  { path: "/admin/jobs", element: <AdminJobs />, requireRole: "manager" },
  { path: "/admin/reports", element: <AdminReports />, requireRole: "manager" },
  { path: "/admin/amendments", element: <AdminAmendments />, requireRole: "manager" },
  { path: "/admin/profile", element: <AdminProfile />, requireRole: "manager" },
  { path: "/timesheets", element: <Timesheets />, requireRole: "manager" },
  { path: "/reports", element: <Reports />, requireRole: "manager" },
  { path: "/amendments", element: <Amendments />, requireRole: "manager" },
  { path: "/profile", element: <Profile />, requireRole: "manager" },
  { path: "/onboarding", element: <Onboarding />, requireRole: "manager" },
  { path: "/organization", element: <OrganizationDashboard />, requireRole: "manager" },
  { path: "/organization/:id", element: <OrganizationDetail />, requireRole: "manager" },
  { path: "/organization/settings", element: <OrganizationSettings />, requireRole: "manager" },

  // Protected routes - Super Admin
  { path: "/super-admin", element: <SuperAdmin />, requireRole: "super_admin" },

  // Catch-all route
  { path: "*", element: <NotFound /> },
];

const renderRoute = (route: RouteDefinition) => {
  const element = route.requireRole ? (
    <ProtectedRoute requireRole={route.requireRole}>
      {route.element}
    </ProtectedRoute>
  ) : (
    route.element
  );

  return <Route key={route.path} path={route.path} element={element} />;
};

const AppRoutes = () => (
  <Suspense fallback={<PageLoader />}>
    <Routes>
      {appRoutes.map(renderRoute)}
    </Routes>
  </Suspense>
);

export default AppRoutes;
