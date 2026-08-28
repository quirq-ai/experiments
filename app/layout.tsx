import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { WorkspaceProvider } from "@/lib/store";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Autospawn: Find customers the moment they want to buy",
  description:
    "Agents that find customers the moment they want to buy. Monitor the internet for buying signals and turn them into leads.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${poppins.variable} antialiased`}>
        <WorkspaceProvider>{children}</WorkspaceProvider>
      </body>
    </html>
  );
}
