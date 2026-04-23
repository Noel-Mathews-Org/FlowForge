import "./globals.css";
import { Inter } from "next/font/google";
import { Providers } from "@/providers/Providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", weight: ["400", "500", "600"] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.variable}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
