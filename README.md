# NAORE Fitness

Премиум фитнес-приложение для тренеров и атлетов: конструктор тренировок, аналитика, чат тренер↔клиент. Next.js (App Router) + Supabase, работает как PWA.

## Стек

- **Next.js 16** (App Router) + **TypeScript**
- **TailwindCSS** — оформление, тёмная тема
- **Supabase** через `@supabase/ssr` — аутентификация и данные
- **Vercel** — хостинг

## Environment

Приложению нужны две публичные переменные окружения:

| Переменная | Назначение | Где взять |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL проекта Supabase | Supabase Dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Публичный anon/publishable ключ | Supabase Dashboard → Project Settings → API |

Шаблон — в [`.env.example`](./.env.example).

> **Про ключи.** На фронтенде используется только **anon / publishable** ключ — он безопасен для клиента, доступ к данным ограничен политиками **Row Level Security** на стороне Supabase. Ключ **`service_role` в проекте не используется** и никогда не должен попадать в клиентский код или в `NEXT_PUBLIC_*`.

## Локальный запуск

```bash
cp .env.example .env.local   # затем впишите свои значения
npm install
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000).

## Auth-модель (кратко)

- Сессия создаётся через `@supabase/ssr` (`createBrowserClient`), хранится в cookie `sb-*`.
- `proxy.ts` защищает роуты `/client`, `/trainer`, `/settings`: при отсутствии сессионной cookie редиректит на `/login` (без сетевых вызовов — восстановление/рефреш сессии на клиенте).
- Доступ к данным ограничен политиками **RLS** в Supabase (`auth.uid()`), а не только проверкой на фронте.

## Деплой

Продакшн разворачивается на [Vercel](https://vercel.com). Те же env-переменные задаются в настройках проекта Vercel (Project Settings → Environment Variables).
