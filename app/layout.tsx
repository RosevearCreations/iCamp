import type { Metadata, Viewport } from "next";

import { ServiceWorkerRegistration } from "@/components/service-worker-registration";

import "./globals.css";
import "./standard-theme.css";
import "./command194.css";
import "./forecast195.css";
import "./orbit-theme.css";

export const metadata: Metadata = {
  applicationName: "iCamp",
  title: {
    default: "iCamp2027",
    template: "%s",
  },
  description: "Flexible campground operations platform for guests and staff.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#071225",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
