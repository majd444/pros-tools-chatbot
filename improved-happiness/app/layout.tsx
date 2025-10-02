import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "next-themes"
import { Providers } from "./providers"
import { Toaster } from "@/components/ui/toaster"
import { ConvexClientProvider } from "@/components/providers/convex-provider"

export const dynamic = 'force-dynamic';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Your App Name",
  description: "Your app description",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          <ConvexClientProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="light"
              enableSystem={false}
              disableTransitionOnChange
            >
              {children}
              <Toaster />
            </ThemeProvider>
          </ConvexClientProvider>
        </Providers>
      </body>
    </html>
  );
}
