import type { Metadata } from "next";

import { ThemeInit } from "@/components/ThemeInit";
import { ToastContainer } from "@/components/ToastContainer";

import "./globals.css";

export const metadata: Metadata = {
  title: "Signal Clone",
  description: "A functional clone of the Signal messaging app",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="dark" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <ThemeInit />
        {children}
        <ToastContainer />
      </body>
    </html>
  );
}
