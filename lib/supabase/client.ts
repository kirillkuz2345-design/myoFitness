import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Используем non-null assertion оператор (!) только после проверки
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Выводим ошибку в консоль, чтобы сразу было понятно, что переменные не подтянулись
  console.error("CRITICAL: Supabase environment variables are missing!");
}

let browserSupabaseClient: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient => {
  // 1. Серверная среда (SSR)
  if (typeof window === "undefined") {
    return createClient(supabaseUrl || "", supabaseAnonKey || "", {
      auth: {
        persistSession: false,
      },
    });
  }

  // 2. Клиентская среда (Браузер)
  // Используем проверку наличия ключей, чтобы не плодить ошибки при пустых переменных
  if (!browserSupabaseClient) {
    browserSupabaseClient = createClient(supabaseUrl || "", supabaseAnonKey || "", {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // Явно используем window, чтобы не было ошибок при SSR-сборке
        storage: window.localStorage, 
      },
    });
  }

  return browserSupabaseClient;
};