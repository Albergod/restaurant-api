import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata = {
  title: "Restaurante",
  description: "Plataforma de gestión para restaurantes",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-[#fafafa] font-sans text-gray-900">
        {children}
      </body>
    </html>
  );
}
