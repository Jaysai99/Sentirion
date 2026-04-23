import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import NavBar from "./components/NavBar";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata = {
  title: "Sentirion by Dekalb Capital Management LLC",
  description: "Institutional market sentiment intelligence platform by Dekalb Capital Management LLC.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} ${ibmPlexMono.variable} antialiased`}>
        <NavBar />
        <div className="pt-14">{children}</div>
      </body>
    </html>
  );
}
