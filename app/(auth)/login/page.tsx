"use client";

import { useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
const supabase = getSupabaseClient();
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { LogIn, Mail, Lock, Zap } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const loadingToast = toast.loading("Авторизация...");

    // Санитазация почты от случайных пробелов при автозаполнении на смартфонах
    const cleanEmail = email.trim().toLowerCase();

    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      toast.error("Ошибка входа: " + error.message, { id: loadingToast });
      setLoading(false);
    } else {
      toast.success("С возвращением в MyoFitness!", { id: loadingToast });
      setLoading(false);
      
      // Используем жесткий редирект для мгновенного обновления AuthProvider куками сессии
      setTimeout(() => {
        window.location.href = "/";
      }, 200);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 selection:bg-emerald-500/30">
      <motion.div 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="w-full max-w-md space-y-8 rounded-3xl border border-zinc-900 bg-zinc-900/20 p-8 backdrop-blur-xl"
      >
        <div className="flex flex-col items-center space-y-4">
          <motion.div 
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500 text-zinc-950 shadow-[0_0_30px_rgba(16,185,129,0.2)]"
          >
            <Zap className="h-8 w-8 fill-current" />
          </motion.div>
          <div className="text-center">
            <h1 className="text-3xl font-black uppercase tracking-tighter text-white">MyoFitness</h1>
            <p className="text-sm font-medium text-zinc-500 mt-1">Твои тренировки под контролем</p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="mt-8 space-y-4">
          <div className="space-y-1">
            <div className="relative flex items-center">
              <Mail className="absolute left-4 h-4 w-4 text-zinc-600" />
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 py-3.5 pl-11 pr-4 text-sm text-white placeholder-zinc-700 outline-none transition focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
                placeholder="Email"
              />
            </div>
          </div>
          <div className="space-y-1">
            <div className="relative flex items-center">
              <Lock className="absolute left-4 h-4 w-4 text-zinc-600" />
              <input
                type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 py-3.5 pl-11 pr-4 text-sm text-white placeholder-zinc-700 outline-none transition focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
                placeholder="Пароль"
              />
            </div>
          </div>

          <button
            type="submit" disabled={loading}
            className="group relative flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-4 text-sm font-bold text-zinc-950 shadow-lg shadow-emerald-500/10 transition hover:bg-emerald-400 disabled:opacity-50"
          >
            {loading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-900 border-t-transparent" />
            ) : (
              <>
                ВХОД
                <LogIn className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </>
            )}
          </button>
        </form>

        <div className="text-center text-sm text-zinc-400">
          Нет аккаунта?{" "}
          <button
            type="button" onClick={() => router.push('/register')}
            className="font-medium text-emerald-400 hover:text-emerald-300 transition"
          >
            Зарегистрироваться
          </button>
        </div>

        <p className="text-center text-xs text-zinc-600">
          Проблемы с доступом? Свяжитесь со своим тренером.
        </p>
      </motion.div>
    </div>
  );
}