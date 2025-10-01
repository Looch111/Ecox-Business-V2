import type { Metadata } from "next";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ecox User Hub",
  description: "Submit your account details and grow your reach.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @font-face {
                font-family: 'Geist';
                src: url('https://assets.vercel.com/raw/upload/v1587415301/fonts/2/Geist-Regular.woff2') format('woff2');
                font-weight: 400;
                font-style: normal;
              }
              @font-face {
                font-family: 'Geist';
                src: url('https://assets.vercel.com/raw/upload/v1587415301/fonts/2/Geist-Medium.woff2') format('woff2');
                font-weight: 500;
                font-style: normal;
              }
              @font-face {
                font-family: 'Geist';
                src: url('https://assets.vercel.com/raw/upload/v1587415301/fonts/2/Geist-Bold.woff2') format('woff2');
                font-weight: 700;
                font-style: normal;
              }
            `,
          }}
        />
      </head>
      <body className="font-body antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
