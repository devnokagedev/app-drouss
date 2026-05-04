import { createClient } from "jsr:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const Body = z.object({
  full_name: z.string().trim().min(1).max(100),
  identifiant: z.string().trim().min(2).max(50),
  pin: z.string().regex(/^\d{4,6}$/, "PIN: 4 à 6 chiffres"),
  diwane_id: z.string().uuid().optional().nullable(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Non authentifié" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Vérifier l'utilisateur appelant
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Session invalide" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = userData.user.id;
    const isSuper = userData.user.user_metadata?.role === "super_admin";
    const { data: roleRows } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId);
    const isAdmin = (roleRows ?? []).some((r) => r.role === "admin");

    if (!isSuper && !isAdmin) {
      return new Response(JSON.stringify({ error: "Accès refusé" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.issues[0]?.message ?? "Données invalides" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const { full_name, identifiant, pin, diwane_id } = parsed.data;

    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("identifiant", identifiant)
      .maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ error: "Identifiant déjà utilisé" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = `${identifiant.replace(/\+/g, "00")}@dahira.local`;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: pin,
      email_confirm: true,
      user_metadata: { identifiant, full_name },
    });
    if (createErr || !created.user) {
      return new Response(
        JSON.stringify({ error: createErr?.message ?? "Création impossible" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const newId = created.user.id;

    let diwaneName: string | null = null;
    if (diwane_id) {
      const { data: d } = await admin
        .from("diwanes")
        .select("id,name")
        .eq("id", diwane_id)
        .maybeSingle();
      if (!d) {
        await admin.auth.admin.deleteUser(newId);
        return new Response(JSON.stringify({ error: "Section introuvable" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      diwaneName = d.name;
    }

    const { error: profErr } = await admin.from("profiles").insert({
      id: newId,
      identifiant,
      full_name,
      phone: identifiant,
      diwane: diwaneName,
      diwane_id: diwane_id ?? null,
    });
    if (profErr) {
      await admin.auth.admin.deleteUser(newId);
      return new Response(JSON.stringify({ error: profErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await admin.from("user_roles").insert({ user_id: newId, role: "admin" });

    return new Response(JSON.stringify({ ok: true, id: newId }), {
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
