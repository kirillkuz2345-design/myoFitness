// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/providers/AuthProvider";
import SettingsFab from "@/components/ui/layout/SettingsFab"; // Гейтит кнопку настроек по авторизации

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

          {/* Кнопка настроек показывается только авторизованным (см. SettingsFab) */}
          <SettingsFab />

          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                background: '#18181b',
                color: '#fff',
                border: '1px solid #27272a',
                fontSize: '14px',
                borderRadius: '12px',
              },
              success: {
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#09090b',
                },
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
