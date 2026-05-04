import { useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AccessLevel = "member" | "diwane_admin" | "super_admin" | "platform_admin";

/** Compat: "admin" si l'utilisateur a un espace d'administration (tout sauf membre) */
export type Role = "admin" | "member" | null;

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [access, setAccess] = useState<AccessLevel>("member");
  const [managedDiwaneIds, setManagedDiwaneIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchAccess(user: User) {
    const userId = user.id;
    const isSuperAdmin = user.user_metadata?.role === "super_admin";

    const [{ data: roleRows }, { data: diwaneAdminRows }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("diwane_admins").select("diwane_id").eq("user_id", userId),
    ]);

    const diwaneIds = [...new Set((diwaneAdminRows ?? []).map((r) => r.diwane_id))];
    const hasAdminRole = (roleRows ?? []).some((r) => r.role === "admin");

    if (isSuperAdmin) {
      setAccess("super_admin");
      setManagedDiwaneIds([]);
      setRole("admin");
      return;
    }
    if (diwaneIds.length > 0) {
      setAccess("diwane_admin");
      setManagedDiwaneIds(diwaneIds);
      setRole("admin");
      return;
    }
    if (hasAdminRole) {
      setAccess("platform_admin");
      setManagedDiwaneIds([]);
      setRole("admin");
      return;
    }
    setAccess("member");
    setManagedDiwaneIds([]);
    setRole("member");
  }

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s?.user) {
        setRole(null);
        setAccess("member");
        setManagedDiwaneIds([]);
      } else {
        setTimeout(() => void fetchAccess(s.user), 0);
      }
    });

    void supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        await fetchAccess(data.session.user);
      } else {
        setRole(null);
        setAccess("member");
        setManagedDiwaneIds([]);
      }
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, role, access, managedDiwaneIds, loading };
}

export function normalizePhone(p: string) {
  return p.replace(/[\s-]/g, "");
}
export function phoneToEmail(p: string) {
  return `${normalizePhone(p).replace(/\+/g, "00")}@dahira.local`;
}
