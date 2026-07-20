'use client';

import { useState, useEffect, useRef, use } from 'react';
import type {
  RealtimePostgresInsertPayload,
} from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

interface Message {
  id: string;
  sender_id: string;
  text: string;
  created_at: string;
}

// Next.js 16: params — это Promise, разворачиваем через use().
export default function ChatRoom({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false; // guard от setState после размонтирования / смены id

    async function loadMessages() {
      const { data, error } = await supabase
        .from('messages')
        .select('id, sender_id, text, created_at')
        .eq('chat_id', id)
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
      .channel(`chat-${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${id}` },
        (payload: RealtimePostgresInsertPayload<Message>) => {
          const row = payload.new;
          if (cancelled || !row) return;
          // Дедуп: realtime может продублировать строку, которую уже вернул initial select.
          setMessages((prev) =>
            prev.some((m) => m.id === row.id) ? prev : [...prev, row]
          );
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') console.log('Realtime чат подключен');
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Сессия истекла, войдите заново');
      return;
    }

    setSending(true);
    const { error } = await supabase.from('messages').insert([
      {
        chat_id: id,
        sender_id: user.id,
        text,
      },
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
    <div className="w-full max-w-2xl mx-auto bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 text-white h-[500px] flex flex-col justify-between font-mono">
      <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2">
        {messages.map((msg) => (
          <div key={msg.id} className="p-3 bg-[#0A0A0A] border border-[#262626] rounded-lg">
            <p className="text-xs">{msg.text}</p>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
      <form onSubmit={sendMessage} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Напишите сообщение..."
          className="flex-1 bg-[#0A0A0A] border border-[#262626] rounded-lg p-2 text-xs text-white focus:border-[#00F5D4] focus:outline-none"
        />
        <button
          type="submit"
          disabled={sending}
          className="bg-[#00F5D4] text-black px-4 py-2 rounded-lg text-xs font-bold uppercase disabled:opacity-50"
        >
          Отправить
        </button>
      </form>
    </div>
  );
}
