import { useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "member" | null;

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // listener AVANT getSession (anti race condition)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) {
        setRole(null);
      } else {
        // defer pour éviter deadlock
        setTimeout(() => fetchRole(s.user.id), 0);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) fetchRole(data.session.user.id);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function fetchRole(userId: string) {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (!data || data.length === 0) {
      setRole("member");
      return;
    }
    const isAdmin = data.some((r) => r.role === "admin");
    setRole(isAdmin ? "admin" : "member");
  }

  return { session, role, loading };
}

export function normalizePhone(p: string) {
  return p.replace(/[\s-]/g, "");
}
export function phoneToEmail(p: string) {
  return `${normalizePhone(p).replace(/\+/g, "00")}@dahira.local`;
}
