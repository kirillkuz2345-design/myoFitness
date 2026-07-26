'use client';

import { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import type { RealtimePostgresInsertPayload } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import toast from 'react-hot-toast';
import { ArrowLeft, Send } from 'lucide-react';

interface Message {
  id: string;
  sender_id: string;
  client_id: string;
  text: string;
  created_at: string;
}

// Next.js 16: params — Promise, разворачиваем через use().
// id маршрута = client_id (переписка тренер↔атлет ключуется id атлета).
export default function ChatRoom({ params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = use(params);
  const router = useRouter();
  const { user } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false; // guard от setState после размонтирования / смены id

    async function loadMessages() {
      const { data, error } = await supabase
        .from('messages')
        .select('id, sender_id, client_id, text, created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: true });

      if (cancelled) return;
      if (error) {
        console.error('[chat] Ошибка загрузки истории:', error);
        return;
      }
      if (data) setMessages(data);
    }
    loadMessages();

    const channel = supabase
      .channel(`chat-${clientId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `client_id=eq.${clientId}` },
        (payload: RealtimePostgresInsertPayload<Message>) => {
          const row = payload.new;
          if (cancelled || !row) return;
          // Дедуп: realtime может продублировать строку из initial select.
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [clientId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    if (!user?.id) {
      toast.error('Сессия истекла, войдите заново');
      return;
    }

    setSending(true);
    const { error } = await supabase.from('messages').insert([
      { client_id: clientId, sender_id: user.id, text },
    ]);
    setSending(false);

    if (error) {
      console.error('[chat] Ошибка отправки:', error);
      toast.error('Не удалось отправить сообщение');
      return;
    }
    setInput('');
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#E1E3E6] font-mono antialiased flex flex-col">
      {/* Шапка */}
      <header
        className="sticky top-0 z-40 border-b border-[#1C1C1E] bg-[#0A0A0A]/90 backdrop-blur-md"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto max-w-2xl px-4 h-16 flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Назад"
            className="text-[#989AA0] hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-xs font-black uppercase tracking-widest text-white">Чат</h1>
        </div>
      </header>

      {/* Лента */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 py-4 space-y-2">
          {messages.length === 0 ? (
            <p className="text-center text-[10px] text-zinc-600 uppercase tracking-widest py-10">
              Сообщений пока нет
            </p>
          ) : (
            messages.map((msg) => {
              const mine = msg.sender_id === user?.id;
              return (
                <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs ${
                      mine
                        ? 'bg-[#00E676] text-black rounded-br-sm'
                        : 'bg-[#111214] border border-[#1C1C1E] text-white rounded-bl-sm'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              );
            })
          )}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Ввод */}
      <div
        className="sticky bottom-0 border-t border-[#1C1C1E] bg-[#0A0A0A]/95 backdrop-blur-md"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <form onSubmit={sendMessage} className="mx-auto max-w-2xl px-4 py-3 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Напишите сообщение..."
            className="flex-1 bg-[#111214] border border-[#1C1C1E] rounded-lg px-3 py-2.5 text-xs text-white outline-none focus:border-[#00E676]"
          />
          <button
            type="submit"
            disabled={sending}
            className="bg-[#00E676] text-black px-4 rounded-lg text-xs font-black uppercase disabled:opacity-50 flex items-center gap-1"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
