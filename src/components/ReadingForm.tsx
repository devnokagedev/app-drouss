import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Search, Check } from "lucide-react";
import { toast } from "sonner";

type Khassida = { id: string; name: string };

interface Props {
  onLogged: () => void;
}

export default function ReadingForm({ onLogged }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Khassida[]>([]);
  const [selected, setSelected] = useState<Khassida | null>(null);
  const [count, setCount] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => search(query), 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function search(q: string) {
    let req = supabase.from("khassidas").select("id,name").order("name").limit(15);
    if (q.trim()) req = req.ilike("name", `%${q.trim()}%`);
    const { data } = await req;
    setResults(data ?? []);
  }

  async function createKhassida() {
    const name = query.trim();
    if (name.length < 2) {
      toast.error("Nom trop court");
      return;
    }
    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("khassidas")
      .insert({ name, created_by: user?.id })
      .select("id,name")
      .single();
    setCreating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data) {
      setSelected(data);
      setResults([data, ...results]);
      toast.success("Khassida ajouté");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) {
      toast.error("Sélectionnez un khassida");
      return;
    }
    const n = parseInt(count, 10);
    if (!n || n < 1) {
      toast.error("Nombre invalide");
      return;
    }
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSubmitting(false);
      return;
    }
    const { error } = await supabase.from("readings").insert({
      user_id: user.id,
      khassida_id: selected.id,
      count: n,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Lecture enregistrée");
    setSelected(null);
    setQuery("");
    setCount("1");
    onLogged();
  }

  const exactMatch = results.some(
    (r) => r.name.toLowerCase() === query.trim().toLowerCase(),
  );

  return (
    <form onSubmit={submit} className="bg-card rounded-2xl shadow-card p-5 space-y-5">
      <div className="space-y-2">
        <Label>Khassida</Label>
        {selected ? (
          <div className="flex items-center justify-between bg-primary-soft rounded-xl px-4 py-3">
            <span className="font-medium text-foreground">{selected.name}</span>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-xs text-muted-foreground underline"
            >
              changer
            </button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un khassida..."
                className="h-12 pl-10 text-base"
              />
            </div>

            <div className="max-h-56 overflow-y-auto rounded-xl border border-border divide-y divide-border">
              {results.length === 0 && (
                <div className="px-4 py-3 text-sm text-muted-foreground">
                  Aucun résultat
                </div>
              )}
              {results.map((k) => (
                <button
                  type="button"
                  key={k.id}
                  onClick={() => setSelected(k)}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-muted active:bg-muted transition-colors flex items-center justify-between"
                >
                  <span>{k.name}</span>
                  <Check className="h-4 w-4 text-muted-foreground opacity-0" />
                </button>
              ))}
            </div>

            {query.trim().length >= 2 && !exactMatch && (
              <Button
                type="button"
                variant="outline"
                onClick={createKhassida}
                disabled={creating}
                className="w-full h-11 gap-2"
              >
                <Plus className="h-4 w-4" />
                Ajouter "{query.trim()}"
              </Button>
            )}
          </>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="count">Nombre de lectures</Label>
        <Input
          id="count"
          type="number"
          inputMode="numeric"
          min={1}
          value={count}
          onChange={(e) => setCount(e.target.value)}
          className="h-12 text-base"
        />
      </div>

      <Button type="submit" disabled={submitting || !selected} className="w-full h-12 text-base">
        {submitting ? "Enregistrement..." : "Enregistrer"}
      </Button>
    </form>
  );
}
