// app/(dashboard)/trainer/templates/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/lib/supabase";
import { withRetry } from "@/lib/dbRetry";
import { toDraftSets, buildSetsPayload, emptyDraftSet, type DraftSetInput } from "@/lib/exerciseSets";
import SetsEditor from "@/components/workout/SetsEditor";
import toast from "react-hot-toast";
import { Plus, X, Trash2, Pencil, Send, LayoutTemplate } from "lucide-react";

interface Template {
  id: string;
  title: string;
  recommendation: string | null;
}

interface ClientOption {
  id: string;
  full_name: string | null;
}

interface DraftExercise {
  tempId: string;
  id?: string;
  name: string;
  sets: DraftSetInput[];
  trainerComment: string;
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function TrainerTemplatesPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [fetching, setFetching] = useState(true);

  // Редактор шаблона
  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tTitle, setTTitle] = useState("");
  const [tRec, setTRec] = useState("");
  const [tEx, setTEx] = useState<DraftExercise[]>([]);
  const [tOriginalIds, setTOriginalIds] = useState<string[]>([]);
  const [savingT, setSavingT] = useState(false);

  // Отправка
  const [sendTpl, setSendTpl] = useState<Template | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sendDate, setSendDate] = useState(() => ymd(new Date()));
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
      return;
    }
    if (!authLoading && profile && profile.role?.toUpperCase() !== "TRAINER") {
      router.replace("/login");
    }
  }, [authLoading, user, profile, router]);

  const loadAll = async () => {
    if (!user?.id) return;
    const [tRes, cRes] = await Promise.all([
      supabase.from("workout_templates").select("id, title, recommendation").eq("trainer_id", user.id).order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name").eq("role", "client").eq("trainer_id", user.id),
    ]);
    if (!tRes.error && tRes.data) setTemplates(tRes.data as Template[]);
    if (!cRes.error && cRes.data) setClients(cRes.data as ClientOption[]);
  };

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const [tRes, cRes] = await Promise.all([
        supabase.from("workout_templates").select("id, title, recommendation").eq("trainer_id", user.id).order("created_at", { ascending: false }),
        supabase.from("profiles").select("id, full_name").eq("role", "client").eq("trainer_id", user.id),
      ]);
      if (cancelled) return;
      if (!tRes.error && tRes.data) setTemplates(tRes.data as Template[]);
      if (!cRes.error && cRes.data) setClients(cRes.data as ClientOption[]);
      setFetching(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // ── Редактор ─────────────────────────────────────────────────
  const resetEditor = () => {
    setTTitle("");
    setTRec("");
    setTEx([]);
    setTOriginalIds([]);
    setEditingId(null);
  };
  const openCreate = () => {
    resetEditor();
    setShowEditor(true);
  };
  const openEdit = async (t: Template) => {
    try {
      const { data, error } = await supabase
        .from("template_exercises")
        .select("id, name, sets, reps, weight, sets_data, trainer_comment")
        .eq("template_id", t.id)
        .order("position", { ascending: true });
      if (error) throw error;
      const drafts: DraftExercise[] = (data ?? []).map((ex) => ({
        tempId: crypto.randomUUID(),
        id: ex.id as string,
        name: ex.name ?? "",
        sets: toDraftSets(ex),
        trainerComment: ex.trainer_comment ?? "",
      }));
      setTTitle(t.title);
      setTRec(t.recommendation ?? "");
      setTEx(drafts);
      setTOriginalIds(drafts.map((d) => d.id as string));
      setEditingId(t.id);
      setShowEditor(true);
    } catch (err) {
      console.error("Ошибка открытия шаблона:", err);
      toast.error("Не удалось открыть шаблон");
    }
  };

  const addEx = () => setTEx((p) => [...p, { tempId: crypto.randomUUID(), name: "", sets: [emptyDraftSet()], trainerComment: "" }]);
  const removeEx = (tempId: string) => setTEx((p) => p.filter((d) => d.tempId !== tempId));
  const updName = (tempId: string, v: string) => setTEx((p) => p.map((d) => (d.tempId === tempId ? { ...d, name: v } : d)));
  const updComment = (tempId: string, v: string) => setTEx((p) => p.map((d) => (d.tempId === tempId ? { ...d, trainerComment: v } : d)));
  const addSet = (tempId: string) => setTEx((p) => p.map((d) => (d.tempId === tempId ? { ...d, sets: [...d.sets, emptyDraftSet()] } : d)));
  const removeSet = (tempId: string, i: number) =>
    setTEx((p) => p.map((d) => (d.tempId === tempId && d.sets.length > 1 ? { ...d, sets: d.sets.filter((_, idx) => idx !== i) } : d)));
  const updSet = (tempId: string, i: number, field: "reps" | "weight", v: string) =>
    setTEx((p) => p.map((d) => (d.tempId === tempId ? { ...d, sets: d.sets.map((s, idx) => (idx === i ? { ...s, [field]: v } : s)) } : d)));

  const rowFor = (d: DraftExercise, templateId: string, pos: number) => ({
    template_id: templateId,
    name: d.name.trim(),
    ...buildSetsPayload(d.sets),
    trainer_comment: d.trainerComment.trim() || null,
    position: pos,
  });

  const saveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tTitle.trim()) {
      toast.error("Укажите название шаблона");
      return;
    }
    if (!user?.id) return;
    setSavingT(true);
    try {
      const filled = tEx.filter((d) => d.name.trim());
      if (editingId) {
        const { error: tErr } = await withRetry(() =>
          supabase.from("workout_templates").update({ title: tTitle.trim(), recommendation: tRec.trim() || null }).eq("id", editingId)
        );
        if (tErr) throw tErr;

        for (let i = 0; i < filled.length; i++) {
          const d = filled[i];
          if (d.id) {
            const { error } = await withRetry(() =>
              supabase.from("template_exercises").update({ name: d.name.trim(), ...buildSetsPayload(d.sets), trainer_comment: d.trainerComment.trim() || null, position: i }).eq("id", d.id as string)
            );
            if (error) throw error;
          }
        }
        const newRows = filled.filter((d) => !d.id).map((d, i) => rowFor(d, editingId, filled.length + i));
        if (newRows.length > 0) {
          const { error } = await withRetry(() => supabase.from("template_exercises").insert(newRows));
          if (error) throw error;
        }
        const keep = new Set(filled.filter((d) => d.id).map((d) => d.id as string));
        const toDelete = tOriginalIds.filter((x) => !keep.has(x));
        if (toDelete.length > 0) {
          const { error } = await withRetry(() => supabase.from("template_exercises").delete().in("id", toDelete));
          if (error) throw error;
        }
        toast.success("Шаблон обновлён");
      } else {
        const { data: tRow, error: tErr } = await withRetry(() =>
          supabase.from("workout_templates").insert({ trainer_id: user.id, title: tTitle.trim(), recommendation: tRec.trim() || null }).select("id").single()
        );
        if (tErr) throw tErr;
        const tid: string = tRow.id;
        const rows = filled.map((d, i) => rowFor(d, tid, i));
        if (rows.length > 0) {
          const { error } = await withRetry(() => supabase.from("template_exercises").insert(rows));
          if (error) throw error;
        }
        toast.success("Шаблон создан");
      }
      await loadAll();
      resetEditor();
      setShowEditor(false);
    } catch (err) {
      console.error("Ошибка сохранения шаблона:", err);
      toast.error("Не удалось сохранить шаблон");
    } finally {
      setSavingT(false);
    }
  };

  const deleteTemplate = async (id: string) => {
    const prev = templates;
    setTemplates((cur) => cur.filter((t) => t.id !== id));
    const { error } = await supabase.from("workout_templates").delete().eq("id", id);
    if (error) {
      console.error("Ошибка удаления шаблона:", error);
      toast.error("Не удалось удалить");
      setTemplates(prev);
    }
  };

  // ── Отправка шаблона клиентам ────────────────────────────────
  const openSend = (t: Template) => {
    setSendTpl(t);
    setSelected(new Set());
    setSendDate(ymd(new Date()));
  };
  const toggleClient = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const doSend = async () => {
    if (!sendTpl || !user?.id) return;
    if (selected.size === 0) {
      toast.error("Выберите хотя бы одного атлета");
      return;
    }
    setSending(true);
    try {
      // упражнения шаблона
      const { data: exData, error: exErr } = await supabase
        .from("template_exercises")
        .select("name, sets, reps, weight, sets_data, trainer_comment")
        .eq("template_id", sendTpl.id)
        .order("position", { ascending: true });
      if (exErr) throw exErr;
      const tplEx = exData ?? [];

      for (const clientId of selected) {
        const { data: wRow, error: wErr } = await withRetry(() =>
          supabase
            .from("workouts")
            .insert({
              client_id: clientId,
              creator_id: user.id,
              title: sendTpl.title,
              workout_date: sendDate,
              recommendation: sendTpl.recommendation,
            })
            .select("id")
            .single()
        );
        if (wErr) throw wErr;
        const wid: string = wRow.id;

        const rows = tplEx.map((ex) => ({
          workout_id: wid,
          name: ex.name,
          sets: ex.sets,
          reps: ex.reps,
          weight: ex.weight,
          sets_data: ex.sets_data,
          trainer_comment: ex.trainer_comment,
          client_note: null,
        }));
        if (rows.length > 0) {
          const { error } = await withRetry(() => supabase.from("exercises").insert(rows));
          if (error) throw error;
        }
      }

      toast.success(`Отправлено: ${selected.size} атлет(ам)`);
      setSendTpl(null);
    } catch (err) {
      console.error("Ошибка отправки шаблона:", err);
      toast.error("Не удалось отправить");
    } finally {
      setSending(false);
    }
  };

  const inputCls =
    "w-full bg-[#0A0A0A] border border-[#1C1C1E] rounded-lg px-3 py-2.5 text-xs text-white outline-none focus:border-[#00E676] transition-colors";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[9px] font-bold uppercase tracking-[0.25em] text-[#989AA0] flex items-center gap-1.5">
          <LayoutTemplate className="w-3.5 h-3.5 text-[#00E676]" /> Шаблоны тренировок
        </h2>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-[#00E676] text-black px-3 py-1.5 rounded-lg hover:bg-[#00c765] transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Шаблон
        </button>
      </div>

      {fetching ? (
        <div className="rounded-2xl border border-[#1C1C1E] bg-[#111214] p-6 text-center">
          <span className="text-xs text-zinc-600 animate-pulse">Загрузка...</span>
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-[#1C1C1E] rounded-2xl text-[10px] text-zinc-600 uppercase">
          Шаблонов нет. Создайте первый — и отправляйте его разным атлетам.
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <div key={t.id} className="rounded-2xl border border-[#1C1C1E] bg-[#111214] p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">{t.title}</p>
                  {t.recommendation && <p className="text-[9px] text-[#989AA0] truncate mt-0.5">{t.recommendation}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" onClick={() => openEdit(t)} aria-label="Изменить" className="h-7 w-7 flex items-center justify-center rounded-md border border-[#262626] text-[#989AA0] hover:text-white">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => deleteTemplate(t.id)} aria-label="Удалить" className="h-7 w-7 flex items-center justify-center rounded-md border border-[#262626] text-zinc-600 hover:text-rose-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => openSend(t)}
                className="w-full flex items-center justify-center gap-1 bg-[#00E676] text-black font-black py-2 rounded-lg text-[10px] uppercase tracking-widest hover:bg-[#00c765] transition-colors"
              >
                <Send className="w-3.5 h-3.5" /> Отправить атлетам
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Модалка редактора шаблона */}
      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4 overflow-y-auto">
          <div className="w-full max-w-lg my-8 rounded-2xl border border-[#262626] bg-[#111214] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest text-white">{editingId ? "Редактировать шаблон" : "Новый шаблон"}</h3>
              <button type="button" onClick={() => { setShowEditor(false); resetEditor(); }} aria-label="Закрыть">
                <X className="w-4 h-4 text-[#989AA0] hover:text-white" />
              </button>
            </div>

            <form onSubmit={saveTemplate} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[8px] font-bold uppercase tracking-[0.2em] text-[#989AA0]">Название</label>
                <input value={tTitle} onChange={(e) => setTTitle(e.target.value)} placeholder="Верх тела · сила" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[8px] font-bold uppercase tracking-[0.2em] text-[#989AA0]">Рекомендации</label>
                <textarea value={tRec} onChange={(e) => setTRec(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-[#989AA0]">Упражнения ({tEx.length})</span>
                  <button type="button" onClick={addEx} className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-[#00E676] hover:text-[#00c765]">
                    <Plus className="w-3 h-3" /> Добавить
                  </button>
                </div>

                {tEx.map((d, idx) => (
                  <div key={d.tempId} className="bg-[#0A0A0A] border border-[#1C1C1E] rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black text-zinc-500">#{idx + 1}</span>
                      <input value={d.name} onChange={(e) => updName(d.tempId, e.target.value)} placeholder="Название упражнения" className="flex-1 bg-transparent text-xs font-bold text-white outline-none" />
                      <button type="button" onClick={() => removeEx(d.tempId)} aria-label="Удалить" className="text-zinc-600 hover:text-rose-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <SetsEditor sets={d.sets} onAdd={() => addSet(d.tempId)} onRemove={(i) => removeSet(d.tempId, i)} onChange={(i, field, v) => updSet(d.tempId, i, field, v)} />
                    <input value={d.trainerComment} onChange={(e) => updComment(d.tempId, e.target.value)} placeholder="Комментарий тренера" className="w-full bg-[#111214] border border-[#1C1C1E] rounded px-2 py-1.5 text-[11px] text-white outline-none focus:border-[#00E676]" />
                  </div>
                ))}
              </div>

              <button type="submit" disabled={savingT} className="w-full bg-[#00E676] text-black font-black py-3 rounded-xl text-[10px] uppercase tracking-widest disabled:opacity-50">
                {savingT ? "Сохранение..." : editingId ? "Сохранить шаблон" : "Создать шаблон"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Модалка отправки */}
      {sendTpl && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#262626] bg-[#111214] p-5 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest text-white truncate">Отправить: {sendTpl.title}</h3>
              <button type="button" onClick={() => setSendTpl(null)} aria-label="Закрыть">
                <X className="w-4 h-4 text-[#989AA0] hover:text-white" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[8px] font-bold uppercase tracking-[0.2em] text-[#989AA0]">Дата тренировки</label>
              <input type="date" value={sendDate} onChange={(e) => setSendDate(e.target.value)} className={inputCls} />
            </div>

            <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-[#989AA0]">Кому ({selected.size})</span>
            <div className="flex-1 overflow-y-auto space-y-2">
              {clients.length === 0 ? (
                <div className="text-center py-6 text-[10px] text-zinc-600 uppercase">Нет привязанных атлетов</div>
              ) : (
                clients.map((c) => {
                  const on = selected.has(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleClient(c.id)}
                      className={`w-full flex items-center justify-between rounded-xl border p-3 text-left transition-colors ${
                        on ? "border-[#00E676] bg-[#0E2A1C]/40" : "border-[#1C1C1E] bg-[#0A0A0A] hover:border-zinc-700"
                      }`}
                    >
                      <span className="text-xs font-bold text-white truncate">{c.full_name || "Атлет без имени"}</span>
                      <span className={`h-4 w-4 shrink-0 rounded border ${on ? "bg-[#00E676] border-[#00E676]" : "border-[#262626]"}`} />
                    </button>
                  );
                })
              )}
            </div>

            <button type="button" onClick={doSend} disabled={sending} className="w-full bg-[#00E676] text-black font-black py-3 rounded-xl text-[10px] uppercase tracking-widest disabled:opacity-50">
              {sending ? "Отправка..." : `Отправить (${selected.size})`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
