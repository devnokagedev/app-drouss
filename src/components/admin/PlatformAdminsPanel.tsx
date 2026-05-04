import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Plus, Search, Edit3 } from "lucide-react";

type PlatformAdmin = {
  id: string;
  full_name: string;
  identifiant: string;
  phone: string;
  diwane_id?: string;
  diwane_name?: string;
  created_at: string;
};

export function PlatformAdminsPanel() {
  const [admins, setAdmins] = useState<PlatformAdmin[]>([]);
  const [diwanes, setDiwanes] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    full_name: "",
    identifiant: "",
    pin: "",
    diwane_id: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: diwaneData } = await supabase.from("diwanes").select("id, name").order("name");

      // Fetch platform admins (user_roles 'admin' AND NOT diwane_admin)
      const { data: profileData } = await supabase
        .from("profiles")
        .select(`
          id,
          full_name,
          identifiant,
          phone,
          diwane_id,
          diwanes(name),
          created_at
        `)
        .or('diwane_id.is.null');

      // Platform admins (user_roles 'admin' - exclude diwane admins)
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq('role', 'admin');

      const platformAdminIds = roleData?.map(r => r.user_id) || [];
      const adminList: PlatformAdmin[] = (profileData || [])
        .filter(p => platformAdminIds.includes(p.id) && !p.diwane_id)
        .map((row: any) => ({
          id: row.id,
          full_name: row.full_name,
          identifiant: row.identifiant,
          phone: row.phone || "",
          diwane_id: row.diwane_id,
          diwane_name: row.diwanes?.name || "",
          created_at: row.created_at,
        }));

      setAdmins(adminList);
      setDiwanes(diwaneData || []);
      setDiwanes(diwaneData || []);
    } catch (error) {
      toast.error("Erreur chargement admins plateforme");
    } finally {
      setLoading(false);
    }
  };

  const filteredAdmins = admins.filter(
    (admin) =>
      admin.full_name.toLowerCase().includes(search.toLowerCase()) ||
      admin.identifiant.toLowerCase().includes(search.toLowerCase()) ||
      admin.phone.toLowerCase().includes(search.toLowerCase()),
  );

  const openCreate = () => {
    setFormData({ full_name: "", identifiant: "", pin: "", diwane_id: "" });
    setEditId(null);
    setDialogOpen(true);
  };

  const openEdit = (admin: PlatformAdmin) => {
    setFormData({
      full_name: admin.full_name,
      identifiant: admin.identifiant,
      pin: "",
      diwane_id: admin.diwane_id || "",
    });
    setEditId(admin.id);
    setDialogOpen(true);
  };

  const saveAdmin = async () => {
    const { full_name, identifiant, pin, diwane_id } = formData;

    if (!full_name || !identifiant) {
      toast.error("Nom complet et identifiant requis");
      return;
    }

    try {
      if (editId) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ full_name, identifiant, diwane_id: diwane_id || null })
          .eq("id", editId);
        if (profileError) throw profileError;
      } else {
        if (!/^\d{4,6}$/.test(pin)) {
          toast.error("PIN: 4 à 6 chiffres");
          return;
        }
        const { data, error } = await supabase.functions.invoke(
          "admin-create-platform-admin",
          {
            body: {
              full_name,
              identifiant,
              pin,
              diwane_id: diwane_id || null,
            },
          },
        );
        if (error || (data as any)?.error) {
          throw new Error((data as any)?.error ?? error?.message ?? "Erreur");
        }
      }

      toast.success(editId ? "Admin mis à jour" : "Admin créé");
      setDialogOpen(false);
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur sauvegarde");
    }
  };

  const deleteAdmin = async (id: string) => {
    if (!confirm("Supprimer cet admin plateforme ?")) return;

    try {
      // Delete user_roles
      await supabase.from("user_roles").delete().eq("user_id", id);

      // Delete profile (cascade)
      await supabase.from("profiles").delete().eq("id", id);

      toast.success("Admin supprimé");
      loadData();
    } catch (error) {
      toast.error("Erreur suppression");
    }
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex gap-3 items-center justify-between">
        <h1 className="text-2xl font-bold">Admins Plateforme</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Ajouter admin
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editId ? "Modifier" : "Créer"} Admin Plateforme</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nom complet</Label>
                <Input
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Identifiant</Label>
                <Input
                  value={formData.identifiant}
                  onChange={(e) => setFormData({ ...formData, identifiant: e.target.value })}
                />
              </div>
              <div>
                <Label>PIN</Label>
                <Input
                  type="password"
                  value={formData.pin}
                  onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                  placeholder="12345"
                />
              </div>
              <div>
                <Label>Diwane (optionnel)</Label>
                <Select value={formData.diwane_id} onValueChange={(v) => setFormData({ ...formData, diwane_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Aucun" />
                  </SelectTrigger>
                  <SelectContent>
  <SelectItem value="null">Aucun</SelectItem>
                    {diwanes.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={saveAdmin}>
                {editId ? "Sauvegarder" : "Créer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Rechercher admin..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Identifiant</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead>Diwane</TableHead>
              <TableHead>Créé le</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24">
                  Chargement...
                </TableCell>
              </TableRow>
            ) : filteredAdmins.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground h-24">
                  Aucun admin plateforme
                </TableCell>
              </TableRow>
            ) : (
              filteredAdmins.map((admin) => (
                <TableRow key={admin.id}>
                  <TableCell className="font-medium">{admin.full_name}</TableCell>
                  <TableCell>{admin.identifiant}</TableCell>
                  <TableCell>{admin.phone || "-"}</TableCell>
                  <TableCell>{admin.diwane_name || "Aucun"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(admin.created_at).toLocaleDateString("fr-FR")}
                  </TableCell>
                  <TableCell className="space-x-1">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => openEdit(admin)}>
                          <Edit3 className="w-4 h-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        {/* Edit form same as create */}
                        <DialogHeader>
                          <DialogTitle>Modifier {admin.full_name}</DialogTitle>
                        </DialogHeader>
                        {/* Reuse form logic */}
                      </DialogContent>
                    </Dialog>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteAdmin(admin.id)}
                    >
                      <Trash2 className="w-4 h-4" />
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
}

