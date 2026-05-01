import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles } from "lucide-react";

type Assigned = {
  id: string;
  due_date: string | null;
  notes: string | null;
  khassidas: { name: string } | null;
};

export default function AssignedList() {
  const [items, setItems] = useState<Assigned[]>([]);

  useEffect(() => {
    supabase
      .from("assigned_khassidas")
      .select("id, due_date, notes, khassidas(name)")
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => setItems((data as unknown as Assigned[]) ?? []));
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="bg-accent-soft rounded-2xl p-5 border border-accent/20">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-accent" />
        <h2 className="font-display text-lg font-semibold">À lire</h2>
      </div>
      <ul className="space-y-2">
        {items.map((a) => (
          <li
            key={a.id}
            className="bg-card rounded-xl px-4 py-3 shadow-card"
          >
            <p className="font-medium">{a.khassidas?.name ?? "—"}</p>
            {a.notes && (
              <p className="text-xs text-muted-foreground mt-1">{a.notes}</p>
            )}
            {a.due_date && (
              <p className="text-xs text-accent mt-1">
                Avant le{" "}
                {new Date(a.due_date).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                })}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
