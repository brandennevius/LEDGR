import type { Metadata } from "next";
import { Fraunces, Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Arbor • Financial Coaching",
  description:
    "Behavior-first financial coaching with software insights and human accountability.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var d=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;var v=(t==='dark'||t==='light')?t:(d?'dark':'light');document.documentElement.dataset.theme=v;}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`${spaceGrotesk.variable} ${fraunces.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
