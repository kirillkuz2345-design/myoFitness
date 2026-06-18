"use client";

import React, { useState, useMemo } from "react";
import { Send, Pin, CalendarDays, ArrowUpRight, Sparkles } from "lucide-react";
import { ChatMessage, WorkoutBlock, WorkoutRoutine } from "@/db/types";

const MUSCLE_ALTERNATIVES: Record<string, string[]> = {
  грудь: ["Жим гантелей на наклонной", "Отжимания на брусьях", "Сведение в кроссовере"],
  chest: ["Incline dumbbell press", "Dips", "Cable fly"],
  спина: ["Тяга верхнего блока", "Тяга гантели в наклоне", "Подтягивания нейтральным хватом"],
  back: ["Lat pulldown", "Single-arm row", "Neutral pull-ups"],
  ноги: ["Гакк-присед", "Болгарские выпады", "Жим ногами узкой постановкой"],
  legs: ["Hack squat", "Bulgarian split squat", "Narrow leg press"],
  плечи: ["Жим Арнольда", "Махи в стороны с паузой", "Face pull"],
  shoulders: ["Arnold press", "Lateral raise pause", "Face pull"],
  бицепс: ["Молотковые сгибания", "Концентрированные сгибания", "Тяга EZ-грифа супинированным хватом"],
  трицепс: ["Разгибания на блоке", "Жим узким хватом", "Французский жим"],
};

const EXERCISE_ALTERNATIVES: Record<string, string[]> = {
  "жим лежа": ["Жим гантелей", "Жим в Смите", "Отжимания на брусьях"],
  "присед": ["Гакк-присед", "Жим ногами", "Болгарские выпады"],
  "становая": ["Румынская тяга", "Тяга сумо", "Гиперэкстензия"],
  "подтягивания": ["Тяга верхнего блока", "Тяга гантели", "Пуловер"],
};

interface ExerciseLine {
  name: string;
  summary: string;
}

function formatBlockLine(block: WorkoutBlock): ExerciseLine {
  const name = block.name?.trim() || "Упражнение";
  const ex = block.exercises?.[0];

  if (!ex) {
    return { name, summary: name };
  }

  const setCount = ex.sets ?? ex.setNumber ?? block.exercises?.length ?? 1;
  const reps = ex.reps ?? "?";
  const weight = ex.weight_kg ?? ex.weight;
  const weightPart =
    weight !== null && weight !== undefined && weight !== 0
      ? ` @ ${weight}кг`
      : "";

  return {
    name,
    summary: `${name}: ${setCount}×${reps}${weightPart}`,
  };
}

function extractExerciseLines(
  routine: WorkoutRoutine | null | undefined
): ExerciseLine[] {
  if (!routine?.blocks?.length) return [];
  return routine.blocks.map(formatBlockLine);
}

function wantsAlternative(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("замен") ||
    lower.includes("альтернатив") ||
    lower.includes("забит") ||
    lower.includes("болит") ||
    lower.includes("не могу")
  );
}

function findContextualReply(
  text: string,
  exercises: ExerciseLine[]
): string | null {
  const lower = text.toLowerCase();

  const mentionedExercise = exercises.find((ex) =>
    lower.includes(ex.name.toLowerCase())
  );

  if (mentionedExercise && wantsAlternative(lower)) {
    const key = Object.keys(EXERCISE_ALTERNATIVES).find((k) =>
      mentionedExercise.name.toLowerCase().includes(k)
    );
    const alts = key
      ? EXERCISE_ALTERNATIVES[key]
      : MUSCLE_ALTERNATIVES["грудь"];
    return `В плане сейчас «${mentionedExercise.summary}». Если нужна замена — попробуй: ${(alts ?? []).join(", ")}.`;
  }

  const muscleKey = Object.keys(MUSCLE_ALTERNATIVES).find((m) =>
    lower.includes(m)
  );
  if (!muscleKey || !wantsAlternative(lower)) return null;

  const alts = MUSCLE_ALTERNATIVES[muscleKey];
  const inPlan = exercises.find(
    (ex) =>
      ex.name.toLowerCase().includes(muscleKey) ||
      lower.includes(ex.name.toLowerCase())
  );

  if (inPlan) {
    return `Вижу «${inPlan.summary}» в активном плане. Для разгрузки ${muscleKey}: ${alts.join(", ")}.`;
  }

  return `Для ${muscleKey} можно заменить упражнение на: ${alts.join(", ")}.`;
}

interface ContextChatEngineProps {
  currentUserRole: "trainer" | "athlete";
  activeRoutineContext?: WorkoutRoutine | null;
  onNavigateToWorkout: (dateStr: string) => void;
}

export default function ContextChatEngine({
  currentUserRole,
  activeRoutineContext,
  onNavigateToWorkout,
}: ContextChatEngineProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: "1",
      sender: "trainer",
      text: "Привет! Спроектировал тебе тяжелый блок. Постарайся зафиксировать вес чисто.",
      timestamp: Date.now() - 3600000,
    },
    {
      id: "2",
      sender: "athlete",
      text: "Привет, принял. В оффлайне все запишется, если что.",
      timestamp: Date.now() - 1800000,
    },
  ]);

  const [inputText, setInputText] = useState("");
  const [attachAnchor, setAttachAnchor] = useState(false);

  const exerciseLines = useMemo(
    () => extractExerciseLines(activeRoutineContext),
    [activeRoutineContext]
  );

  const contextHint = useMemo(() => {
    if (!activeRoutineContext?.date) return null;

    if (exerciseLines.length === 0) {
      return `День ${activeRoutineContext.date}: план пуст. Спроси про альтернативу, если мышца забита.`;
    }

    const title = activeRoutineContext.title || "Тренировка";
    const detail = exerciseLines.map((ex) => ex.summary).join(" · ");
    return `${title} (${activeRoutineContext.date}) — ${detail}`;
  }, [activeRoutineContext, exerciseLines]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !attachAnchor) return;

    const userText = inputText.trim();
    const newMessage: ChatMessage = {
      id: crypto.randomUUID(),
      sender: currentUserRole,
      text: userText,
      timestamp: Date.now(),
      anchorWorkout:
        attachAnchor && activeRoutineContext?.date
          ? {
              id: activeRoutineContext.id || crypto.randomUUID(),
              title: activeRoutineContext.title || "Без названия",
              date: activeRoutineContext.date,
            }
          : undefined,
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputText("");
    setAttachAnchor(false);

    const reply = findContextualReply(userText, exerciseLines);
    if (reply) {
      window.setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            sender: "trainer",
            text: reply,
            timestamp: Date.now(),
          },
        ]);
      }, 400);
    } else if (
      wantsAlternative(userText) &&
      exerciseLines.length > 0 &&
      activeRoutineContext
    ) {
      window.setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            sender: "trainer",
            text: `В активном плане: ${exerciseLines.map((e) => e.summary).join("; ")}. Уточни упражнение или группу мышц для замены.`,
            timestamp: Date.now(),
          },
        ]);
      }, 400);
    }
  };

  return (
    <div className="w-full h-[480px] bg-[#0A0A0A] border border-zinc-900 rounded-2xl flex flex-col overflow-hidden text-white shadow-xl">
      <div className="bg-[#000000] border-b border-zinc-900 p-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-[#0D5C4D] shadow-[0_0_8px_rgba(13,92,77,0.6)]" />
          <span className="text-xs font-bold uppercase tracking-wider">
            Рабочий контекст-чат
          </span>
        </div>
        {activeRoutineContext && (
          <button
            type="button"
            onClick={() => setAttachAnchor(!attachAnchor)}
            className="cursor-pointer px-2.5 py-1 rounded-lg border text-[9px] font-mono font-bold uppercase flex items-center space-x-1.5 transition-all data-[active=true]:bg-[#0D5C4D]/20 data-[active=true]:border-[#0D5C4D]/20 data-[active=true]:text-emerald-400 data-[active=false]:bg-[#000000] data-[active=false]:border-zinc-800 data-[active=false]:text-zinc-500"
            data-active={attachAnchor}
          >
            <Pin className="h-3 w-3" />
            <span>Закрепить день</span>
          </button>
        )}
      </div>

      {contextHint && (
        <div className="px-4 py-2 bg-[#0D5C4D]/10 border-b border-zinc-900 flex items-start gap-2">
          <Sparkles className="h-3 w-3 text-emerald-400 mt-0.5 shrink-0" />
          <p className="text-[9px] font-mono text-zinc-400 leading-relaxed">
            {contextHint}
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isMe = msg.sender === currentUserRole;
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl p-3 text-xs leading-relaxed ${
                  msg.sender === "trainer"
                    ? "bg-[#0D5C4D] text-white rounded-tr-none"
                    : "bg-zinc-900 text-zinc-200 rounded-tl-none"
                }`}
              >
                <p>{msg.text}</p>
                {msg.anchorWorkout && (
                  <div
                    onClick={() => onNavigateToWorkout(msg.anchorWorkout!.date)}
                    className="cursor-pointer bg-[#000000]/50 border border-zinc-900 rounded-xl p-2.5 flex items-center justify-between transition-all group mt-2"
                  >
                    <div className="flex items-center space-x-2 overflow-hidden mr-2">
                      <CalendarDays className="h-3.5 w-3.5 text-[#0D5C4D] shrink-0" />
                      <div className="truncate font-sans text-[10px]">
                        <p className="font-bold text-white truncate">
                          {msg.anchorWorkout.title}
                        </p>
                        <p className="text-[9px] text-zinc-500 font-mono">
                          {msg.anchorWorkout.date}
                        </p>
                      </div>
                    </div>
                    <ArrowUpRight className="h-3.5 w-3.5 text-zinc-500 group-hover:text-emerald-400 transition-all shrink-0" />
                  </div>
                )}
              </div>
              <span className="text-[8px] font-mono text-zinc-600 mt-1 px-1">
                {new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          );
        })}
      </div>

      <form
        onSubmit={handleSendMessage}
        className="p-3 bg-[#000000] border-t border-zinc-900 space-y-2"
      >
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Спроси про альтернативу, если мышца забита..."
            className="w-full bg-[#0A0A0A] border border-zinc-900 rounded-xl p-2.5 text-xs text-white placeholder-zinc-800 focus:outline-none"
          />
          <button
            type="submit"
            className="cursor-pointer bg-[#0D5C4D] hover:bg-[#004B49] text-white p-2.5 rounded-xl transition-all"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
}
