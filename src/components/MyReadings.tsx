import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Reading = {
  id: string;
  count: number;
  read_at: string;
  khassidas: { name: string } | null;
};

export default function MyReadings({ refreshKey }: { refreshKey: number }) {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("readings")
      .select("id, count, read_at, khassidas(name)")
      .order("read_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100);
    setReadings((data as unknown as Reading[]) ?? []);
    setLoading(false);
  }

  async function remove(id: string) {
    const { error } = await supabase.from("readings").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setReadings((r) => r.filter((x) => x.id !== id));
    toast.success("Lecture supprimée");
  }

  const total = readings.reduce((s, r) => s + r.count, 0);

  return (
    <section className="space-y-4">
      <div className="bg-card rounded-2xl shadow-card p-5 flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-primary-soft text-primary flex items-center justify-center">
          <BookOpen className="h-6 w-6" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total</p>
          <p className="font-display text-3xl font-semibold leading-none mt-1">
            {total}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">lectures cumulées</p>
        </div>
      </div>

      <div className="bg-card rounded-2xl shadow-card overflow-hidden">
        <h2 className="font-display text-xl font-semibold px-5 pt-5 pb-2">
          Mes lectures
        </h2>
        {loading ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">Chargement...</p>
        ) : readings.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted-foreground text-center">
            Aucune lecture enregistrée pour le moment.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {readings.map((r) => (
              <li key={r.id} className="px-5 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {r.khassidas?.name ?? "Khassida"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.read_at).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <span className="bg-primary-soft text-primary font-semibold px-3 py-1 rounded-lg text-sm">
                  ×{r.count}
                </span>
                <button
                  onClick={() => remove(r.id)}
                  className="text-muted-foreground hover:text-destructive p-1.5"
                  aria-label="Supprimer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
