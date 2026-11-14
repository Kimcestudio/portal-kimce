import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth/AuthProvider";
import "./globals.css";


export const metadata: Metadata = {
  title: "Kimce App",
  description: "Portal interno para colaboradores KIMCE.",
  icons: {
    icon: "/brand/logo-principal.png",
    shortcut: "/brand/logo-principal.png",
    apple: "/brand/logo-principal.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" translate="no">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
