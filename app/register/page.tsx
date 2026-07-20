// app/register/page.tsx
"use client";

import { useState, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";
import { UserPlus, Mail, Lock, User, ArrowLeft, Dumbbell } from "lucide-react";


function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const inviteCode = searchParams.get("invite")?.trim() || null;
  const legacyTrainerId = searchParams.get("trainer_id")?.trim() || null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"client" | "trainer">(inviteCode || legacyTrainerId ? "client" : "client");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const cleanEmail = email.trim().toLowerCase();
    const cleanFullName = fullName.trim().replace(/\s+/g, ' ');

    if (cleanFullName.length < 2) {
      return toast.error("Введите корректное имя и фамилию");
    }

    setLoading(true);
    const loadingToast = toast.loading("Создание аккаунта...");

    try {
      let finalTrainerId: string | null = null;

      // Проверка реферального инвайт-кода, если регистрируется подопечный
      if (role === "client" && inviteCode) {
        const { data: inviteData, error: inviteError } = await supabase
          .from("trainer_invites")
          .select("trainer_id, uses_count, max_uses, is_active")
          .eq("invite_code", inviteCode)
          .single();

        if (inviteError || !inviteData) {
          throw new Error("Указанный код приглашения не найден или недействителен.");
        }

        if (!inviteData.is_active || (inviteData.uses_count >= inviteData.max_uses)) {
          throw new Error("Срок действия этой ссылки приглашения истёк или исчерпан лимит мест.");
        }

        finalTrainerId = inviteData.trainer_id;
      } else if (role === "client" && legacyTrainerId) {
        finalTrainerId = legacyTrainerId;
      }

      // Создание пользователя в Supabase Auth (профиль создается автоматически через Postgres-триггер)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: cleanFullName,
            role: role,
            trainer_id: finalTrainerId,
          }
        }
      });

      if (authError) {
        if (authError.message.toLowerCase().includes("already registered") || authError.status === 422) {
          toast.error("Этот Email уже зарегистрирован! Перенаправляем на вход...", { id: loadingToast });
          setLoading(false);
          setTimeout(() => router.push("/login"), 1500);
          return;
        }
        throw authError;
      }

      if (authData?.user) {
        // Если была успешная регистрация по инвайту — обновляем счетчик на бэкенде
        if (role === "client" && inviteCode && finalTrainerId) {
          try {
            const { data: currentInvite } = await supabase
              .from("trainer_invites")
              .select("uses_count")
              .eq("invite_code", inviteCode)
              .single();
              
            const nextCount = currentInvite ? currentInvite.uses_count + 1 : 1;

            await supabase
              .from("trainer_invites")
              .update({ uses_count: nextCount })
              .eq("invite_code", inviteCode);
          } catch (syncErr) {
            console.error("Не удалось обновить счётчик инвайтов:", syncErr);
          }
        }

        toast.success("Регистрация успешна! Входим...", { id: loadingToast });
        setLoading(false);

        // Форсируем перезагрузку на корень, чтобы AuthProvider и миграция Dexie v3 инициализировали чистую сессию
        setTimeout(() => {
          window.location.href = "/";
        }, 500);
        
      } else {
        throw new Error("Не удалось получить данные сессии пользователя.");
      }
    } catch (error: any) {
      console.error("[Register Error]:", error);
      toast.error(error.message || "Неизвестный сбой при регистрации", { id: loadingToast });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 selection:bg-emerald-500/30 py-12">
      <Toaster position="top-right" toastOptions={{ style: { background: "#0A0A0A", color: "#FFF", border: "1px solid #18181B" } }} />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.5 }}
        className="w-full max-w-md space-y-8 rounded-3xl border border-zinc-900 bg-zinc-900/20 p-8 backdrop-blur-xl relative"
      >
        <button 
          type="button" 
          onClick={() => router.push('/login')}
          className="absolute left-6 top-8 text-zinc-500 hover:text-white transition flex items-center gap-2 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center space-y-4 pt-4">
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500 text-zinc-950 shadow-[0_0_30px_rgba(16,185,129,0.2)]"
          >
            <UserPlus className="h-8 w-8" />
          </motion.div>
          <div className="text-center">
            <h1 className="text-2xl font-black uppercase tracking-tighter text-white">Создать аккаунт</h1>
            {inviteCode || legacyTrainerId ? (
              <p className="text-sm font-medium text-emerald-400 mt-1 flex items-center justify-center gap-1.5">
                <Dumbbell className="w-3.5 h-3.5" /> Регистрация по приглашению тренера
              </p>
            ) : (
              <p className="text-sm font-medium text-zinc-500 mt-1">Присоединяйтесь к myofitness</p>
            )}
          </div>
        </div>

        <form onSubmit={handleRegister} className="mt-8 space-y-4">
          <div className="space-y-1">
            <div className="relative flex items-center">
              <User className="absolute left-4 h-4 w-4 text-zinc-600" />
              <input
                type="text" 
                required 
                value={fullName} 
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 py-4 pl-11 pr-4 text-sm text-white placeholder-zinc-700 outline-none transition focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
                placeholder="Имя и Фамилия"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="relative flex items-center">
              <Mail className="absolute left-4 h-4 w-4 text-zinc-600" />
              <input
                type="email" 
                required 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 py-4 pl-11 pr-4 text-sm text-white placeholder-zinc-700 outline-none transition focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
                placeholder="Email"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="relative flex items-center">
              <Lock className="absolute left-4 h-4 w-4 text-zinc-600" />
              <input
                type="password" 
                required 
                minLength={6} 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 py-4 pl-11 pr-4 text-sm text-white placeholder-zinc-700 outline-none transition focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
                placeholder="Пароль (минимум 6 символов)"
              />
            </div>
          </div>

          {!inviteCode && !legacyTrainerId && (
            <div className="flex gap-2 pt-2">
              <button
                type="button" 
                onClick={() => setRole("client")}
                className={`flex-1 rounded-xl py-2.5 text-xs font-bold uppercase tracking-wider transition border ${
                  role === "client" ? "bg-zinc-800 border-emerald-500/50 text-white" : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Я Клиент
              </button>
              <button
                type="button" 
                onClick={() => setRole("trainer")}
                className={`flex-1 rounded-xl py-2.5 text-xs font-bold uppercase tracking-wider transition border ${
                  role === "trainer" ? "bg-zinc-800 border-emerald-500/50 text-white" : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Я Тренер
              </button>
            </div>
          )}

          <button
            type="submit" 
            disabled={loading}
            className="group relative mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-4 text-sm font-bold text-zinc-950 shadow-lg shadow-emerald-500/10 transition hover:bg-emerald-400 disabled:opacity-50"
          >
            {loading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-900 border-t-transparent" />
            ) : (
              "ЗАРЕГИСТРИРОВАТЬСЯ"
            )}
          </button>
        </form>

        <div className="text-center text-sm text-zinc-400 pt-4">
          Уже есть аккаунт?{" "}
          <button
            type="button" 
            onClick={() => router.push('/login')}
            className="font-medium text-emerald-400 hover:text-emerald-300 transition"
          >
            Войти
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-zinc-950 text-emerald-500">Загрузка...</div>}>
      <RegisterForm />
    </Suspense>
  );
}