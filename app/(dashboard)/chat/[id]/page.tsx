'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface Message {
  id: string;
  sender_id: string;
  text: string;
  created_at: string;
}

export default function ChatRoom({ params }: { params: { id: string } }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadMessages() {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', params.id)
        .order('created_at', { ascending: true });
      if (data) setMessages(data);
    }
    loadMessages();

    const channel = supabase
      .channel(`chat-${params.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${params.id}` },
        (payload: { new: any }) => {
          if (payload.new) {
            setMessages((prev) => [...prev, payload.new as Message]);
          }
        }
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') console.log('Realtime чат подключен');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [params.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('messages').insert([
      {
        chat_id: params.id,
        sender_id: user.id,
        text: input.trim(),
      },
    ]);
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
        <button type="submit" className="bg-[#00F5D4] text-black px-4 py-2 rounded-lg text-xs font-bold uppercase">
          Отправить
        </button>
      </form>
    </div>
  );
}