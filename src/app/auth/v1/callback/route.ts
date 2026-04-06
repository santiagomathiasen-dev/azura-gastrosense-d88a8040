import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    const next = searchParams.get('next') ?? '/dashboard';

    if (!code) {
        return NextResponse.redirect(`${origin}/auth?error=Código de autenticação ausente`);
    }

    const cookieStore = await cookies();

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return cookieStore.getAll(); },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set({ name, value, ...options })
                        );
                    } catch (_) { }
                },
            },
        }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data?.session) {
        console.error('Auth callback: code exchange failed. Details:', {
            errorMessage: error?.message,
            errorCode: error?.code,
            errorStatus: error?.status
        });
        return NextResponse.redirect(`${origin}/auth?error=Falha na autenticação do Google`);
    }

    const user = data.session.user;
    const providerToken = data.session.provider_token;
    const providerRefreshToken = data.session.provider_refresh_token;

    // Check if profile already exists
    const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

    if (!existingProfile) {
        // User not registered — sign them out and redirect to registration
        await supabase.auth.signOut();
        return NextResponse.redirect(
            `${origin}/auth?error=${encodeURIComponent('Conta nao encontrada. Cadastre-se primeiro para acessar o sistema.')}`
        );
    }

    // Persist Google OAuth tokens for Drive API access
    if (providerToken) {
        try {
            const tokenUpdate: Record<string, string> = {
                google_access_token: providerToken,
            };
            if (providerRefreshToken) {
                tokenUpdate.google_refresh_token = providerRefreshToken;
            }
            await supabase.from('profiles').update(tokenUpdate).eq('id', user.id);
        } catch (tokenErr) {
            console.warn('Auth callback: token save skipped:', tokenErr);
        }
    }

    return NextResponse.redirect(`${origin}${next}`);
}
