import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, BookOpen, ListChecks, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import ReadingForm from "@/components/ReadingForm";
import MyReadings from "@/components/MyReadings";
import AssignedList from "@/components/AssignedList";
import AdminPanel from "@/components/AdminPanel";

export default function Home() {
  const { session, role } = useAuth();
  const [tab, setTab] = useState<"log" | "mine" | "admin">("log");
  const [profile, setProfile] = useState<{ full_name: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data));
  }, [session]);

  async function logout() {
    await supabase.auth.signOut();
  }

  return (
    <div className="min-h-screen bg-gradient-soft pb-24 safe-bottom">
      {/* Header */}
      <header className="bg-gradient-primary text-primary-foreground px-5 pt-8 pb-10 rounded-b-3xl shadow-elevated">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest opacity-80">Dahira</p>
            <h1 className="font-display text-3xl font-semibold mt-1">
              Assalamou aleykoum
            </h1>
            {profile && (
              <p className="text-sm opacity-90 mt-1">{profile.full_name}</p>
            )}
            {role === "admin" && (
              <span className="inline-flex items-center gap-1 mt-3 text-xs bg-accent/90 text-accent-foreground px-2.5 py-1 rounded-full font-medium">
                <ShieldCheck className="h-3 w-3" /> Administrateur
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            className="text-primary-foreground hover:bg-white/10 hover:text-primary-foreground"
            aria-label="Se déconnecter"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="px-5 -mt-6 space-y-5 max-w-2xl mx-auto">
        {tab === "log" && (
          <>
            <AssignedList />
            <section>
              <h2 className="font-display text-2xl font-semibold mb-3 px-1">
                Enregistrer une lecture
              </h2>
              <ReadingForm onLogged={() => setRefreshKey((k) => k + 1)} />
            </section>
          </>
        )}

        {tab === "mine" && <MyReadings refreshKey={refreshKey} />}

        {tab === "admin" && role === "admin" && <AdminPanel />}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 bg-card border-t border-border safe-bottom z-50">
        <div className="max-w-2xl mx-auto grid grid-cols-3">
          <NavBtn
            active={tab === "log"}
            onClick={() => setTab("log")}
            icon={<BookOpen className="h-5 w-5" />}
            label="Lire"
          />
          <NavBtn
            active={tab === "mine"}
            onClick={() => setTab("mine")}
            icon={<ListChecks className="h-5 w-5" />}
            label="Mes lectures"
          />
          {role === "admin" ? (
            <NavBtn
              active={tab === "admin"}
              onClick={() => setTab("admin")}
              icon={<ShieldCheck className="h-5 w-5" />}
              label="Admin"
            />
          ) : (
            <div />
          )}
        </div>
      </nav>
    </div>
  );
}

function NavBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 py-3 transition-colors ${
        active ? "text-primary" : "text-muted-foreground"
      }`}
    >
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}
