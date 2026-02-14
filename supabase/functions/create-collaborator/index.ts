import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type RequestBody = {
  name: string;
  pin: string;
  permissions: {
    can_access_dashboard: boolean;
    can_access_estoque: boolean;
    can_access_estoque_producao: boolean;
    can_access_fichas: boolean;
    can_access_producao: boolean;
    can_access_compras: boolean;
    can_access_finalizados: boolean;
    can_access_produtos_venda: boolean;
  };
};

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + "azura_salt_2024");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateCollaboratorEmail(gestorId: string, name: string): string {
  const sanitizedName = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return `collab_${sanitizedName}_${randomSuffix}@${gestorId.substring(0, 8)}.azura.local`;
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
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    if (!url || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Backend não configurado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate the token
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const gestorId = claimsData.claims.sub as string;
    const admin = createClient(url, serviceRoleKey);

    // Get gestor's email for verification
    const { data: gestorData } = await admin.auth.admin.getUserById(gestorId);
    if (!gestorData?.user?.email) {
      return new Response(JSON.stringify({ error: "Gestor não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json().catch(() => null)) as RequestBody | null;
    if (!body) {
      return new Response(JSON.stringify({ error: "Corpo inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { name, pin, permissions } = body;

    if (!name || name.trim().length < 2) {
      return new Response(JSON.stringify({ error: "Nome inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!/^\d{6}$/.test(pin)) {
      return new Response(JSON.stringify({ error: "PIN deve ter 6 dígitos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Create a Supabase Auth user for the collaborator
    const collabEmail = generateCollaboratorEmail(gestorId, name);
    const collabPassword = generatePassword();

    const { data: newUser, error: createUserError } = await admin.auth.admin.createUser({
      email: collabEmail,
      password: collabPassword,
      email_confirm: true, // Auto-confirm
      user_metadata: {
        full_name: name,
        is_collaborator: true,
        gestor_id: gestorId,
      },
    });

    if (createUserError || !newUser?.user) {
      console.error("Error creating auth user:", createUserError);
      return new Response(JSON.stringify({ error: "Erro ao criar usuário" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Update the profile to set gestor_id (trigger creates profile automatically)
    const { error: profileError } = await admin
      .from("profiles")
      .update({ 
        gestor_id: gestorId,
        full_name: name,
      })
      .eq("id", newUser.user.id);

    if (profileError) {
      console.error("Error updating profile:", profileError);
      // Cleanup: delete the created user
      await admin.auth.admin.deleteUser(newUser.user.id);
      return new Response(JSON.stringify({ error: "Erro ao configurar perfil" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3) Create entry in collaborators table
    const hashedPin = await hashPin(pin);

    const { data: collaborator, error: collabError } = await admin
      .from("collaborators")
      .insert({
        gestor_id: gestorId,
        auth_user_id: newUser.user.id,
        name: name.trim(),
        pin_hash: hashedPin,
        ...permissions,
      })
      .select()
      .single();

    if (collabError) {
      console.error("Error creating collaborator:", collabError);
      // Cleanup: delete the created user
      await admin.auth.admin.deleteUser(newUser.user.id);
      return new Response(JSON.stringify({ error: "Erro ao criar colaborador" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ collaborator }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("create-collaborator error:", error);
    return new Response(JSON.stringify({ error: "Erro interno do servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
