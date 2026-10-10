import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { GeistSans } from "geist/font/sans";
import { QueryProvider } from "@/components/providers/query-provider";
import { Toaster } from "@/components/ui/sonner";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "CalorieTracker",
  description: "Contagem de calorias e macros",
  // Name under the home screen shortcut. Not `capable`: the shortcut opens in Safari, not standalone.
  appleWebApp: { title: "Calorias", capable: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafb" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1015" },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub ?? null;

  return (
    <html lang="pt" className={GeistSans.variable}>
      <body>
        {/* key resets the cache provider when the user changes */}
        <QueryProvider key={userId ?? "anon"} userId={userId}>
          {children}
        </QueryProvider>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
