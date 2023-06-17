"use strict";
import { Inter } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import React, { createContext, useContext, useEffect, useState } from "react";
import "./globals.css";
0;

const inter = Inter({ subsets: ["latin"] });

export const MetadataContext = createContext({
  title: "The Great New Orleanian Inquirer by the Eye on Surveillance",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const metadata = useContext(MetadataContext);

  useEffect(() => {
    setIsDarkMode(
      window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
    );
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  return (
    <>
      <header className="flex flex-col items-center space-y-4 bg-blue-600 p-4 text-white">
        <div className="h-32 w-32 md:h-48 md:w-48">
          <Image
            src="/photos/nolaflag.png"
            alt="New Orleans Flag"
            width={200}
            height={133}
          />
        </div>
        <h1 className="text-xl font-bold md:text-2xl">{metadata.title}</h1>
      </header>
      <main className="p-4">{children}</main>
      <footer className="flex items-center justify-center bg-blue-600 p-4 text-xs text-white">
        <p className="text-sm font-light md:text-base">
          &copy; {new Date().getFullYear()} The Great Inquirer
        </p>
        <Link href="/about" className="ml-4 text-xs text-gray-200 underline">
          About Us
        </Link>
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="ml-4 rounded bg-gray-200 p-1"
        >
          Toggle Dark Mode
        </button>
      </footer>
    </>
  );
}
