"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider"; 
import { getSupabaseClient } from "@/lib/supabase/client";
import { workoutService } from "@/db/services/workout.service";
import { 
  LogOut, 
  Dumbbell, 
  Calendar, 
  Flame, 
  TrendingUp, 
  Scale, 
  Plus, 
  Link as LinkIcon,
  User,
  ShieldAlert,
  MessageSquare,
  Send,
  ArrowLeft,
  Sliders
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

// Компоненты локальной дизайн-системы
import { Card, Button, Input } from "@/components/ui/myo";

const supabase = getSupabaseClient();

const DAYS_OF_WEEK = [
  { name: "ПН", dateStr: "2026-06-22", dayNum: "22" },
  { name: "ВТ", dateStr: "2026-06-23", dayNum: "23" },
  { name: "СР", dateStr: "2026-06-24", dayNum: "24" },
  { name: "ЧТ", dateStr: "2026-06-25", dayNum: "25" },
  { name: "ПТ", dateStr: "2026-06-26", dayNum: "26" }, 
  { name: "СБ", dateStr: "2026-06-27", dayNum: "27" },
  { name: "ВС", dateStr: "2026-06-28", dayNum: "28" },
];

interface ClientProfile {
  id: string;
  full_name: string | null;
  avatar_url?: string | null;
  height?: number | null;
  weight?: number | null;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  text: string;
  created_at: string;
}

interface ExerciseSet {
  sets: number;
  reps: number;
  weight_kg: number;
}

interface FrontendWorkoutBlock {
  id: string;
  name: string;
  order: number;
  exercises: ExerciseSet[];
}

interface WorkoutConfig {
  id: string;
  name: string;
  title: string;
  status: string;
}

export default function RootPage() {
  const authContext = useAuth();
  const user = authContext?.user;
  const profile = authContext?.profile;
  const loading = authContext?.loading;
  const router = useRouter();

  const isTrainer = profile?.role === "trainer";

  // --- Внутренняя навигация хаба ---
  const [activeTab, setActiveTab] = useState<"dashboard" | "chat" | "config">("dashboard");

  // --- Состояния Атлета (Клиента) ---
  const [selectedDate, setSelectedDate] = useState("2026-06-26");
  const [analytics, setAnalytics] = useState({ 
    streak: 5, 
    tonnage: "0.0 тонн", 
    weight: "78.5 кг", 
    targetWeight: "76.02 кг" 
  });
  const [currentWorkout, setCurrentWorkout] = useState<WorkoutConfig | null>(null);
  const [workoutBlocks, setWorkoutBlocks] = useState<FrontendWorkoutBlock[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // --- Состояния Тренера ---
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isClientsLoading, setIsClientsLoading] = useState(false);
  const [selectedClientForConfig, setSelectedClientForConfig] = useState<ClientProfile | null>(null);

  // --- Состояния Конструктора тренировок (Для Тренера) ---
  const [configBlocks, setConfigBlocks] = useState<FrontendWorkoutBlock[]>([]);
  const [configTitle, setConfigTitle] = useState("План силовой тренировки");
  const [configDate, setConfigDate] = useState("2026-06-26");

  // --- Состояния Чата Поддержки ---
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessageText, setNewMessageText] = useState("");
  const [activeChatTargetId, setActiveChatTargetId] = useState<string>("");

  // Проверка авторизации сессии
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  // Загрузка базы подопечных атлетов (Экран Тренера)
  const fetchClients = useCallback(async (trainerId: string) => {
    setIsClientsLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, height, weight")
        .eq("role", "client")
        .eq("trainer_id", trainerId);
      
      if (error) throw error;
      setClients(data || []);
      if (data && data.length > 0) {
        setActiveChatTargetId(data[0].id);
      }
    } catch (err) {
      console.error("Ошибка синхронизации списка атлетов:", err);
    } finally {
      setIsClientsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.id && isTrainer) {
      fetchClients(user.id);
    } else if (user?.id && !isTrainer && profile?.trainer_id) {
      setActiveChatTargetId(profile.trainer_id);
    }
  }, [user, profile, isTrainer, fetchClients]);

  // Вычисление тоннажа на основе загруженных блоков
  const calculateTonnageFromBlocks = (blocks: FrontendWorkoutBlock[]) => {
    let totalKg = 0;
    blocks.forEach(block => {
      block.exercises.forEach(ex => {
        totalKg += (ex.sets * ex.reps * ex.weight_kg);
      });
    });
    return `${(totalKg / 1000).toFixed(1)} тонн`;
  };

  // Реактивная загрузка тренировок из локальной Dexie БД при смене даты календаря
  useEffect(() => {
    const userId = user?.id;
    if (!userId || isTrainer) return;

    async function loadOfflineData(activeUserId: string, date: string) {
      try {
        const data = await workoutService.getWorkoutWithBlocks(activeUserId, date);
        if (data && data.workout) {
          setCurrentWorkout({
            id: data.workout.id,
            name: data.workout.name || "Тренировочная сессия",
            title: data.workout.title || "Тренировочная сессия",
            status: data.workout.status || "active"
          });
          
          const clientBlocks: FrontendWorkoutBlock[] = (data.blocks || []).map((b: any) => ({
            id: b.id,
            name: b.name || "",
            order: b.order || 0,
            exercises: b.exercises || []
          }));
          setWorkoutBlocks(clientBlocks);
          
          // Реактивно обновляем тоннаж недели на дашборде
          setAnalytics(prev => ({
            ...prev,
            tonnage: calculateTonnageFromBlocks(clientBlocks)
          }));
        } else {
          // Если на этот день в БД ничего нет — сбрасываем состояние, показывая пустой день
          setCurrentWorkout(null);
          setWorkoutBlocks([]);
          setAnalytics(prev => ({ ...prev, tonnage: "0.0 тонн" }));
        }
      } catch (err) {
        console.error("Ошибка чтения локального кэша:", err);
      }
    }
    loadOfflineData(userId, selectedDate);
  }, [user, selectedDate, isTrainer]);

  // --- Синхронизация защищенного чата ---
  useEffect(() => {
    if (!user?.id || !activeChatTargetId) return;

    async function loadChatHistory() {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .or(`and(sender_id.eq.${user?.id},receiver_id.eq.${activeChatTargetId}),and(sender_id.eq.${activeChatTargetId},receiver_id.eq.${user?.id})`)
        .order("created_at", { ascending: true });
      
      if (!error && data) {
        setMessages(data as Message[]);
      }
    }
    loadChatHistory();

    const channel = supabase
      .channel(`room-${activeChatTargetId}`)
      .on(
        "postgres_changes", 
        { event: "INSERT", schema: "public", table: "chat_messages" }, 
        (payload: any) => {
          const msg = payload.new as Message;
          if (
            (msg.sender_id === user?.id && msg.receiver_id === activeChatTargetId) ||
            (msg.sender_id === activeChatTargetId && msg.receiver_id === user?.id)
          ) {
            setMessages((prev) => [...prev, msg]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, activeChatTargetId]);

  const handleSendMessage = async () => {
    if (!newMessageText.trim() || !user?.id || !activeChatTargetId) return;
    const msgText = newMessageText.trim();
    setNewMessageText("");

    const { error } = await supabase.from("chat_messages").insert({
      sender_id: user.id,
      receiver_id: activeChatTargetId,
      text: msgText
    });
    if (error) toast.error("Ошибка отправки сообщения через шлюз");
  };

  // --- Самостоятельное добавление тренировки атлетом ---
  const handleAddCustomWorkout = () => {
    toast.success("Новый шаблон сессии успешно добавлен в журнал");
    const fakeId = `custom-${Math.random().toString(36).substr(2, 9)}`;
    setCurrentWorkout({
      id: fakeId,
      name: "Самостоятельное занятие",
      title: "Самостоятельное занятие",
      status: "active"
    });
    const defaultBlocks = [
      { id: `b-${Math.random().toString(36).substr(2, 9)}`, name: "Приседания со штангой", order: 0, exercises: [{ sets: 4, reps: 10, weight_kg: 80 }] }
    ];
    setWorkoutBlocks(defaultBlocks);
    setAnalytics(prev => ({ ...prev, tonnage: calculateTonnageFromBlocks(defaultBlocks) }));
  };

  const handleSaveWorkout = async () => {
    const userId = user?.id;
    if (!userId || !currentWorkout) return toast.error("Не удалось идентифицировать профиль атлета");
    
    setIsSaving(true);
    const loadingToast = toast.loading("Синхронизация результатов с локальной БД...");

    try {
      const workoutRecord = {
        id: currentWorkout.id,
        client_id: userId,
        date: selectedDate,
        title: currentWorkout.title,
        name: currentWorkout.name,
        status: "completed", // Меняем статус на завершенный при фиксации
        updated_at: new Date().toISOString(),
        sync_status: "pending" as const
      };

      const dbBlocks = workoutBlocks.map(b => ({
        ...b,
        workout_id: currentWorkout.id
      }));

      await workoutService.saveWorkoutWithBlocks(workoutRecord, dbBlocks);
      
      // Инкрементируем стрик дней активности при успешном сохранении тренировки
      setAnalytics(prev => ({ ...prev, streak: prev.streak + 1 }));
      toast.success("Данные успешно зафиксированы в системе", { id: loadingToast });
    } catch (err) {
      console.error(err);
      toast.error("Критическая ошибка синхронизации ядра", { id: loadingToast });
    } finally {
      setIsSaving(false);
    }
  };

  // --- Настройки Конструктора (Вкладка Тренера) ---
  const handleOpenConfigurator = (client: ClientProfile) => {
    setSelectedClientForConfig(client);
    setConfigTitle("План силовой тренировки");
    setConfigBlocks([
      { id: `b-${Math.random().toString(36).substr(2, 9)}`, name: "Жим штанги лежа", order: 0, exercises: [{ sets: 4, reps: 8, weight_kg: 80 }] }
    ]);
    setActiveTab("config");
  };

  const handleSaveConfiguredPlan = async () => {
    if (!selectedClientForConfig || configBlocks.length === 0 || !user?.id) {
      return toast.error("Ошибка: Сначала заполните карточку тренировочного плана");
    }
    setIsSaving(true);
    const loadingToast = toast.loading("Удаленная отправка программы на устройство атлета...");

    try {
      const generatedId = `trainer-plan-${Math.random().toString(36).substr(2, 9)}`;
      const workoutRecord = {
        id: generatedId,
        trainer_id: user.id,
        client_id: selectedClientForConfig.id,
        date: configDate,
        title: configTitle.trim(),
        name: configTitle.trim(),
        status: "active",
        is_custom: false,
        sync_status: "pending" as const,
        updated_at: new Date().toISOString()
      };

      const dbConfigBlocks = configBlocks.map(b => ({
        ...b,
        workout_id: generatedId
      }));

      await workoutService.saveWorkoutWithBlocks(workoutRecord, dbConfigBlocks);
      toast.success("Программа успешно добавлена в календарь атлета", { id: loadingToast });
      setActiveTab("dashboard");
    } catch (err) {
      console.error(err);
      toast.error("Не удалось связаться с сервером обновлений", { id: loadingToast });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const handleGenerateInvite = () => {
    if (!user?.id) return toast.error("Ошибка безопасности текущей сессии");
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const inviteUrl = `${origin}/register?trainerId=${user.id}`;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      toast.success("Пригласительная ссылка скопирована в буфер обмена!", { icon: "🔗" });
    });
  };

  const filteredClients = clients.filter((c) =>
    c.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center font-mono space-y-2">
        <div className="h-4 w-4 border-2 border-[#00E676] border-t-transparent animate-spin" />
        <span className="text-[8px] text-zinc-500 uppercase tracking-widest">Инициализация интерфейса системы...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#E1E3E6] font-mono antialiased pb-24">
      <Toaster />

      {/* --- ТЕХНОЛОГИЧЕСКИЙ ХЕДЕР --- */}
      <header className="border-b border-[#141519] bg-[#0A0A0A]/90 backdrop-blur-md sticky top-0 z-50 p-4">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-black text-white tracking-widest uppercase flex items-center gap-1.5">
              MYO <span className="text-[#00E676]">{isTrainer ? "ПРО-ТРЕНЕР" : "АТЛЕТ"}</span> 
            </span>
            <span className="text-[7px] text-zinc-500 font-bold uppercase mt-0.5">• Аккаунт: {profile?.full_name || "Пользователь"}</span>
          </div>
          <div className="flex gap-2">
            {isTrainer && (
              <Button variant="primary" className="!text-[8px] h-7 px-2.5 uppercase font-bold tracking-widest" onClick={handleGenerateInvite}>
                <LinkIcon className="w-2.5 h-2.5 mr-1" /> Инвайт-ссылка
              </Button>
            )}
            <Button variant="danger" className="p-2 h-7 w-7" onClick={handleSignOut}>
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* --- ОСНОВНОЙ КОНТЕНТНЫЙ БЛОК --- */}
      <main className="mx-auto max-w-xl px-4 py-4 space-y-6">
        
        {/* ==========================================================
           ВКЛАДКА 1: РАБОЧИЙ ДАШБОРД (ТРЕНЕР / КЛИЕНТ)
           ========================================================== */}
        {activeTab === "dashboard" && (
          <>
            {isTrainer ? (
              /* --- ИНТЕРФЕЙС ДАШБОРДА ТРЕНЕРА --- */
              <>
                <div className="grid grid-cols-3 gap-2">
                  <Card className="p-3 bg-[#141519] border-[#222328]">
                    <span className="text-[6px] font-bold text-zinc-500 uppercase block">Атлеты</span>
                    <span className="text-xs font-black text-white mt-1 block">{clients.length} чел.</span>
                  </Card>
                  <Card className="p-3 bg-[#141519] border-[#222328]">
                    <span className="text-[6px] font-bold text-zinc-500 uppercase block">Недельный объем</span>
                    <span className="text-xs font-black text-[#00E676] mt-1 block">48.2 тонн</span>
                  </Card>
                  <Card className="p-3 bg-[#141519] border-[#222328]">
                    <span className="text-[6px] font-bold text-zinc-500 uppercase block">База данных</span>
                    <span className="text-[7px] font-black text-blue-400 mt-1 block uppercase">Онлайн синк</span>
                  </Card>
                </div>

                <div className="space-y-2">
                  <span className="text-[8px] font-black tracking-widest text-[#989AA0] uppercase block">Управление закрепленными атлетами</span>
                  <Input 
                    placeholder="Поиск по имени или ID..." 
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)} 
                    className="!bg-[#141519] !border-[#222328] text-xs h-9" 
                  />
                  <div className="space-y-2">
                    {filteredClients.length === 0 ? (
                      <div className="border border-dashed border-[#222328] bg-[#141519]/20 rounded-xl p-6 text-center">
                        <ShieldAlert className="h-4 w-4 text-zinc-600 mx-auto mb-1" />
                        <p className="text-[8px] text-zinc-500 uppercase tracking-wider font-bold">Список атлетов пуст</p>
                      </div>
                    ) : (
                      filteredClients.map((client) => (
                        <Card key={client.id} className="p-0 overflow-hidden border-[#222328]">
                          <div className="p-4 bg-[#141519] rounded-xl w-full space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <User className="h-3.5 w-3.5 text-[#00E676]" />
                                <span className="text-xs font-black text-white uppercase">{client.full_name || "Без имени"}</span>
                              </div>
                              <Button variant="primary" className="!text-[7px] h-6 px-2 font-black uppercase" onClick={() => handleOpenConfigurator(client)}>
                                <Sliders className="w-2.5 h-2.5 mr-1" /> Настроить план
                              </Button>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[9px] font-bold text-zinc-400 border-t border-zinc-800/60 pt-2 uppercase">
                              <span>Рост: <span className="text-white font-mono">{client.height || "—"} см</span></span>
                              <span>Вес: <span className="text-[#00E676] font-mono">{client.weight || "—"} кг</span></span>
                            </div>
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
                </div>
              </>
            ) : (
              /* --- ИНТЕРФЕЙС ДАШБОРДА КЛИЕНТА --- */
              <>
                <div className="bg-[#141519] border border-[#222328] rounded-xl p-3 space-y-3">
                  <div className="flex items-center justify-between border-b border-[#222328] pb-2">
                    <span className="text-[9px] font-black text-white uppercase flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-[#00E676]" /> Июнь 2026
                    </span>
                    <Button variant="primary" className="!text-[7px] h-5 px-2 font-bold uppercase" onClick={handleAddCustomWorkout}>
                      + Своя тренировка
                    </Button>
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {DAYS_OF_WEEK.map((day) => (
                      <button 
                        key={day.dateStr} 
                        onClick={() => setSelectedDate(day.dateStr)} 
                        className={`flex flex-col items-center p-1.5 rounded-lg border text-[10px] transition-all ${
                          selectedDate === day.dateStr 
                            ? "bg-white text-black font-black border-white" 
                            : "bg-[#0A0A0A] border-[#222328] text-zinc-500 hover:border-zinc-700"
                        }`}
                      >
                        <span className="text-[6px] font-bold block mb-0.5">{day.name}</span>
                        {day.dayNum}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Card className="p-2 text-center">
                    <span className="text-[6px] font-bold text-zinc-500 block uppercase">Активные дни</span>
                    <span className="text-xs font-black text-white mt-0.5 block">{analytics.streak}</span>
                  </Card>
                  <Card className="p-2 text-center">
                    <span className="text-[6px] font-bold text-zinc-500 block uppercase">Тоннаж недели</span>
                    <span className="text-xs font-black text-[#00E676] mt-0.5 block">{analytics.tonnage}</span>
                  </Card>
                  <Card className="p-2 text-center">
                    <span className="text-[6px] font-bold text-zinc-500 block uppercase">Вес тела</span>
                    <span className="text-xs font-black text-white mt-0.5 block">{analytics.weight}</span>
                  </Card>
                </div>

                <div className="space-y-2">
                  <span className="text-[8px] font-black tracking-widest text-[#989AA0] uppercase block">Журнал тренировок</span>
                  <Card className="border border-[#222328] bg-[#141519] p-4 space-y-4">
                    <div className="flex items-center justify-between border-b border-[#222328] pb-2">
                      <div>
                        <h3 className="text-xs font-black text-white uppercase tracking-wider">{currentWorkout?.title || "День отдыха"}</h3>
                        <span className="text-[6px] font-bold text-zinc-500 tracking-wider block uppercase mt-0.5">Фиксация нагрузок на {selectedDate}</span>
                      </div>
                      <Button 
                        variant="primary" 
                        className="h-6 !text-[8px] font-black uppercase px-3" 
                        onClick={handleSaveWorkout} 
                        disabled={isSaving || !currentWorkout}
                      >
                        {isSaving ? "Сохранение..." : "Зафиксировать"}
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {workoutBlocks.length === 0 ? (
                        <p className="text-[8px] text-zinc-600 uppercase text-center py-4 font-bold">Тренировки не найдены</p>
                      ) : (
                        workoutBlocks.map((block, idx) => (
                          <div key={block.id || idx} className="bg-[#0A0A0A] border border-[#222328] rounded-lg p-2.5 flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="text-[7px] font-black text-[#00E676] bg-[#141519] w-3.5 h-3.5 rounded flex items-center justify-center border border-zinc-800">{idx + 1}</span>
                              <span className="text-[10px] font-bold text-white uppercase">{block.name || "Упражнение"}</span>
                            </div>
                            <span className="text-[9px] text-[#00E676] font-mono font-bold">
                              {block.exercises?.[0]?.sets || 0}х{block.exercises?.[0]?.reps || 0} — {block.exercises?.[0]?.weight_kg || 0} кг
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </Card>
                </div>
              </>
            )}
          </>
        )}

        {/* ==========================================================
           ВКЛАДКА 2: РАБОЧИЙ КОНТЕНТ-ЧАТ (ТРЕНЕР <-> КЛИЕНТ)
           ========================================================== */}
        {activeTab === "chat" && (
          <Card className="border border-[#222328] bg-[#141519] p-4 h-[440px] flex flex-col justify-between rounded-xl">
            <div className="border-b border-[#222328] pb-2 mb-2 flex justify-between items-center">
              <span className="text-[9px] font-black text-white uppercase flex items-center gap-1">
                <MessageSquare className="h-3 w-3 text-[#00E676]" /> Рабочий контент-чат
              </span>
              {isTrainer && clients.length > 0 && (
                <select 
                  className="bg-[#0A0A0A] border border-[#222328] text-[9px] font-bold p-1 rounded text-white font-mono" 
                  value={activeChatTargetId} 
                  onChange={(e) => setActiveChatTargetId(e.target.value)}
                >
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.full_name?.toUpperCase() || c.id.slice(0, 6)}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-[10px] min-h-0">
              {messages.length === 0 ? (
                <div className="text-center text-zinc-600 uppercase py-16 text-[8px] font-bold">Архив сообщений пуст</div>
              ) : (
                messages.map((msg) => {
                  const isMyMessage = msg.sender_id === user?.id;
                  return (
                    <div key={msg.id} className={`flex ${isMyMessage ? "justify-end" : "justify-start"}`}>
                      <div className={`p-2 rounded-lg max-w-[80%] border ${
                        isMyMessage 
                          ? "bg-[#0A0A0A] border-[#00E676]/30 text-[#00E676]" 
                          : "bg-[#18191E] border-[#222328] text-white"
                      }`}>
                        <p className="leading-tight uppercase break-words">{msg.text}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex gap-2 border-t border-[#222328] pt-3 mt-2">
              <Input 
                placeholder="Сообщение..." 
                value={newMessageText} 
                onChange={(e) => setNewMessageText(e.target.value)} 
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()} 
                className="flex-1 !bg-[#0A0A0A] !border-[#222328] text-xs h-9" 
              />
              <Button variant="primary" className="h-9 px-3" onClick={handleSendMessage}>
                <Send className="w-3 h-3" />
              </Button>
            </div>
          </Card>
        )}

        {/* ==========================================================
           ВКЛАДКА 3: КОНФИГУРАТОР ПЛАНОВ (ДЛЯ ТРЕНЕРА)
           ========================================================== */}
        {activeTab === "config" && isTrainer && selectedClientForConfig && (
          <Card className="border border-[#222328] bg-[#141519] p-4 space-y-4 rounded-xl">
            <div className="flex items-center justify-between border-b border-[#222328] pb-2">
              <button 
                onClick={() => setActiveTab("dashboard")} 
                className="text-[8px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-1"
              >
                <ArrowLeft className="h-3 w-3" /> Назад к связке
              </button>
              <Button 
                variant="primary" 
                className="h-6 !text-[8px] font-black uppercase tracking-wider px-3" 
                onClick={handleSaveConfiguredPlan} 
                disabled={isSaving || configBlocks.length === 0}
              >
                Отправить программу
              </Button>
            </div>
            
            <div className="space-y-2">
              <div>
                <label className="text-[7px] text-zinc-500 font-bold uppercase block mb-1">Название программы</label>
                <Input value={configTitle} onChange={(e) => setConfigTitle(e.target.value)} className="!bg-[#0A0A0A] font-bold text-xs" />
              </div>
              <div>
                <label className="text-[7px] text-zinc-500 font-bold uppercase block mb-1">Дата проведения в календаре</label>
                <Input type="date" value={configDate} onChange={(e) => setConfigDate(e.target.value)} className="!bg-[#0A0A0A] text-xs font-mono" />
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <span className="text-[8px] font-black text-[#989AA0] block uppercase tracking-wider">Состав структуры упражнений</span>
              
              {configBlocks.map((block, bIdx) => (
                <div key={block.id} className="bg-[#0A0A0A] border border-[#222328] p-3 rounded-xl space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] font-black text-[#00E676] bg-[#141519] w-4 h-4 rounded border border-zinc-800 flex items-center justify-center">{bIdx + 1}</span>
                    <Input 
                      placeholder="Название упражнения..." 
                      value={block.name} 
                      onChange={(e) => {
                        const updated = [...configBlocks];
                        updated[bIdx].name = e.target.value;
                        setConfigBlocks(updated);
                      }} 
                      className="flex-1 h-7 text-xs !bg-transparent !border-b !border-t-0 !border-l-0 !border-r-0 !rounded-none p-0 focus:ring-0" 
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <span className="text-[6px] text-zinc-500 font-bold block uppercase mb-1">Подходы</span>
                      <Input 
                        type="number" 
                        value={block.exercises[0].sets} 
                        onChange={(e) => {
                          const updated = [...configBlocks];
                          updated[bIdx].exercises[0].sets = Math.max(0, parseInt(e.target.value) || 0);
                          setConfigBlocks(updated);
                        }} 
                        className="h-7 text-xs text-center !bg-[#141519]" 
                      />
                    </div>
                    <div>
                      <span className="text-[6px] text-zinc-500 font-bold block uppercase mb-1">Повторения</span>
                      <Input 
                        type="number" 
                        value={block.exercises[0].reps} 
                        onChange={(e) => {
                          const updated = [...configBlocks];
                          updated[bIdx].exercises[0].reps = Math.max(0, parseInt(e.target.value) || 0);
                          setConfigBlocks(updated);
                        }} 
                        className="h-7 text-xs text-center !bg-[#141519]" 
                      />
                    </div>
                    <div>
                      <span className="text-[6px] text-zinc-500 font-bold block uppercase mb-1">Вес (кг)</span>
                      <Input 
                        type="number" 
                        value={block.exercises[0].weight_kg} 
                        onChange={(e) => {
                          const updated = [...configBlocks];
                          updated[bIdx].exercises[0].weight_kg = Math.max(0, parseFloat(e.target.value) || 0);
                          setConfigBlocks(updated);
                        }} 
                        className="h-7 text-xs text-center text-[#00E676] !bg-[#141519]" 
                      />
                    </div>
                  </div>
                </div>
              ))}

              <Button 
                variant="secondary" 
                className="w-full !text-[8px] h-8 uppercase font-bold border-dashed border-[#222328]" 
                onClick={() => setConfigBlocks([
                  ...configBlocks, 
                  { id: `b-${Math.random().toString(36).substr(2, 9)}`, name: "", order: configBlocks.length, exercises: [{ sets: 3, reps: 10, weight_kg: 0 }] }
                ])}
              >
                + Добавить элемент в программу
              </Button>
            </div>
          </Card>
        )}
      </main>

      {/* --- ГЛОБАЛЬНЫЙ ТАБ-БАР (ФУТЕР) --- */}
      <nav className="fixed bottom-0 left-0 right-0 border-t border-[#141519] bg-[#0A0A0A]/95 backdrop-blur-md p-3 z-50">
        <div className="max-w-xl mx-auto grid grid-cols-2 gap-3">
          <Button 
            variant={activeTab === "dashboard" || activeTab === "config" ? "primary" : "secondary"} 
            onClick={() => setActiveTab("dashboard")} 
            className="h-9 !text-[9px] uppercase font-black tracking-widest flex items-center justify-center gap-1.5"
          >
            <Dumbbell className="h-3.5 w-3.5" /> Дашборд
          </Button>
          <Button 
            variant={activeTab === "chat" ? "primary" : "secondary"} 
            onClick={() => setActiveTab("chat")} 
            className="h-9 !text-[9px] uppercase font-black tracking-widest flex items-center justify-center gap-1.5"
          >
            <MessageSquare className="h-3.5 w-3.5" /> Чат
          </Button>
        </div>
      </nav>
    </div>
  );
}