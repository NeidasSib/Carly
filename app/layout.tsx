import { ThemeProvider } from "@/components/theme-provider";
import QueryProvider from "@/components/providers/query-provider";
import "./globals.css";

export const metadata = {
  title: "Carly – Vehicle management",
  description:
    "Manage your vehicles, compliance dates, and bookings in one place. Personal and company workspaces.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <QueryProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
