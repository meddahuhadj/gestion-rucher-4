import { createBrowserRouter, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { AppShell } from "@/layouts/AppShell";
import { ComingSoon } from "@/components/ComingSoon";

const DashboardPage = lazy(() => import("@/features/dashboard/DashboardPage"));
const HivesPage = lazy(() => import("@/features/hives/HivesPage"));
const HiveDetailPage = lazy(() => import("@/features/hives/HiveDetailPage"));
const ApiariesPage = lazy(() => import("@/features/apiaries/ApiariesPage"));
const MoumenPage = lazy(() => import("@/features/moumen/MoumenPage"));
const VisionPage = lazy(() => import("@/features/vision/VisionPage"));
const FinancePage = lazy(() => import("@/features/finance/FinancePage"));
const HarvestsPage = lazy(() => import("@/features/harvests/HarvestsPage"));
const QueensPage = lazy(() => import("@/features/queens/QueensPage"));
const TreatmentsPage = lazy(() => import("@/features/treatments/TreatmentsPage"));
const AnalyticsPage = lazy(() => import("@/features/analytics/AnalyticsPage"));
const TasksPage = lazy(() => import("@/features/tasks/TasksPage"));
const CalendarPage = lazy(() => import("@/features/calendar/CalendarPage"));
const LoginPage = lazy(() => import("@/features/auth/LoginPage"));
const SmartInspectionPage = lazy(() => import("@/features/inspections/SmartInspectionPage"));
const ReportsPage = lazy(() => import("@/features/reports/ReportsPage"));
const SettingsPage = lazy(() => import("@/features/settings/SettingsPage"));

const Loading = () => (
  <div className="p-8 text-sm text-muted">Chargement…</div>
);

const wrap = (el: React.ReactNode) => <Suspense fallback={<Loading />}>{el}</Suspense>;

export const router: ReturnType<typeof createBrowserRouter> = createBrowserRouter([
  { path: "/login", element: wrap(<LoginPage />) },
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: wrap(<DashboardPage />) },
      { path: "apiaries", element: wrap(<ApiariesPage />) },
      { path: "hives", element: wrap(<HivesPage />) },
      { path: "hives/:id", element: wrap(<HiveDetailPage />) },
      { path: "hives/:id/inspect", element: wrap(<SmartInspectionPage />) },
      { path: "inspections", element: <ComingSoon titleKey="nav.inspections" /> },
      { path: "calendar", element: wrap(<CalendarPage />) },
      { path: "tasks", element: wrap(<TasksPage />) },
      { path: "queens", element: wrap(<QueensPage />) },
      { path: "treatments", element: wrap(<TreatmentsPage />) },
      { path: "harvests", element: wrap(<HarvestsPage />) },
      { path: "finance", element: wrap(<FinancePage />) },
      { path: "analytics", element: wrap(<AnalyticsPage />) },
      { path: "moumen", element: wrap(<MoumenPage />) },
      { path: "vision", element: wrap(<VisionPage />) },
      { path: "reports", element: wrap(<ReportsPage />) },
      { path: "settings", element: wrap(<SettingsPage />) },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
