import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// createBrowserClient stores the auth session in cookies (sb-*) instead of
// localStorage, so the Next.js middleware can read it on server-side requests.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);