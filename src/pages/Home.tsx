import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import MyReadings from "@/components/MyReadings";
import AdminPanel from "@/components/AdminPanel";
import { HomeHeader } from "@/components/home/HomeHeader";
import { BottomNav } from "@/components/home/BottomNav";
import { MemberReadingTab } from "@/components/home/MemberReadingTab";
import { cn } from "@/lib/utils";

export default function Home() {
  const { session, access } = useAuth();
  const [tab, setTab] = useState<"log" | "mine" | "admin">("log");
  const [profile, setProfile] = useState<{
    full_name: string;
    diwane: string | null;
    diwane_id: string | null;
  } | null>(null);
  const [sectionLabel, setSectionLabel] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!session) return;
    void (async () => {
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name, diwane, diwane_id")
        .eq("id", session.user.id)
        .maybeSingle();
      setProfile(p);

      if (p?.diwane_id) {
        const { data: d } = await supabase.from("diwanes").select("name").eq("id", p.diwane_id).maybeSingle();
        setSectionLabel(d?.name ?? p.diwane ?? null);
      } else {
        setSectionLabel(p?.diwane ?? null);
      }
    })();
  }, [session]);

  async function logout() {
    await supabase.auth.signOut();
  }

  const mainWidthClass =
    tab === "admin" && access === "super_admin"
      ? "max-w-7xl"
      : "max-w-2xl md:max-w-3xl lg:max-w-4xl";

  return (
    <div className="min-h-screen bg-gradient-soft pb-[calc(4.5rem+env(safe-area-inset-bottom))] safe-bottom">
      <HomeHeader
        fullName={profile?.full_name ?? null}
        sectionLabel={sectionLabel}
        access={access}
        onLogout={logout}
      />

      <main
        className={cn(
          "px-4 sm:px-6 -mt-6 space-y-5 mx-auto w-full",
          mainWidthClass,
        )}
      >
        {tab === "log" && <MemberReadingTab onLogged={() => setRefreshKey((k) => k + 1)} />}

        {tab === "mine" && (
          <>
            <p className="text-sm text-muted-foreground px-1">
              Historique de vos lectures enregistrées pour votre section.
            </p>
            <MyReadings refreshKey={refreshKey} />
          </>
        )}

        {tab === "admin" && access !== "member" && <AdminPanel />}
      </main>

      <BottomNav tab={tab} onTabChange={setTab} access={access} />
    </div>
  );
}
