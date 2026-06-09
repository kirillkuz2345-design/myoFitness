"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { getSupabaseClient } from "@/lib/supabase/client";
const supabase = getSupabaseClient();

interface Message {
  id: string;
  sender_id: string;
  client_id: string;
  text: string;
  created_at: string;
}

export default function ChatPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const clientId = params.id as string;

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Защита роута: если загрузка завершена, а юзера нет — отправляем на логин
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  // Загрузка сообщений и подписка на обновления в реальном времени
  useEffect(() => {
    if (!user || !clientId) return;

    let isMounted = true;

    const fetchMessages = async () => {
      setIsFetching(true);
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: true });

      if (!error && data && isMounted) {
        setMessages(data);
      }
      if (isMounted) setIsFetching(false);
    };

    fetchMessages();

    const channel = supabase
      .channel(`room_${clientId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `client_id=eq.${clientId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;

          if (isMounted) {
            setMessages((prev) => {
              // Жесткая защита от дублирования записей
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          }
        }
      )
      .subscribe((status) => {
        console.log(`[Supabase Realtime] Status for room ${clientId}:`, status);
      });

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [user, clientId]);

  // Автоматический плавный скролл вниз при изменении массива сообщений
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    setIsSending(true);
    const textToSend = newMessage.trim();
    setNewMessage(""); // Очищаем инпут сразу для отзывчивости интерфейса

    // Оптимистичный апдейт: временно добавляем сообщение в UI, 
    // чтобы пользователь сразу видел его, не дожидаясь ответа сервера
    const temporaryId = crypto.randomUUID();
    const optimisticMessage: Message = {
      id: temporaryId,
      sender_id: user.id,
      client_id: clientId,
      text: textToSend,
      created_at: new Date().toISOString(),
    };
    
    setMessages((prev) => [...prev, optimisticMessage]);

    const { data, error } = await supabase
      .from("messages")
      .insert({
        sender_id: user.id,
        client_id: clientId,
        text: textToSend,
      })
      .select()
      .single();

    if (error) {
      alert("Ошибка при отправке: " + error.message);
      // Если ошибка — удаляем оптимистичное сообщение и возвращаем текст в инпут
      setMessages((prev) => prev.filter((m) => m.id !== temporaryId));
      setNewMessage(textToSend);
    } else if (data) {
      // Заменяем временное сообщение настоящим из базы (с правильным id и таймстампом)
      setMessages((prev) => prev.map((m) => (m.id === temporaryId ? data : m)));
    }
    
    setIsSending(false);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-900 border-t-emerald-500"></div>
      </div>
    );
  }

  if (!user) return null;

  const isTrainer = profile?.role === "trainer";

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-50 font-sans antialiased">
      {/* Шапка чата */}
      <header className="border-b border-zinc-900 bg-zinc-900/40 backdrop-blur-md sticky top-0 z-50 flex-none">
        <div className="mx-auto max-w-3xl px-4 h-16 flex items-center justify-between">
          <button 
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-white transition"
          >
            ← Назад
          </button>
          <span className="text-sm font-bold uppercase tracking-widest text-emerald-400">
            {isTrainer ? "Чат с клиентом" : "Чат с тренером"}
          </span>
          <div className="w-16"></div>
        </div>
      </header>

      {/* Зона сообщений */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4 mx-auto w-full max-w-3xl flex flex-col">
        {isFetching ? (
          <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
            Загрузка переписки...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
            Здесь пока нет сообщений. Напиши первым!
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === user.id;
            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                    isMe
                      ? "bg-emerald-500 text-zinc-950 rounded-br-sm"
                      : "bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-bl-sm"
                  }`}
                >
                  {msg.text}
                  <div className={`text-[10px] mt-1 opacity-60 text-right ${isMe ? "text-zinc-900" : "text-zinc-400"}`}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} className="h-1 flex-none" />
      </main>

      {/* Подвал с инпутом */}
      <footer className="border-t border-zinc-900 bg-zinc-950 p-4 flex-none pb-8 sm:pb-4">
        <form onSubmit={handleSendMessage} className="mx-auto max-w-3xl flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Написать сообщение..."
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 transition"
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || isSending}
            className="rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 px-6 py-3 text-sm font-bold text-zinc-950 transition shadow-lg shadow-emerald-500/10"
          >
            {isSending ? "..." : "▶"}
          </button>
        </form>
      </footer>
    </div>
  );
}