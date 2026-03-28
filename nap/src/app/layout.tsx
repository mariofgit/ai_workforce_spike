import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Neuforce Spike Console",
  description: "Simple UI to trigger SDR and inspect NAP state",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
