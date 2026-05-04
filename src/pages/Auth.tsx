import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { phoneToEmail, normalizePhone } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { BookOpen } from "lucide-react";

const SignupSchema = z.object({
    full_name: z.string().trim().min(2, "Nom trop court").max(100),
    phone: z.string().trim().regex(/^[0-9+\s-]{6,20}$/, "Numéro invalide"),
    pin: z.string().regex(/^\d{4,6}$/, "PIN: 4 à 6 chiffres"),
    diwane_id: z.string().uuid("Sélectionnez votre section"),
  });

export default function Auth() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [fullName, setFullName] = useState("");
  const [diwaneId, setDiwaneId] = useState("");
  const [diwanes, setDiwanes] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void supabase
      .from("diwanes")
      .select("id,name")
      .order("name")
      .then(({ data }) => setDiwanes(data ?? []));
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const email = phoneToEmail(phone);
      const { error } = await supabase.auth.signInWithPassword({ email, password: pin });
      if (error) throw new Error("Numéro ou code PIN incorrect");
      toast.success("Bienvenue !");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    const parsed = SignupSchema.safeParse({ full_name: fullName, phone, pin, diwane_id: diwaneId });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("auth-signup", {
        body: { full_name: fullName, phone: normalizePhone(phone), pin, diwane_id: diwaneId },
      });
      if (error || (data as any)?.error) {
        throw new Error((data as any)?.error ?? error?.message ?? "Erreur");
      }
      // Auto-login
      const { error: loginErr } = await supabase.auth.signInWithPassword({
        email: phoneToEmail(phone),
        password: pin,
      });
      if (loginErr) throw loginErr;
      toast.success("Compte créé !");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Inscription impossible");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-soft flex flex-col items-center justify-center px-5 py-10 safe-bottom">
      <div className="w-full max-w-md">
        <header className="text-center mb-8">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-primary shadow-elevated mb-4">
            <BookOpen className="h-8 w-8 text-primary-foreground" strokeWidth={1.5} />
          </div>
          <h1 className="font-display text-4xl font-semibold text-foreground">Dahira</h1>
          <p className="text-muted-foreground mt-2 text-sm max-w-sm mx-auto">
            Recensez les khassidas lus par section ; les admins consultent les totaux et exportent un rapport.
          </p>
        </header>

        <div className="bg-card rounded-2xl shadow-card p-6">
          <div className="flex gap-2 mb-6 p-1 bg-muted rounded-xl">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                mode === "login" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              Connexion
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                mode === "signup" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              Créer un compte
            </button>
          </div>

          <form onSubmit={mode === "login" ? handleLogin : handleSignup} className="space-y-4">
              {mode === "signup" && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Nom complet</Label>
                    <Input
                      id="name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Ex : Moussa Diop"
                      className="h-12 text-base"
                      autoComplete="name"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="diwane">Section (diwane)</Label>
                    <select
                      id="diwane"
                      value={diwaneId}
                      onChange={(e) => setDiwaneId(e.target.value)}
                      className="mt-1.5 w-full h-12 rounded-md border border-input bg-background px-3 text-base min-h-[48px]"
                      required
                      disabled={diwanes.length === 0}
                    >
                      <option value="">
                        {diwanes.length === 0 ? "Aucune section — contactez un super admin" : "— Choisir votre section —"}
                      </option>
                      {diwanes.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

            <div className="space-y-1.5">
              <Label htmlFor="phone">Numéro de téléphone</Label>
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ex : 771234567"
                className="h-12 text-base"
                autoComplete="tel"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pin">Code PIN</Label>
              <Input
                id="pin"
                type="password"
                inputMode="numeric"
                pattern="\d{4,6}"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                placeholder="4 à 6 chiffres"
                className="h-12 text-base tracking-widest"
                required
              />
              {mode === "signup" && (
                <p className="text-xs text-muted-foreground mt-1">
                  Choisissez un code que vous mémoriserez facilement.
                </p>
              )}
            </div>

            <Button type="submit" disabled={loading} className="w-full h-12 text-base mt-2">
              {loading ? "Patientez..." : mode === "login" ? "Se connecter" : "Créer mon compte"}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6 px-4">
          Pas besoin d'adresse e-mail. Votre numéro et votre PIN suffisent.
        </p>
      </div>
    </main>
  );
}
