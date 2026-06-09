import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/providers/AuthProvider";
import Link from "next/link";
import { User } from "lucide-react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MyoFitness | Платформа для тренеров",
  description: "Оперативный контроль активности и результатов клиентов",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={inter.className}>
        <AuthProvider>
          {children}

          {/* Фиксированная премиальная кнопка Личного Кабинета */}
          <Link
            href="/settings"
            className="fixed bottom-6 right-6 z-50 p-3 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-emerald-400 hover:border-emerald-500/50 rounded-xl shadow-lg transition-all duration-200 flex items-center justify-center hover:scale-105 active:scale-95 group backdrop-blur-md"
            title="Личные настройки"
          >
            <User size={22} className="group-hover:animate-pulse" />
          </Link>

          <Toaster 
            position="top-center"
            toastOptions={{
              style: {
                background: '#18181b', // bg-zinc-900
                color: '#fff',
                border: '1px solid #27272a', // border-zinc-800
                fontSize: '14px',
                borderRadius: '12px',
              },
              success: {
                iconTheme: {
                  primary: '#10b981', // emerald-500
                  secondary: '#09090b', // zinc-950
                },
              },
            }} 
          />
        </AuthProvider>
      </body>
    </html>
  );
}