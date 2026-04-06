import type { Metadata } from 'next';
import { Outfit, Cormorant_Garamond } from 'next/font/google';

const outfit = Outfit({
    subsets: ['latin'],
    variable: '--font-outfit',
});

const cormorantGaramond = Cormorant_Garamond({
    weight: ['400', '500', '600', '700'],
    subsets: ['latin'],
    variable: '--font-cormorant',
});
import './globals.css'; // We'll need to create this or link to src/index.css
import { Providers } from './providers';



export const metadata: Metadata = {
    title: 'Azura GastroSense | Gestão de Alta Performance',
    description: 'Sistema inteligente para gestão de restaurantes e produção gastronômica.',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="pt-BR" suppressHydrationWarning>
            <body className={`${outfit.variable} ${cormorantGaramond.variable} font-sans`}>
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                            if ('serviceWorker' in navigator) {
                                navigator.serviceWorker.getRegistrations().then(function(registrations) {
                                    for(let registration of registrations) {
                                        registration.unregister();
                                        console.log('Legacy Service Worker deregistered');
                                    }
                                });
                            }
                        `,
                    }}
                />
                <Providers>
                    <div className="relative flex min-h-screen flex-col">
                        <main className="flex-1">{children}</main>
                    </div>
                </Providers>
            </body>
        </html>
    );
}
