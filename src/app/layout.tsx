import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeKeeper, themeScript } from "@/components/app/theme";
import { textSizeScript } from "@/components/app/text-size-script";
import { AppStateProvider } from "@/lib/app-state";
import { ErrorBoundary } from "@/components/app/error-boundary";
import { ToastProvider } from "@/components/app/toast";
import { RemoteErrorToasts } from "@/components/app/remote-error-toasts";
import { ErrorReporter } from "@/components/app/error-reporter";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const DESCRIPTION =
  "Collect dues, answer requests, run meetings and keep every record. Everything a self-managed HOA does, without the management company.";

export const metadata: Metadata = {
  // What a relative image or link in the metadata resolves against.
  metadataBase: new URL("https://yourhoasis.com"),
  title: {
    default: "Your HOAsis",
    template: "%s · Your HOAsis",
  },
  // The landing page's own line. It used to promise reconciliation and
  // "compliance handled", neither of which the product does for a board.
  description: DESCRIPTION,
  // What a link to the site looks like when somebody pastes it into a
  // message. There was none, so a board member sharing the address got a
  // bare URL.
  openGraph: {
    type: "website",
    siteName: "Your HOAsis",
    title: "Your community. Your HOAsis.",
    description: DESCRIPTION,
    url: "/",
    images: [{ url: "/marketing/hero-oasis-light.jpg", width: 1672, height: 941, alt: "An illustrated neighborhood around a lake" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Your community. Your HOAsis.",
    description: DESCRIPTION,
    images: ["/marketing/hero-oasis-light.jpg"],
  },
  // Still closed to search engines, here and in robots.ts. Opening the
  // marketing pages is Monish's call at launch.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f4f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1524" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: textSizeScript }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <ThemeKeeper />
        <ErrorBoundary label="The app">
          <AppStateProvider>
            <ToastProvider>
              <RemoteErrorToasts />
              <ErrorReporter />
              {children}
            </ToastProvider>
          </AppStateProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
