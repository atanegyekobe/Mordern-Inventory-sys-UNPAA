import type { Metadata } from "next";
import { Playfair_Display, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { NotificationProvider } from "@/lib/notification-context";
import { NotificationProvider as AlertProvider } from "@/lib/notification-alert-context";
import { Toast } from "@/components/Toast";
import SupportButton from "@/components/SupportButton";

const display = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const body = Space_Grotesk({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Atelier Commerce",
  description: "A premium online shop experience with a modern admin suite.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${display.variable} ${body.variable} antialiased`} suppressHydrationWarning>
        <AuthProvider>
          <NotificationProvider>
            <AlertProvider>
              {children}
              <Toast />
              <SupportButton />
            </AlertProvider>
          </NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
