import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Neuron Tree",
  description: "Personal Second Brain & Inspiration Infinite Canvas",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/leaf-icon.png", type: "image/png" }
    ],
    apple: "/leaf-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <body className="min-h-full flex flex-col bg-[#070707] text-[#ededed]">{children}</body>
    </html>
  );
}
