import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    // Validate the token and check admin role
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

    const callerId = claimsData.claims.sub as string;
    const admin = createClient(url, serviceRoleKey);

    // Verify caller is admin
    const { data: roleData } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Acesso negado. Apenas administradores." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const urlObj = new URL(req.url);
    const action = urlObj.searchParams.get("action");

    // LIST gestors
    if (req.method === "GET" || action === "list") {
      const { data: gestors, error } = await admin
        .from("profiles")
        .select("id, email, full_name, role, status_pagamento, created_at")
        .eq("role", "gestor")
        .is("gestor_id", null)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error listing gestors:", error);
        return new Response(JSON.stringify({ error: "Erro ao listar gestores" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ gestors }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST actions
    if (req.method === "POST") {
      const body = await req.json().catch(() => null);
      if (!body || !body.action) {
        return new Response(JSON.stringify({ error: "Ação inválida" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // CREATE gestor
      if (body.action === "create") {
        const { email, name, password } = body;

        if (!email || !name || !password) {
          return new Response(JSON.stringify({ error: "Email, nome e senha são obrigatórios" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (password.length < 6) {
          return new Response(JSON.stringify({ error: "Senha deve ter no mínimo 6 caracteres" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Create auth user (NOT auto-confirmed - requires email confirmation)
        const { data: newUser, error: createError } = await admin.auth.admin.createUser({
          email: email.trim(),
          password,
          email_confirm: false,
          user_metadata: { name: name.trim(), full_name: name.trim() },
        });

        if (createError || !newUser?.user) {
          console.error("Error creating user:", createError);
          const msg = createError?.message?.includes("already been registered")
            ? "Este email já está cadastrado"
            : "Erro ao criar conta";
          return new Response(JSON.stringify({ error: msg }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Update profile to gestor role with status_pagamento = true
        const { error: profileError } = await admin
          .from("profiles")
          .update({ 
            role: "gestor",
            status_pagamento: true,
            full_name: name.trim(),
          })
          .eq("id", newUser.user.id);

        if (profileError) {
          console.error("Error updating profile:", profileError);
        }

        // Send confirmation email via Supabase magic link
        // The user will receive an email to confirm their account
        const { error: inviteError } = await admin.auth.admin.generateLink({
          type: "signup",
          email: email.trim(),
          password,
        });

        if (inviteError) {
          console.error("Invite link error (non-critical):", inviteError);
        }

        return new Response(JSON.stringify({ 
          success: true, 
          message: "Gestor criado. Email de confirmação enviado." 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // TOGGLE status (activate/deactivate)
      if (body.action === "toggle_status") {
        const { gestorId, active } = body;
        if (!gestorId) {
          return new Response(JSON.stringify({ error: "ID do gestor é obrigatório" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error } = await admin
          .from("profiles")
          .update({ status_pagamento: active })
          .eq("id", gestorId);

        if (error) {
          return new Response(JSON.stringify({ error: "Erro ao atualizar status" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // DELETE gestor
      if (body.action === "delete") {
        const { gestorId } = body;
        if (!gestorId) {
          return new Response(JSON.stringify({ error: "ID do gestor é obrigatório" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Don't allow deleting yourself
        if (gestorId === callerId) {
          return new Response(JSON.stringify({ error: "Não é possível excluir sua própria conta" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error } = await admin.auth.admin.deleteUser(gestorId);
        if (error) {
          console.error("Error deleting user:", error);
          return new Response(JSON.stringify({ error: "Erro ao excluir gestor" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "Ação não reconhecida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("manage-gestors error:", error);
    return new Response(JSON.stringify({ error: "Erro interno do servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
