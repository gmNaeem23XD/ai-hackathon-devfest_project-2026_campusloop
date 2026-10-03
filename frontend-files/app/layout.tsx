import type { Metadata } from "next";
import "./globals.css";
import ToastProvider from "@/components/ToastProvider";
import StartupSplash from "@/components/StartupSplash";
import { APP_NAME, ORGANIZATION_NAME } from "@/lib/config";

export const metadata: Metadata = {
  title: APP_NAME,
  description: `${APP_NAME} · ${ORGANIZATION_NAME} meeting and learning workspace.`,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><ToastProvider>{children}<StartupSplash /></ToastProvider></body>
    </html>
  );
}