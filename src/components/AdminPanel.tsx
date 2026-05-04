import { useAuth } from "@/hooks/useAuth";
import { DiwaneAdminDashboard } from "@/components/admin/DiwaneAdminDashboard";
import { SuperAdminPanel } from "@/components/admin/SuperAdminPanel";

export default function AdminPanel() {
  const { access, managedDiwaneIds } = useAuth();

  if (access === "super_admin") {
    return <SuperAdminPanel />;
  }
  if (access === "diwane_admin") {
    return <DiwaneAdminDashboard managedDiwaneIds={managedDiwaneIds} />;
  }
  if (access === "platform_admin") {
    return <DiwaneAdminDashboard managedDiwaneIds={null} />;
  }
  return null;
}
