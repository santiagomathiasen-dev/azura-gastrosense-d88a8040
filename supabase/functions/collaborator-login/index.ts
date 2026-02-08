import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type RequestBody = {
  gestorEmail: string;
  pin: string;
};

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + "azura_salt_2024");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function badRequest(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function generatePassword(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
  let password = "";
  for (let i = 0; i < 24; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!url || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Backend não configurado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json().catch(() => null)) as RequestBody | null;
    if (!body) return badRequest("Corpo inválido");

    const gestorEmail = String(body.gestorEmail ?? "").trim().toLowerCase();
    const pin = String(body.pin ?? "").trim();

    if (!gestorEmail) return badRequest("Email do gestor é obrigatório");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(gestorEmail)) return badRequest("Email inválido");
    if (!/^\d{6}$/.test(pin)) return badRequest("PIN deve ter 6 dígitos");

    const admin = createClient(url, serviceRoleKey);

    // 1) Find gestor by email using admin API
    const { data: usersData, error: usersError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });

    if (usersError) {
      return new Response(JSON.stringify({ error: "Erro ao validar email" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const gestorUser = (usersData?.users || []).find(
      (u) => (u.email || "").trim().toLowerCase() === gestorEmail,
    );

    if (!gestorUser?.id) {
      return new Response(JSON.stringify({ error: "Email ou PIN incorretos" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hashedPin = await hashPin(pin);

    // 2) Find collaborator by gestor_id + pin_hash
    const { data: collaborator, error: collabError } = await admin
      .from("collaborators")
      .select("*")
      .eq("gestor_id", gestorUser.id)
      .eq("pin_hash", hashedPin)
      .eq("is_active", true)
      .maybeSingle();

    if (collabError || !collaborator) {
      return new Response(JSON.stringify({ error: "Email ou PIN incorretos" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3) If collaborator has an auth_user_id, sign them in
    if (collaborator.auth_user_id) {
      // Get the collaborator's auth user
      const { data: collabUserData } = await admin.auth.admin.getUserById(collaborator.auth_user_id);
      
      if (collabUserData?.user?.email) {
        // Generate a new password and update it using updateUserById
        const newPassword = generatePassword();
        
        const { error: updateError } = await admin.auth.admin.updateUserById(
          collaborator.auth_user_id,
          { password: newPassword }
        );

        if (!updateError) {
          // Sign in the collaborator
          const { data: signInData, error: signInError } = await admin.auth.signInWithPassword({
            email: collabUserData.user.email,
            password: newPassword,
          });

          if (!signInError && signInData?.session) {
            return new Response(
              JSON.stringify({ 
                collaborator, 
                gestorId: gestorUser.id,
                session: signInData.session,
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }
        }
      }
    }

    // Fallback: return without session (for legacy collaborators without auth_user_id)
    return new Response(
      JSON.stringify({ collaborator, gestorId: gestorUser.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("collaborator-login error:", error);
    return new Response(JSON.stringify({ error: "Erro interno do servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
