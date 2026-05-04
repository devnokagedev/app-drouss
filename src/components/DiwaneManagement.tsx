import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Diwane = { id: string; name: string };
type Member = { id: string; full_name: string; identifiant: string };
type DiwaneAdminLink = { diwane_id: string; user_id: string };

export const DiwaneManagement = () => {
  const [diwanes, setDiwanes] = useState<Diwane[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [adminsByDiwane, setAdminsByDiwane] = useState<Record<string, string[]>>({});
  const [selectedAdminByDiwane, setSelectedAdminByDiwane] = useState<Record<string, string>>({});
  const [newDiwaneName, setNewDiwaneName] = useState("");
  const [newAdminId, setNewAdminId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ data: diwaneData, error: diwaneErr }, { data: memberData, error: memberErr }] = await Promise.all([
        supabase.from("diwanes").select("id,name").order("name"),
        supabase.from("profiles").select("id,full_name,identifiant").order("full_name"),
      ]);

      if (diwaneErr) throw diwaneErr;
      if (memberErr) throw memberErr;

      setDiwanes((diwaneData as Diwane[]) || []);
      setMembers((memberData as Member[]) || []);

      const { data: links, error: linksErr } = await supabase
        .from("diwane_admins")
        .select("diwane_id,user_id");
      if (linksErr) throw linksErr;

      const map: Record<string, string[]> = {};
      ((links as DiwaneAdminLink[]) || []).forEach((link) => {
        if (!map[link.diwane_id]) map[link.diwane_id] = [];
        map[link.diwane_id].push(link.user_id);
      });
      setAdminsByDiwane(map);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement des diwanes");
    } finally {
      setLoading(false);
    }
  };

  const createDiwane = async () => {
    if (!newDiwaneName.trim()) {
      toast.error("Renseignez le nom du diwane.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data: created, error: createErr } = await supabase
        .from("diwanes")
        .insert([{ name: newDiwaneName.trim() }])
        .select("id,name")
        .single();
      if (createErr || !created) throw createErr ?? new Error("Creation du diwane impossible");

      const { error: linkErr } = await supabase
        .from("diwane_admins")
        .insert([{ diwane_id: created.id, user_id: newAdminId }]);
      if (linkErr) throw linkErr;

      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ diwane_id: created.id } as never)
        .eq("id", newAdminId);
      if (profileErr) throw profileErr;

      setDiwanes((prev) => [...prev, created as Diwane].sort((a, b) => a.name.localeCompare(b.name)));
      setAdminsByDiwane((prev) => ({ ...prev, [created.id]: [newAdminId] }));
      setNewDiwaneName("");
      setNewAdminId("");
      toast.success("Diwane cree et admin attribue.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Creation du diwane impossible";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const updateDiwane = async (id: string, name: string) => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.from("diwanes").update({ name }).eq("id", id);
      if (error) throw error;
      setDiwanes((prev) => prev.map((d) => (d.id === id ? { ...d, name } : d)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mise a jour impossible");
    } finally {
      setLoading(false);
    }
  };

  const deleteDiwane = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.from("diwanes").delete().eq("id", id);
      if (error) throw error;
      setDiwanes((prev) => prev.filter((d) => d.id !== id));
      setAdminsByDiwane((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      toast.success("Diwane supprime.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Suppression impossible";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const addAdminToDiwane = async (diwaneId: string) => {
    const userId = selectedAdminByDiwane[diwaneId];
    if (!userId) {
      toast.error("Selectionnez un admin a ajouter.");
      return;
    }

    const currentAdmins = adminsByDiwane[diwaneId] || [];
    if (currentAdmins.includes(userId)) {
      toast.error("Ce membre est deja admin de ce diwane.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { error: linkErr } = await supabase
        .from("diwane_admins")
        .insert([{ diwane_id: diwaneId, user_id: userId }]);
      if (linkErr) throw linkErr;

      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ diwane_id: diwaneId } as never)
        .eq("id", userId);
      if (profileErr) throw profileErr;

      setAdminsByDiwane((prev) => ({
        ...prev,
        [diwaneId]: [...(prev[diwaneId] || []), userId],
      }));
      setSelectedAdminByDiwane((prev) => ({ ...prev, [diwaneId]: "" }));
      toast.success("Admin ajoute au diwane.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ajout admin impossible";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const removeAdminFromDiwane = async (diwaneId: string, userId: string) => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase
        .from("diwane_admins")
        .delete()
        .eq("diwane_id", diwaneId)
        .eq("user_id", userId);
      if (error) throw error;

      setAdminsByDiwane((prev) => ({
        ...prev,
        [diwaneId]: (prev[diwaneId] || []).filter((id) => id !== userId),
      }));
      toast.success("Admin retire du diwane.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Suppression admin impossible";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto w-full min-w-0">
      <h1 className="text-2xl font-bold mb-4">Gestion des diwanes</h1>
      {error && <div className="text-red-500 mb-2">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
        <Input
          placeholder="Nom du diwane"
          value={newDiwaneName}
          onChange={(e) => setNewDiwaneName(e.target.value)}
        />
        <select
          value={newAdminId}
          onChange={(e) => setNewAdminId(e.target.value)}
          className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">-- Choisir un admin --</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.full_name} ({m.identifiant})
            </option>
          ))}
        </select>
        <Button onClick={createDiwane} disabled={loading || !newDiwaneName.trim()} className="w-full">
            Ajouter diwane {newAdminId ? '(+ admin sélectionné)' : '(sans admin)'}
          </Button>
      </div>

      <div className="rounded-lg border shadow-sm overflow-x-auto -mx-0.5 sm:mx-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Admin(s) du diwane</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center">
                  Chargement...
                </TableCell>
              </TableRow>
            ) : diwanes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center">
                  Aucun diwane trouve
                </TableCell>
              </TableRow>
            ) : (
              diwanes.map((diwane) => (
                <TableRow key={diwane.id}>
                  <TableCell>
                    <Input
                      value={diwane.name}
                      onChange={(e) => updateDiwane(diwane.id, e.target.value)}
                      className="max-w-xs"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      {(adminsByDiwane[diwane.id] || []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">Non attribue</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {(adminsByDiwane[diwane.id] || []).map((adminId) => {
                            const admin = members.find((m) => m.id === adminId);
                            if (!admin) return null;
                            return (
                              <div
                                key={adminId}
                                className="inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs"
                              >
                                <span>{admin.full_name}</span>
                                <button
                                  type="button"
                                  onClick={() => removeAdminFromDiwane(diwane.id, adminId)}
                                  className="text-destructive"
                                  disabled={loading}
                                >
                                  Retirer
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <select
                          value={selectedAdminByDiwane[diwane.id] || ""}
                          onChange={(e) =>
                            setSelectedAdminByDiwane((prev) => ({
                              ...prev,
                              [diwane.id]: e.target.value,
                            }))
                          }
                          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="">Ajouter un admin...</option>
                          {members
                            .filter((m) => !(adminsByDiwane[diwane.id] || []).includes(m.id))
                            .map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.full_name} ({m.identifiant})
                              </option>
                            ))}
                        </select>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => addAdminToDiwane(diwane.id)}
                          disabled={loading || !selectedAdminByDiwane[diwane.id]}
                        >
                          Ajouter
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button variant="destructive" onClick={() => deleteDiwane(diwane.id)} disabled={loading}>
                      Supprimer
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
