import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_IDENTIFIANT = "superadmin";
const DEFAULT_PIN = "123456";
const DEFAULT_NAME = "Super Admin";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    let body: { identifiant?: string; pin?: string; full_name?: string } = {};
    try {
      body = await req.json();
    } catch {
      // pas de body, on utilise les défauts
    }

    const identifiant = (body.identifiant ?? DEFAULT_IDENTIFIANT).trim();
    const pin = (body.pin ?? DEFAULT_PIN).trim();
    const full_name = (body.full_name ?? DEFAULT_NAME).trim();

    if (!/^\d{4,6}$/.test(pin)) {
      return new Response(
        JSON.stringify({ error: "PIN doit contenir 4 à 6 chiffres" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Vérifier si un super_admin existe déjà (via user_roles)
    const { data: existingRoles } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("role", "super_admin")
      .limit(1);

    if (existingRoles && existingRoles.length > 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          alreadyExists: true,
          message: "Un super admin existe déjà",
          user_id: existingRoles[0].user_id,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Vérifier si l'identifiant est libre
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("identifiant", identifiant)
      .maybeSingle();

    let userId: string;

    if (existingProfile) {
      // Promouvoir l'utilisateur existant
      userId = existingProfile.id;
      await admin.auth.admin.updateUserById(userId, {
        user_metadata: { identifiant, full_name, role: "super_admin" },
      });
    } else {
      const email = `${identifiant.replace(/\+/g, "00")}@dahira.local`;
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: pin,
        email_confirm: true,
        user_metadata: { identifiant, full_name, role: "super_admin" },
      });
      if (createErr || !created.user) {
        return new Response(
          JSON.stringify({ error: createErr?.message ?? "Création impossible" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      userId = created.user.id;

      const { error: profErr } = await admin.from("profiles").insert({
        id: userId,
        identifiant,
        full_name,
        phone: identifiant,
      });
      if (profErr) {
        await admin.auth.admin.deleteUser(userId);
        return new Response(JSON.stringify({ error: profErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Insérer les rôles super_admin + admin (idempotent)
    await admin
      .from("user_roles")
      .upsert(
        [
          { user_id: userId, role: "super_admin" },
          { user_id: userId, role: "admin" },
        ],
        { onConflict: "user_id,role", ignoreDuplicates: true },
      );

    return new Response(
      JSON.stringify({
        ok: true,
        user_id: userId,
        identifiant,
        pin,
        message:
          "Super admin créé. Connecte-toi avec cet identifiant et ce PIN, puis change le PIN.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur inconnue";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
