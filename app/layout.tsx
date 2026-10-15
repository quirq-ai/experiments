import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { authEnabled } from "@/lib/auth";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Linear clone",
  description: "A Linear-style issue tracker built with Next.js and shadcn/ui",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const content = (
    <html
      lang="en"
      className={cn("dark h-full antialiased font-sans", inter.variable, geistMono.variable)}
    >
      <body className="h-full">{children}</body>
    </html>
  );

  if (!authEnabled) return content;

  return (
    <ClerkProvider appearance={{ theme: dark, variables: { colorPrimary: "#5e6ad2" } }}>
      {content}
    </ClerkProvider>
  );
}
