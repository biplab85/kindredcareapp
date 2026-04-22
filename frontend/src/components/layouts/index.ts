export { PublicLayout } from "./public-layout";
export { FamilyLayout } from "./family-layout";
export { CaregiverLayout } from "./caregiver-layout";
export { AdminLayout } from "./admin-layout";
export { Header } from "./header";
export { Footer } from "./footer";
export { Sidebar } from "./sidebar";
export { MobileNav } from "./mobile-nav";
export { AppHeader } from "./app-header";
export type { NavItem } from "./sidebar";

// Editorial shell + primitives — kept for pages that still want the
// paper-wash / § / italic vocabulary inside their content.
export { AppShell } from "./app-shell";
export { PageHeader } from "./page-header";
export { MetricCard } from "./metric-card";
export { SectionCard } from "./section-card";

// Dashboard shell — the modern sidebar layout that wraps every signed-in page.
export { DashboardShell } from "./dashboard-shell";
export { DashboardSidebar } from "./dashboard-sidebar";
export type { DashboardNavBadges } from "./dashboard-sidebar";
export { DashboardTopbar } from "./dashboard-topbar";
export { DashboardMetric } from "./dashboard-metric";
