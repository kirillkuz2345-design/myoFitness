// app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/providers/AuthProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NAORE Fitness",
  description: "Оперативный контроль активности и результатов",
  manifest: "/manifest.webmanifest",
  applicationName: "NAORE",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "NAORE",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover", // контент уходит под чёлку/скругления
  themeColor: "#00E676", // цвет статус-бара в standalone
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
