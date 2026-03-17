// This file is adapted for Next.js App Router to use SSR Cookies
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './types';

// Detect environment variables for both Vite and Next.js
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.warn("Supabase Client: Environment variables are missing.");
}

export const supabase = createBrowserClient<any>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);
