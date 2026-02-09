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

// Simple in-memory rate limiting store
// In production with multiple instances, use Redis/Upstash
const loginAttempts = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes after max failures

function checkRateLimit(key: string): { allowed: boolean; remainingAttempts: number } {
  const now = Date.now();
  const attempt = loginAttempts.get(key);

  // Clean up old entries
  if (attempt && now > attempt.resetTime) {
    loginAttempts.delete(key);
  }

  const current = loginAttempts.get(key);
  if (!current) {
    return { allowed: true, remainingAttempts: RATE_LIMIT_MAX_ATTEMPTS };
  }

  if (current.count >= RATE_LIMIT_MAX_ATTEMPTS) {
    return { allowed: false, remainingAttempts: 0 };
  }

  return { allowed: true, remainingAttempts: RATE_LIMIT_MAX_ATTEMPTS - current.count };
}

function recordAttempt(key: string, success: boolean): void {
  const now = Date.now();
  const current = loginAttempts.get(key);

  if (success) {
    // Clear on successful login
    loginAttempts.delete(key);
    return;
  }

  if (!current || now > current.resetTime) {
    loginAttempts.set(key, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
    });
  } else {
    current.count += 1;
    // Extend lockout on continued failures
    if (current.count >= RATE_LIMIT_MAX_ATTEMPTS) {
      current.resetTime = now + LOCKOUT_DURATION_MS;
    }
    loginAttempts.set(key, current);
  }
}

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

function rateLimitResponse(minutesRemaining: number) {
  return new Response(
    JSON.stringify({ 
      error: `Muitas tentativas de login. Tente novamente em ${minutesRemaining} minutos.` 
    }), 
    {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
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

    // Rate limiting check using gestor email as key
    const rateLimitKey = `login:${gestorEmail}`;
    const { allowed, remainingAttempts } = checkRateLimit(rateLimitKey);
    
    if (!allowed) {
      const attempt = loginAttempts.get(rateLimitKey);
      const minutesRemaining = attempt 
        ? Math.ceil((attempt.resetTime - Date.now()) / 60000)
        : 15;
      return rateLimitResponse(minutesRemaining);
    }

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
      // Record failed attempt but don't reveal if email exists
      recordAttempt(rateLimitKey, false);
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
      // Record failed attempt
      recordAttempt(rateLimitKey, false);
      return new Response(JSON.stringify({ error: "Email ou PIN incorretos" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Successful login - clear rate limit counter
    recordAttempt(rateLimitKey, true);

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
