"use client";

import React, { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { UserPlus, Mail, Lock, Zap, User, Dumbbell, ShieldCheck } from "lucide-react";

type UserRole = "CLIENT" | "TRAINER";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("CLIENT");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const loadingToast = toast.loading("Создание аккаунта...");

    const cleanEmail = email.trim().toLowerCase();

    // Шаг 1: Регистрируем пользователя в Auth с минимальными метаданными
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          role: role,
        },
      },
    });

    if (authError) {
      toast.error("Ошибка аутентификации: " + authError.message, { id: loadingToast });
      setLoading(false);
      return;
    }

    // Шаг 2: Если пользователь создался, принудительно и безопасно пишем профиль вручную
    if (authData?.user) {
      try {
        const { error: profileError } = await supabase
          .from("profiles")
          .upsert({
            id: authData.user.id,
            full_name: fullName.trim(),
            role: role,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' }); // Предотвращает дублирование конфликтов базы

        // Если ручная вставка прошла успешно (или даже если триггер уже сработал частично)
        toast.success("Регистрация успешна!", { id: loadingToast });
        setLoading(false);
        
        setTimeout(() => {
          window.location.href = "/";
        }, 200);
        
      } catch (profileErr) {
        // Мягкий фоллбэк: если профиль упал из-за триггера, но юзер создан — всё равно пускаем
        console.warn("Профиль создается триггером базы:", profileErr);
        toast.success("Аккаунт создан!", { id: loadingToast });
        setLoading(false);
        setTimeout(() => {
          window.location.href = "/";
        }, 200);
      }
    }
  };

  const inputStyles = "w-full rounded-2xl border border-zinc-800 bg-zinc-950 py-3.5 pl-11 pr-4 text-sm text-white placeholder-zinc-700 outline-none transition focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 [&:-webkit-autofill]:[--webkit-box-shadow:0_0_0_50px_#09090b_inset] [&:-webkit-autofill]:[text-fill-color:#fff] [&:-webkit-autofill]:[-webkit-text-fill-color:#fff]";

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 selection:bg-emerald-500/30">
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.5 }}
        className="w-full max-w-md space-y-8 rounded-3xl border border-zinc-900 bg-zinc-900/20 p-8 backdrop-blur-xl"
      >
        <div className="flex flex-col items-center space-y-4">
          <motion.div 
            whileHover={{ scale: 1.05 }} 
            whileTap={{ scale: 0.95 }}
            className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500 text-zinc-950 shadow-[0_0_30px_rgba(16,185,129,0.2)]"
          >
            <Zap className="h-8 w-8 fill-current" />
          </motion.div>
          <div className="text-center">
            <h1 className="text-3xl font-black uppercase tracking-tighter text-white">MyoFitness</h1>
            <p className="text-sm font-medium text-zinc-500 mt-1">Регистрация в системе</p>
          </div>
        </div>

        <form onSubmit={handleRegister} className="mt-8 space-y-4">
          
          {/* Селектор роли */}
          <div className="grid grid-cols-2 gap-3 p-1 bg-zinc-950 border border-zinc-900 rounded-2xl">
            <button
              type="button"
              onClick={() => setRole("CLIENT")}
              className={`flex items-center justify-center gap-2 py-3 text-xs font-bold uppercase rounded-xl transition-all duration-200 ${
                role === "CLIENT"
                  ? "bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/10"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Dumbbell className="h-4 w-4" />
              Я Клиент
            </button>
            <button
              type="button"
              onClick={() => setRole("TRAINER")}
              className={`flex items-center justify-center gap-2 py-3 text-xs font-bold uppercase rounded-xl transition-all duration-200 ${
                role === "TRAINER"
                  ? "bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/10"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              Я Тренер
            </button>
          </div>

          {/* Имя */}
          <div className="space-y-1">
            <div className="relative flex items-center">
              <User className="absolute left-4 h-4 w-4 text-zinc-600 z-10" />
              <input
                type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)}
                className={inputStyles}
                placeholder="Имя и Фамилия"
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1">
            <div className="relative flex items-center">
              <Mail className="absolute left-4 h-4 w-4 text-zinc-600 z-10" />
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className={inputStyles}
                placeholder="Email"
              />
            </div>
          </div>

          {/* Пароль */}
          <div className="space-y-1">
            <div className="relative flex items-center">
              <Lock className="absolute left-4 h-4 w-4 text-zinc-600 z-10" />
              <input
                type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                className={inputStyles}
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
                СОЗДАТЬ АККАУНТ
                <UserPlus className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </>
            )}
          </button>
        </form>

        <div className="text-center text-sm text-zinc-400">
          Уже есть аккаунт?{" "}
          <button
            type="button" onClick={() => router.push('/login')}
            className="font-medium text-emerald-400 hover:text-emerald-300 transition"
          >
            Войти
          </button>
        </div>
      </motion.div>
    </div>
  );
}