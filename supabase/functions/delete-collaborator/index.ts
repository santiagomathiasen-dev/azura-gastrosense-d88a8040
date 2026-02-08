import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type RequestBody = {
  collaboratorId: string;
};

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

    const body = (await req.json().catch(() => null)) as RequestBody | null;
    if (!body?.collaboratorId) {
      return new Response(JSON.stringify({ error: "ID do colaborador é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Find the collaborator and verify ownership
    const { data: collaborator, error: findError } = await admin
      .from("collaborators")
      .select("id, auth_user_id, gestor_id")
      .eq("id", body.collaboratorId)
      .single();

    if (findError || !collaborator) {
      return new Response(JSON.stringify({ error: "Colaborador não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (collaborator.gestor_id !== gestorId) {
      return new Response(JSON.stringify({ error: "Sem permissão para deletar este colaborador" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Delete the auth user (this will cascade to profiles)
    if (collaborator.auth_user_id) {
      const { error: deleteUserError } = await admin.auth.admin.deleteUser(collaborator.auth_user_id);
      if (deleteUserError) {
        console.error("Error deleting auth user:", deleteUserError);
      }
    }

    // 3) Delete the collaborator record
    const { error: deleteError } = await admin
      .from("collaborators")
      .delete()
      .eq("id", body.collaboratorId);

    if (deleteError) {
      return new Response(JSON.stringify({ error: "Erro ao deletar colaborador" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("delete-collaborator error:", error);
    return new Response(JSON.stringify({ error: "Erro interno do servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
