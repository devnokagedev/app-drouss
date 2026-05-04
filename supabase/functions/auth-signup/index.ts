import { createClient } from "jsr:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const Body = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\s-]{6,20}$/, "Numéro invalide"),
  pin: z.string().regex(/^\d{4,6}$/, "Le code PIN doit contenir 4 à 6 chiffres"),
  full_name: z.string().trim().min(1).max(100),
  diwane_id: z.string().uuid("Sélectionnez une section valide"),
});

function normalizePhone(p: string): string {
  return p.replace(/[\s-]/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const json = await req.json();
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.issues[0]?.message ?? "Données invalides" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const phone = normalizePhone(parsed.data.phone);
    const { pin, full_name } = parsed.data;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // identifiant = numéro de téléphone normalisé
    // email synthétique invisible pour l'utilisateur
    const email = `${phone.replace(/\+/g, "00")}@dahira.local`;

    // vérifie que l'identifiant n'existe pas déjà
    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("identifiant", phone)
      .maybeSingle();
    if (existing) {
      return new Response(
        JSON.stringify({ error: "Ce numéro est déjà utilisé" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: pin,
      email_confirm: true,
      user_metadata: { identifiant: phone, full_name },
    });
    if (createErr || !created.user) {
      return new Response(
        JSON.stringify({ error: createErr?.message ?? "Création impossible" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userId = created.user.id;

    const { data: diwaneRow, error: diwaneErr } = await admin
      .from("diwanes")
      .select("id,name")
      .eq("id", parsed.data.diwane_id)
      .maybeSingle();
    if (diwaneErr || !diwaneRow) {
      await admin.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: "Section (diwane) introuvable" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error: profErr } = await admin.from("profiles").insert({
      id: userId,
      identifiant: phone,
      full_name,
      phone,
      diwane: diwaneRow.name,
      diwane_id: diwaneRow.id,
    });
    if (profErr) {
      await admin.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: profErr.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Premier admin : si l'identifiant est exactement "admin" OU
    // (règle alternative) si c'est le tout premier compte créé
    const isAdminIdentifiant = phone === "admin";
    const { count } = await admin
      .from("profiles")
      .select("*", { count: "exact", head: true });
    const isFirstUser = (count ?? 0) === 1;

    const role = isAdminIdentifiant || isFirstUser ? "admin" : "member";
    await admin.from("user_roles").insert({ user_id: userId, role });

    return new Response(JSON.stringify({ ok: true, role }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur inconnue";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
