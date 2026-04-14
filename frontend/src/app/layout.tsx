import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { NotificationProvider } from "@/lib/notification-context";
import { NotificationProvider as AlertProvider } from "@/lib/notification-alert-context";
import { Toast } from "@/components/Toast";
import SupportButton from "@/components/SupportButton";

export const metadata: Metadata = {
  title: "UNPAA Inventory Manager",
  description: "A modern inventory management workspace for catalog, stock, and operations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
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
