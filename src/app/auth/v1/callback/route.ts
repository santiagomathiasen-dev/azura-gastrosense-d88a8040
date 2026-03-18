import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    // if "next" is in search params, use it as the redirect URL
    const next = searchParams.get('next') ?? '/dashboard';

    if (code) {
        const cookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() {
                        return cookieStore.getAll();
                    },
                    setAll(cookiesToSet) {
                        try {
                            cookiesToSet.forEach(({ name, value, options }) => {
                                cookieStore.set({ name, value, ...options });
                            });
                        } catch (error) {
                            // Ignored if called during a server component render
                        }
                    },
                },
            }
        );
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error && data?.session) {
            const user = data.session.user;
            // Se o usuário acabou de ser criado (created_at é de poucos segundos atrás) e usou o google:
            const isNewUser = new Date(user.created_at).getTime() > Date.now() - 15000;
            
            if (isNewUser) {
                // Bloqueia e desloga o usuário, forçando ele a criar conta por email primeiro
                await supabase.auth.signOut();
                return NextResponse.redirect(`${origin}/auth?error=Sua conta não existe. Faça o cadastro pelo formulário de email primeiro.`);
            }

            return NextResponse.redirect(`${origin}${next}`);
        }
    }

    // return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/auth?error=Falha na autenticação do Google`);
}
