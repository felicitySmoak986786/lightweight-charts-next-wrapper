import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Multi-Chart Terminal",
  description: "Four resizable openalgo-charts panels on a shadcn/ui grid",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="dark h-full">
      <body className="h-full overflow-hidden bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
