import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Download } from "lucide-react";
import jsPDF from "jspdf";

type Khassida = { id: string; name: string };
type Member = { id: string; full_name: string; identifiant: string; diwane_id?: string | null };
type Reading = {
  id: string;
  count: number;
  read_at: string;
  user_id: string;
  khassidas: { name: string } | null;
};

type Props = {
  /** Sections gérées ; `null` = vue globale (admin plateforme hérité) */
  managedDiwaneIds: string[] | null;
};

export function DiwaneAdminDashboard({ managedDiwaneIds }: Props) {
  const [khassidas, setKhassidas] = useState<Khassida[]>([]);
  const [selectedKhassida, setSelectedKhassida] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [diwaneLabels, setDiwaneLabels] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadAll();
  }, [managedDiwaneIds?.join(",")]);

  async function loadAll() {
    setLoading(true);
    try {
      const { data: k } = await supabase.from("khassidas").select("id,name").order("name");
      setKhassidas(k ?? []);

      let memberQuery = supabase.from("profiles").select("id,full_name,identifiant,diwane_id").order("full_name");
      if (managedDiwaneIds?.length) {
        memberQuery = memberQuery.in("diwane_id", managedDiwaneIds);
      }
      const { data: m } = await memberQuery;
      const memberList = (m ?? []) as Member[];
      setMembers(memberList);

      const ids = memberList.map((x) => x.id);
      let readingsQuery = supabase
        .from("readings")
        .select("id,count,read_at,user_id,khassidas(name)")
        .order("read_at", { ascending: false })
        .limit(500);
      if (managedDiwaneIds?.length && ids.length > 0) {
        readingsQuery = readingsQuery.in("user_id", ids);
      } else if (managedDiwaneIds?.length && ids.length === 0) {
        setReadings([]);
        setDiwaneLabels("");
        setLoading(false);
        return;
      }
      const { data: r } = await readingsQuery;
      setReadings((r as unknown as Reading[]) ?? []);

      if (managedDiwaneIds?.length) {
        const { data: d } = await supabase.from("diwanes").select("name").in("id", managedDiwaneIds);
        setDiwaneLabels((d ?? []).map((x) => x.name).join(", "));
      } else {
        setDiwaneLabels("Toutes sections");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }

  async function assign(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedKhassida) {
      toast.error("Choisissez un khassida");
      return;
    }
    setAssigning(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
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

  const totals = members.map((m) => {
    const memberReadings = readings.filter((r) => r.user_id === m.id);
    const total = memberReadings.reduce((s, r) => s + r.count, 0);
    return { ...m, total, count: memberReadings.length };
  });

  const khassidaTotals = khassidas.map((k) => {
    const memberIds = new Set(members.map((m) => m.id));
    const khassidaReadings = readings.filter(
      (r) => memberIds.has(r.user_id) && r.khassidas?.name === k.name,
    );
    const total = khassidaReadings.reduce((s, r) => s + r.count, 0);
    return { ...k, total, count: khassidaReadings.length };
  });

  const generatePdfReport = () => {
    setGeneratingPdf(true);
    const doc = new jsPDF();
    const title =
      managedDiwaneIds?.length && diwaneLabels
        ? `Lectures — ${diwaneLabels}`
        : "Rapport des lectures (khassidas)";
    doc.setFontSize(16);
    doc.text(title, 10, 12);
    doc.setFontSize(11);
    doc.text("Résumé par khassida", 10, 22);
    let yPos = 30;
    khassidaTotals.forEach((kt, index) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(`${index + 1}. ${kt.name}: ${kt.total} lectures (${kt.count} entrées)`, 10, yPos);
      yPos += 8;
    });
    yPos += 6;
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    doc.text("Résumé par membre", 10, yPos);
    yPos += 8;
    totals.forEach((m, index) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(`${index + 1}. ${m.full_name} (${m.identifiant}): ${m.total} lectures (${m.count} entrées)`, 10, yPos);
      yPos += 8;
    });
    doc.save("rapport_lectures_khassida.pdf");
    setGeneratingPdf(false);
    toast.success("Rapport PDF généré");
  };

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">Chargement de l&apos;espace admin...</p>
    );
  }

  return (
    <div className="space-y-5">
      {managedDiwaneIds?.length ? (
        <p className="text-sm text-muted-foreground px-1">
          Section(s) : <span className="font-medium text-foreground">{diwaneLabels || "—"}</span>
        </p>
      ) : (
        <p className="text-sm text-muted-foreground px-1">
          Vue globale : toutes les sections (compte administrateur plateforme).
        </p>
      )}

      <section className="bg-card rounded-2xl shadow-card p-5">
        <h2 className="font-display text-xl font-semibold mb-4">Assigner un khassida à lire</h2>
        <form onSubmit={assign} className="space-y-3">
          <div>
            <Label htmlFor="kh">Khassida</Label>
            <select
              id="kh"
              value={selectedKhassida}
              onChange={(e) => setSelectedKhassida(e.target.value)}
              className="mt-1.5 w-full h-12 rounded-md border border-input bg-background px-3 text-base min-h-[44px]"
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
              className="h-12 min-h-[44px]"
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
          <Button type="submit" disabled={assigning} className="w-full h-12 gap-2 min-h-[44px]">
            <Plus className="h-4 w-4" /> Assigner
          </Button>
        </form>
      </section>

      <section className="bg-card rounded-2xl shadow-card overflow-hidden">
        <h2 className="font-display text-xl font-semibold px-5 pt-5 pb-2">Lectures par membre</h2>
        {totals.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            Aucun membre dans cette section pour le moment.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {totals.map((m) => (
              <li key={m.id} className="px-4 sm:px-5 py-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{m.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{m.identifiant}</p>
                </div>
                <div className="text-right ml-auto">
                  <p className="font-display text-2xl font-semibold leading-none text-primary">{m.total}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.count} entrée{m.count > 1 ? "s" : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-card rounded-2xl shadow-card overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 px-4 sm:px-5 pt-5 pb-2">
          <h2 className="font-display text-xl font-semibold">Lectures par khassida</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={generatePdfReport}
            disabled={generatingPdf}
            className="gap-1 shrink-0 min-h-[40px] w-full sm:w-auto"
          >
            <Download className="h-3.5 w-3.5" />
            {generatingPdf ? "Génération..." : "Rapport PDF"}
          </Button>
        </div>
        {khassidaTotals.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">Aucun khassida.</p>
        ) : (
          <ul className="divide-y divide-border">
            {khassidaTotals.map((k) => (
              <li key={k.id} className="px-4 sm:px-5 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{k.name}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-display text-2xl font-semibold leading-none text-primary">{k.total}</p>
                  <p className="text-xs text-muted-foreground">
                    {k.count} entrée{k.count > 1 ? "s" : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-card rounded-2xl shadow-card overflow-hidden">
        <h2 className="font-display text-xl font-semibold px-5 pt-5 pb-2">
          Détail des lectures ({readings.length})
        </h2>
        {readings.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">Aucune lecture pour le moment.</p>
        ) : (
          <ul className="divide-y divide-border max-h-[min(480px,50vh)] sm:max-h-[480px] overflow-y-auto overscroll-contain">
            {readings.map((r) => {
              const member = members.find((m) => m.id === r.user_id);
              return (
                <li key={r.id} className="px-4 sm:px-5 py-3 flex flex-wrap items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-sm">{r.khassidas?.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {member?.full_name ?? "Membre"} · {new Date(r.read_at).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <span className="bg-primary-soft text-primary font-semibold px-3 py-1 rounded-lg text-sm shrink-0">
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
