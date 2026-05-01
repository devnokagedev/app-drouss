import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const Body = z.object({
  phone: z.string().trim().min(6).max(20),
  pin: z.string().regex(/^\d{4,6}$/, "PIN invalide"),
});

function normalizePhone(p: string): string {
  return p.replace(/[\s-]/g, "");
}

// Renvoie l'email synthétique correspondant au numéro
// Le frontend l'utilise ensuite pour signInWithPassword
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Numéro ou PIN invalide" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const phone = normalizePhone(parsed.data.phone);
    const email = `${phone.replace(/\+/g, "00")}@dahira.local`;
    return new Response(JSON.stringify({ email }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
