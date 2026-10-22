import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SignalSpring — Software and AI careers, in focus",
  description:
    "A practical career planner and job explorer for software and AI engineers.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
