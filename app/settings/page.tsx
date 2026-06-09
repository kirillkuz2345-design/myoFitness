"use client";

import { useCallback, useEffect, useState, type ReactNode, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  User,
  Users,
  Save,
  CloudOff,
  Cloud,
  Loader2,
  Ruler,
  Scale,
  ImageIcon,
  StickyNote,
  ChevronDown,
} from "lucide-react";
import { useAuth, type Profile } from "@/providers/AuthProvider";
import type { Gender, LocalProfile } from "@/db/types";
import { profileService } from "@/services/profile.service";
import { syncService } from "@/services/sync.service";

type SettingsTab = "profile" | "clients";

interface ProfileFormState {
  full_name: string;
  avatar_url: string;
  gender: Gender | "";
  height_cm: string;
  weight_kg: string;
}

interface ClientNoteState {
  clientId: string;
  clientName: string;
  notes: string;
  expanded: boolean;
  saving: boolean;
}

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "male", label: "Мужской" },
  { value: "female", label: "Женский" },
  { value: "other", label: "Другое" },
];

function emptyForm(): ProfileFormState {
  return {
    full_name: "",
    avatar_url: "",
    gender: "",
    height_cm: "",
    weight_kg: "",
  };
}

function profileToForm(p: LocalProfile | Profile | null): ProfileFormState {
  if (!p) return emptyForm();
  return {
    full_name: p.full_name ?? "",
    avatar_url: p.avatar_url ?? "",
    gender: p.gender ?? "",
    height_cm: p.height_cm != null ? String(p.height_cm) : "",
    weight_kg: p.weight_kg != null ? String(p.weight_kg) : "",
  };
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function triggerSync(): Promise<void> {
  if (!navigator.onLine) {
    toast.success("Сохранено локально. Синхронизация при появлении сети.");
    return;
  }
  await syncService.startSyncLoop();
}

export default function SettingsPage() {
  const { user, profile, loading, dbUnavailable, refreshProfile } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [form, setForm] = useState<ProfileFormState>(emptyForm());
  const [localProfile, setLocalProfile] = useState<LocalProfile | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [clients, setClients] = useState<LocalProfile[]>([]);
  const [clientNotes, setClientNotes] = useState<ClientNoteState[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(false);

  const isTrainer = profile?.role === "trainer";
  const isClient = profile?.role === "client";

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  const loadSettingsData = useCallback(async () => {
    if (!user?.id || !profile) {
      setIsLoadingData(false);
      return;
    }

    setIsLoadingData(true);
    setLoadError(null);

    try {
      let local: LocalProfile | null = null;

      try {
        local = (await profileService.getLocalProfile(user.id)) ?? null;
      } catch (dbErr) {
        console.error("[Settings] Dexie read failed:", dbErr);
      }

      if (!local && navigator.onLine) {
        local = await profileService.hydrateProfileIfOnline(user.id);
      }

      if (!local) {
        local = {
          id: user.id,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          role: profile.role,
          trainer_id: profile.trainer_id,
          gender: profile.gender ?? null,
          height_cm: profile.height_cm ?? null,
          weight_kg: profile.weight_kg ?? null,
          sync_status: "synced",
          updated_at: Date.now(),
        };
        try {
          local = await profileService.cacheProfileLocally(local);
        } catch (cacheErr) {
          console.warn("[Settings] Using in-memory profile only:", cacheErr);
        }
      }

      setLocalProfile(local);
      setForm(profileToForm(local));

      if (profile.role === "trainer") {
        setIsLoadingClients(true);
        let trainerClients = await profileService.getTrainerClients(user.id);

        if (trainerClients.length === 0) {
          trainerClients = await profileService.hydrateTrainerClientsIfOnline(
            user.id
          );
        }

        setClients(trainerClients);

        if (trainerClients.length > 0 && navigator.onLine) {
          await profileService.hydrateTrainerNotesIfOnline(
            user.id,
            trainerClients.map((c) => c.id)
          );
        }

        const notesState: ClientNoteState[] = await Promise.all(
          trainerClients.map(async (client) => {
            const note = await profileService.getTrainerClientNote(
              user.id,
              client.id
            );
            return {
              clientId: client.id,
              clientName: client.full_name ?? "Клиент без имени",
              notes: note?.notes ?? "",
              expanded: false,
              saving: false,
            };
          })
        );

        setClientNotes(notesState);
        setIsLoadingClients(false);
      }
    } catch (err) {
      console.error("[Settings] load error:", err);
      const message =
        err instanceof Error ? err.message : "Не удалось загрузить настройки";
      setLoadError(message);
      setForm(profileToForm(profile));
      toast.error("Не удалось загрузить настройки");
    } finally {
      setIsLoadingData(false);
    }
  }, [user?.id, profile]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setIsLoadingData(false);
      return;
    }
    if (!profile) {
      setIsLoadingData(false);
      return;
    }
    loadSettingsData();
  }, [loading, user?.id, profile?.id, loadSettingsData]);

  const handleSaveProfile = async () => {
    if (!user?.id || !profile) return;

    const height = parseOptionalNumber(form.height_cm);
    const weight = parseOptionalNumber(form.weight_kg);

    if (form.height_cm.trim() && height === null) {
      toast.error("Укажите корректный рост (см)");
      return;
    }
    if (form.weight_kg.trim() && weight === null) {
      toast.error("Укажите корректный вес (кг)");
      return;
    }

    setIsSavingProfile(true);
    try {
      const updated: LocalProfile = {
        id: user.id,
        full_name: form.full_name.trim() || null,
        avatar_url: form.avatar_url.trim() || null,
        role: profile.role,
        trainer_id: profile.trainer_id,
        gender: form.gender || null,
        height_cm: height,
        weight_kg: weight,
        sync_status: "pending",
        updated_at: Date.now(),
      };

      await profileService.saveProfile(updated);
      setLocalProfile(updated);
      await refreshProfile();
      await triggerSync();
      toast.success("Профиль сохранён");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Ошибка сохранения";
      toast.error(message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveClientNote = async (clientId: string) => {
    if (!user?.id || !isTrainer) return;

    const idx = clientNotes.findIndex((n) => n.clientId === clientId);
    if (idx < 0) return;

    const assigned = clients.some(
      (c) => c.id === clientId && c.trainer_id === user.id
    );
    if (!assigned) {
      toast.error("Нет доступа к заметкам этого клиента");
      return;
    }

    setClientNotes((prev) =>
      prev.map((n) =>
        n.clientId === clientId ? { ...n, saving: true } : n
      )
    );

    try {
      await profileService.saveTrainerClientNote(
        user.id,
        clientId,
        clientNotes[idx].notes
      );
      await triggerSync();
      toast.success("Заметка сохранена");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Ошибка сохранения";
      toast.error(message);
    } finally {
      setClientNotes((prev) =>
        prev.map((n) =>
          n.clientId === clientId ? { ...n, saving: false } : n
        )
      );
    }
  };

  const toggleNoteExpanded = (clientId: string) => {
    setClientNotes((prev) =>
      prev.map((n) =>
        n.clientId === clientId ? { ...n, expanded: !n.expanded } : n
      )
    );
  };

  const updateNoteText = (clientId: string, notes: string) => {
    setClientNotes((prev) =>
      prev.map((n) => (n.clientId === clientId ? { ...n, notes } : n))
    );
  };

  if (loading || isLoadingData) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        <p className="text-xs text-zinc-500 tracking-widest uppercase font-mono">
          Загрузка настроек…
        </p>
      </div>
    );
  }

  if (!user) return null;

  if (!profile) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6 text-center gap-4">
        <p className="text-zinc-400 text-sm">Профиль не найден</p>
        <button
          type="button"
          onClick={() => router.push("/login")}
          className="text-sm font-medium text-emerald-400 hover:text-emerald-300 transition"
        >
          Войти снова
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans antialiased pb-28">
      <header className="border-b border-zinc-900 bg-zinc-950/90 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto max-w-2xl px-4 h-16 flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Назад
          </button>
          <h1 className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-200">
            Личные настройки
          </h1>
          <NetworkBadge />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 space-y-8">
        {(dbUnavailable || loadError) && (
          <div
            role="alert"
            className="rounded-2xl border border-emerald-500/10 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-400/90"
          >
            {dbUnavailable && (
              <p>
                Локальная база недоступна — данные загружены из сети. Сохранение
                попробует записать офлайн-копию снова.
              </p>
            )}
            {loadError && (
              <p className={dbUnavailable ? "mt-2 text-emerald-400/70" : ""}>
                {loadError}
              </p>
            )}
          </div>
        )}

        {isTrainer && (
          <nav
            className="flex rounded-2xl border border-zinc-900 bg-zinc-900/20 p-1"
            aria-label="Разделы настроек"
          >
            <TabButton
              active={activeTab === "profile"}
              onClick={() => setActiveTab("profile")}
              icon={<User className="w-4 h-4" />}
              label="Профиль"
            />
            <TabButton
              active={activeTab === "clients"}
              onClick={() => setActiveTab("clients")}
              icon={<Users className="w-4 h-4" />}
              label="Заметки о клиентах"
            />
          </nav>
        )}

        <AnimatePresence mode="wait">
          {activeTab === "profile" && (
            <motion.section
              key="profile"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              <div className="rounded-3xl border border-zinc-900 bg-gradient-to-b from-zinc-900/40 to-zinc-950 p-6 shadow-[0_8px_40px_rgba(0,0,0,0.35)]">
                <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-6 font-semibold">
                  {isClient ? "Профиль клиента" : "Профиль тренера"}
                </p>

                <div className="flex flex-col sm:flex-row gap-6 items-start mb-8">
                  <AvatarPreview url={form.avatar_url} name={form.full_name} />
                  <div className="flex-1 w-full space-y-4">
                    <FormField label="Полное имя" id="full_name">
                      <input
                        id="full_name"
                        type="text"
                        value={form.full_name}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, full_name: e.target.value }))
                        }
                        className={inputClass}
                        placeholder="Иван Иванов"
                        autoComplete="name"
                      />
                    </FormField>

                    <FormField
                      label="Фото (URL)"
                      id="avatar_url"
                      hint="Загрузка файла — в следующей версии. Вставьте ссылку на изображение."
                    >
                      <div className="relative">
                        <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <input
                          id="avatar_url"
                          type="url"
                          value={form.avatar_url}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              avatar_url: e.target.value,
                            }))
                          }
                          className={`${inputClass} pl-10`}
                          placeholder="https://..."
                        />
                      </div>
                    </FormField>
                  </div>
                </div>

                {isClient && (
                  <FormField label="Пол" id="gender">
                    <select
                      id="gender"
                      value={form.gender}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          gender: e.target.value as Gender | "",
                        }))
                      }
                      className={inputClass}
                    >
                      <option value="">Не указано</option>
                      {GENDER_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </FormField>
                )}

                <div className="grid sm:grid-cols-2 gap-4 mt-4">
                  <FormField label="Рост (см)" id="height_cm">
                    <div className="relative">
                      <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input
                        id="height_cm"
                        type="number"
                        min={1}
                        max={300}
                        value={form.height_cm}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, height_cm: e.target.value }))
                        }
                        className={`${inputClass} pl-10`}
                        placeholder="175"
                      />
                    </div>
                  </FormField>

                  <FormField label="Вес (кг)" id="weight_kg">
                    <div className="relative">
                      <Scale className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input
                        id="weight_kg"
                        type="number"
                        min={1}
                        max={500}
                        step="0.1"
                        value={form.weight_kg}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, weight_kg: e.target.value }))
                        }
                        className={`${inputClass} pl-10`}
                        placeholder="72"
                      />
                    </div>
                  </FormField>
                </div>

                {localProfile?.sync_status === "pending" && (
                  <p className="mt-4 text-xs text-emerald-400/70 flex items-center gap-2 font-medium">
                    <Cloud className="w-3.5 h-3.5" />
                    Ожидает синхронизации с сервером
                  </p>
                )}
              </div>

              {/* ОБНОВЛЕННАЯ ИЗУМРУДНАЯ КНОПКА СОХРАНЕНИЯ ПРОФИЛЯ */}
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={isSavingProfile}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 text-zinc-950 font-bold py-4 hover:bg-emerald-400 disabled:opacity-50 transition shadow-lg shadow-emerald-950/20"
              >
                {isSavingProfile ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                {isSavingProfile ? "Сохранение…" : "Сохранить профиль"}
              </button>
            </motion.section>
          )}

          {activeTab === "clients" && isTrainer && (
            <motion.section
              key="clients"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              <p className="text-sm text-zinc-400 leading-relaxed px-1">
                Персональные заметки видны только вам. Укажите медицинские
                ограничения, предпочтения и другие детали по каждому клиенту.
              </p>

              {isLoadingClients ? (
                <div className="py-16 flex justify-center">
                  <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
                </div>
              ) : clients.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-800 p-10 text-center text-zinc-500 text-sm">
                  Нет привязанных клиентов. Пригласите клиента по ссылке с
                  главной страницы.
                </div>
              ) : (
                <ul className="space-y-3">
                  {clientNotes.map((item) => (
                    <li
                      key={item.clientId}
                      className="rounded-2xl border border-zinc-900 bg-zinc-900/10 overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => toggleNoteExpanded(item.clientId)}
                        className="w-full flex items-center justify-between px-4 py-4 text-left hover:bg-zinc-900/30 transition"
                        aria-expanded={item.expanded}
                      >
                        <span className="font-medium text-zinc-100">
                          {item.clientName}
                        </span>
                        <ChevronDown
                          className={`w-5 h-5 text-zinc-500 transition-transform ${
                            item.expanded ? "rotate-180" : ""
                          }`}
                        />
                      </button>

                      <AnimatePresence>
                        {item.expanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="px-4 pb-4 space-y-3 border-t border-zinc-900/50"
                          >
                            <label
                              htmlFor={`note-${item.clientId}`}
                              className="sr-only"
                            >
                              Заметка о {item.clientName}
                            </label>
                            <textarea
                              id={`note-${item.clientId}`}
                              value={item.notes}
                              onChange={(e) =>
                                updateNoteText(item.clientId, e.target.value)
                              }
                              rows={5}
                              placeholder="Необязательно: аллергии, травмы, предпочтения по нагрузке…"
                              className={`${inputClass} resize-y min-h-[120px]`}
                            />
                            
                            {/* ОБНОВЛЕННАЯ ИЗУМРУДНАЯ КНОПКА ДЛЯ ЗАМЕТОК ТРЕНЕРА */}
                            <button
                              type="button"
                              onClick={() => handleSaveClientNote(item.clientId)}
                              disabled={item.saving}
                              className="flex items-center gap-2 text-sm font-semibold text-emerald-400 hover:text-emerald-300 disabled:opacity-50 transition"
                            >
                              {item.saving ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <StickyNote className="w-4 h-4" />
                              )}
                              Сохранить заметку
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </li>
                  ))}
                </ul>
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

const inputClass =
  "w-full bg-zinc-950 border border-zinc-900 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-700 focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all duration-200";

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition ${
        active
          ? "bg-zinc-900 text-emerald-400 shadow-sm border border-zinc-800/60"
          : "text-zinc-500 hover:text-zinc-300"
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function FormField({
  label,
  id,
  hint,
  children,
}: {
  label: string;
  id: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="block text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500"
      >
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-zinc-600 font-normal leading-relaxed">{hint}</p>}
    </div>
  );
}

function AvatarPreview({ url, name }: { url: string; name: string }) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  return (
    <div className="w-24 h-24 rounded-full border-2 border-zinc-800 bg-zinc-900 flex items-center justify-center overflow-hidden shrink-0 shadow-lg">
      {url.trim() ? (
        // eslint-next-line @next/next/no-img-element
        <img
          src={url.trim()}
          alt=""
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <span className="text-2xl font-light text-zinc-400 tracking-widest">
          {initials}
        </span>
      )}
    </div>
  );
}

function NetworkBadge() {
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return (
    <span
      className={`flex items-center gap-1 text-[10px] uppercase tracking-wider ${
        online ? "text-zinc-600" : "text-emerald-400 font-medium"
      }`}
      title={online ? "В сети" : "Офлайн"}
    >
      {online ? (
        <Cloud className="w-3.5 h-3.5" />
      ) : (
        <CloudOff className="w-3.5 h-3.5" />
      )}
    </span>
  );
}