import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Auksinis Protas | Žaidimų vakarai",
  description: "Rezervuokite vietą artimiausiame Auksinio Proto žaidime.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="lt">
      <body>{children}</body>
    </html>
  );
}
