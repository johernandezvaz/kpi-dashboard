import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CDI DTC — KPI Scorecard",
  description:
    "Manufacturing KPI compliance scorecard for CDI DTC plants. View compliance percentages by area and process for any selected plant, year, and month.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
