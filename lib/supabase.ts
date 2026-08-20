// КОНТРАКТ: этот модуль — ТОЛЬКО для браузера (client-компоненты с "use client").
// Здесь живёт browser-клиент Supabase (createBrowserClient), который пишет/читает
// cookie сессии на клиенте. Импорт в серверный компонент запрещён: директива
// `client-only` ниже уронит сборку с понятной ошибкой, если это произойдёт.
// Серверного доступа к данным в проекте нет (нет API-роутов), защита — RLS в Supabase.
// Если появится server-side доступ — заводить ОТДЕЛЬНЫЙ модуль (createServerClient), не этот.
import 'client-only';
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Не бросаем при импорте модуля — создаём клиент лениво при первом обращении.
// Это предотвращает падение сборки/SSR если env-переменные не заданы в окружении сборки.
let _client: SupabaseClient | null = null;

function ensureBrowser() {
  if (typeof window === 'undefined') {
    throw new Error('Supabase browser client can only be used in the browser.');
  }
}

export function getSupabaseClient() {
  if (!_client) {
    ensureBrowser();
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        'Supabase env vars missing: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY'
      );
    }
    _client = createBrowserClient(supabaseUrl, supabaseAnonKey);
  }
  return _client;
}

// Экспортируем прокси, чтобы существующий код `import { supabase } from '@/lib/supabase'`
// продолжал работать. Прокси лениво инициализирует клиент при первом доступе к свойству.
const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    const client = getSupabaseClient();
    return client[prop as keyof typeof client];
  },
  // В случаях вызова функций напрямую (например supabase.from(...))
  // прокси корректно делегирует вызов.
});

export { supabase };
