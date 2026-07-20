import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Явно падаем при отсутствии конфигурации, чтобы не создавать клиент
// с пустым URL и не ловить криптовые рантайм-ошибки позже.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase env vars missing: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY'
  );
}

// createBrowserClient stores the auth session in cookies (sb-*) instead of
// localStorage, so the Next.js middleware can read it on server-side requests.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
