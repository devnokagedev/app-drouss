import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

type Khassida = { id: string; name: string };
type Member = { id: string; full_name: string; identifiant: string };
type Reading = {
  id: string;
  count: number;
  read_at: string;
  user_id: string;
  khassidas: { name: string } | null;
};

export default function AdminPanel() {
  const [khassidas, setKhassidas] = useState<Khassida[]>([]);
  const [selectedKhassida, setSelectedKhassida] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    const [k, m, r] = await Promise.all([
      supabase.from("khassidas").select("id,name").order("name"),
      supabase.from("profiles").select("id,full_name,identifiant").order("full_name"),
      supabase
        .from("readings")
        .select("id,count,read_at,user_id,khassidas(name)")
        .order("read_at", { ascending: false })
        .limit(200),
    ]);
    setKhassidas(k.data ?? []);
    setMembers(m.data ?? []);
    setReadings((r.data as unknown as Reading[]) ?? []);
  }

  async function assign(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedKhassida) {
      toast.error("Choisissez un khassida");
      return;
    }
    setAssigning(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("assigned_khassidas").insert({
      khassida_id: selectedKhassida,
      assigned_by: user?.id,
      due_date: dueDate || null,
      notes: notes || null,
    });
    setAssigning(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Khassida assigné");
    setSelectedKhassida("");
    setDueDate("");
    setNotes("");
  }

  // Agrégation par membre
  const totals = members.map((m) => {
    const memberReadings = readings.filter((r) => r.user_id === m.id);
    const total = memberReadings.reduce((s, r) => s + r.count, 0);
    return { ...m, total, count: memberReadings.length };
  });

  return (
    <div className="space-y-5">
      {/* Assigner */}
      <section className="bg-card rounded-2xl shadow-card p-5">
        <h2 className="font-display text-xl font-semibold mb-4">
          Assigner un khassida à lire
        </h2>
        <form onSubmit={assign} className="space-y-3">
          <div>
            <Label htmlFor="kh">Khassida</Label>
            <select
              id="kh"
              value={selectedKhassida}
              onChange={(e) => setSelectedKhassida(e.target.value)}
              className="mt-1.5 w-full h-12 rounded-md border border-input bg-background px-3 text-base"
              required
            >
              <option value="">— Sélectionner —</option>
              {khassidas.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="due">Date limite (optionnel)</Label>
            <Input
              id="due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-12"
            />
          </div>
          <div>
            <Label htmlFor="notes">Note (optionnel)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex : à lire pour le gamou de vendredi"
              rows={2}
            />
          </div>
          <Button type="submit" disabled={assigning} className="w-full h-12 gap-2">
            <Plus className="h-4 w-4" /> Assigner
          </Button>
        </form>
      </section>

      {/* Stats par membre */}
      <section className="bg-card rounded-2xl shadow-card overflow-hidden">
        <h2 className="font-display text-xl font-semibold px-5 pt-5 pb-2">
          Lectures par membre
        </h2>
        {totals.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">Aucun membre.</p>
        ) : (
          <ul className="divide-y divide-border">
            {totals.map((m) => (
              <li key={m.id} className="px-5 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{m.full_name}</p>
                  <p className="text-xs text-muted-foreground">{m.identifiant}</p>
                </div>
                <div className="text-right">
                  <p className="font-display text-2xl font-semibold leading-none text-primary">
                    {m.total}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {m.count} entrée{m.count > 1 ? "s" : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Toutes les lectures */}
      <section className="bg-card rounded-2xl shadow-card overflow-hidden">
        <h2 className="font-display text-xl font-semibold px-5 pt-5 pb-2">
          Toutes les lectures ({readings.length})
        </h2>
        {readings.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            Aucune lecture pour le moment.
          </p>
        ) : (
          <ul className="divide-y divide-border max-h-[480px] overflow-y-auto">
            {readings.map((r) => {
              const member = members.find((m) => m.id === r.user_id);
              return (
                <li key={r.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-sm">
                      {r.khassidas?.name ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {member?.full_name ?? "Membre"} ·{" "}
                      {new Date(r.read_at).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <span className="bg-primary-soft text-primary font-semibold px-3 py-1 rounded-lg text-sm">
                    ×{r.count}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
