"use client";
import Image from "next/image";
import { useState } from "react";

export default function Home() {
  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [comments, setComments] = useState("");
  const [status, setStatus] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("Submitting...");
    try {
      const res = await fetch("/mailing-list/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, phone, comments }),
      });
      if (res.ok) {
        setStatus("Thank you! You're on the list.");
        setEmail("");
        setName("");
        setPhone("");
        setComments("");
      } else {
        setStatus("Error. Try again.");
      }
    } catch {
      setStatus("Error. Try again.");
    }
  };
  return (
    <div className="relative min-h-screen flex flex-col items-center px-0 py-0 overflow-x-hidden bg-[#0f2027]">
      {/* Finance-inspired SVG background */}
      <div className="fixed inset-0 -z-10 pointer-events-none w-full h-full">
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 1440 900"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="bg-gradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#0f2027" />
              <stop offset="50%" stopColor="#2c5364" />
              <stop offset="100%" stopColor="#232526" />
            </linearGradient>
            <linearGradient id="line-gradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#00cec9" />
              <stop offset="100%" stopColor="#0984e3" />
            </linearGradient>
          </defs>
          <rect width="1440" height="900" fill="url(#bg-gradient)" />
          <polyline
            points="0,700 200,600 400,650 600,500 800,550 1000,400 1200,450 1440,300"
            fill="none"
            stroke="url(#line-gradient)"
            strokeWidth="6"
            opacity="0.18"
          />
          <polyline
            points="0,800 180,700 380,750 580,600 780,650 980,500 1180,550 1440,400"
            fill="none"
            stroke="url(#line-gradient)"
            strokeWidth="3"
            opacity="0.12"
          />
          {Array.from({ length: 10 }).map((_, i) => (
            <line
              key={i}
              x1={0}
              y1={i * 90}
              x2={1440}
              y2={i * 90}
              stroke="#fff"
              strokeOpacity="0.04"
              strokeWidth="1"
            />
          ))}
          {Array.from({ length: 8 }).map((_, i) => (
            <line
              key={i}
              x1={i * 180}
              y1={0}
              x2={i * 180}
              y2={900}
              stroke="#fff"
              strokeOpacity="0.04"
              strokeWidth="1"
            />
          ))}
        </svg>
      </div>

      {/* NAVBAR */}
      <nav className="w-full flex flex-col sm:flex-row items-center justify-between px-4 sm:px-8 py-4 sm:py-6 max-w-7xl mx-auto gap-4 sm:gap-0">
        <span className="text-2xl font-extrabold text-white tracking-tight mb-2 sm:mb-0">
          Sentirion
        </span>
        <div className="flex gap-4 sm:gap-8 flex-wrap justify-center">
          <a
            href="#features"
            className="text-[#b2bec3] hover:text-[#00cec9] font-medium transition"
          >
            Features
          </a>
          <a
            href="#how"
            className="text-[#b2bec3] hover:text-[#00cec9] font-medium transition"
          >
            How it Works
          </a>
          <a
            href="#api"
            className="text-[#b2bec3] hover:text-[#00cec9] font-medium transition"
          >
            API
          </a>
          <a
            href="#contact"
            className="text-[#b2bec3] hover:text-[#00cec9] font-medium transition"
          >
            Contact
          </a>
          <a
            href="/sentiment"
            className="text-[#b2bec3] hover:text-[#00cec9] font-medium transition"
          >
            Demo
          </a>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-6 py-2 rounded-full bg-[#00cec9] text-white font-semibold shadow-lg hover:bg-[#0984e3] transition mt-2 sm:mt-0"
        >
          Get Early Access
        </button>
      </nav>

      {/* HERO */}
      <section className="w-full flex flex-col items-center justify-center text-center pt-16 sm:pt-24 pb-10 sm:pb-16 px-3 sm:px-4">
        <h1 className="text-3xl sm:text-6xl font-extrabold text-white mb-4 sm:mb-6 leading-tight max-w-xs sm:max-w-3xl">
          Uncover the Market’s Mood.
          <br />
          <span className="text-[#00cec9]">
            Smarter investing, powered by sentiment.
          </span>
        </h1>
        <p className="text-base sm:text-xl text-[#b2bec3] max-w-xs sm:max-w-2xl mb-6 sm:mb-8">
          Sentirion analyzes real-time data from social media, SEC filings,
          earnings calls, and news to deliver actionable sentiment insights for
          every stock.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-2">
          <button
            onClick={() => setShowModal(true)}
            className="px-8 py-4 rounded-full bg-[#00cec9] text-white font-semibold text-base sm:text-xl shadow-lg hover:bg-[#0984e3] transition"
          >
            Request Early Access
          </button>
          <a
            href="/sentiment"
            className="px-8 py-4 rounded-full bg-[#00cec9] text-white font-semibold text-base sm:text-xl shadow-lg hover:bg-[#0984e3] transition flex items-center justify-center"
            style={{ textDecoration: "none" }}
          >
            Try Now
          </a>
        </div>
      </section>

      {/* LOGOS / TRUST BAR */}
      <section className="w-full flex flex-nowrap sm:flex-wrap items-center justify-center gap-6 sm:gap-8 py-4 sm:py-6 opacity-80 overflow-x-auto px-2">
        <Image
          src="/logos/yahoo-finance.svg"
          alt="Yahoo Finance"
          width={100}
          height={28}
          className="flex-shrink-0"
        />
        <Image
          src="/logos/bloomberg.svg"
          alt="Bloomberg"
          width={100}
          height={28}
          className="flex-shrink-0"
        />
        <Image
          src="/logos/reuters.svg"
          alt="Reuters"
          width={100}
          height={28}
          className="flex-shrink-0"
        />
        {/* <Image src="/logos/twitter.svg" alt="Twitter" width={100} height={28} className="flex-shrink-0" /> */}
      </section>

      {/* FEATURES */}
      <section
        id="features"
        className="w-full max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-10 py-10 sm:py-20 px-2"
      >
        <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-lg p-6 sm:p-8 border border-white/10 flex flex-col gap-3">
          <h3 className="text-lg sm:text-xl font-bold text-white mb-1">
            Social Media Pulse
          </h3>
          <p className="text-[#b2bec3] text-sm sm:text-base">
            Track trending tickers and market sentiment across Twitter, Reddit,
            and financial forums in real time.
          </p>
        </div>
        <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-lg p-6 sm:p-8 border border-white/10 flex flex-col gap-3">
          <h3 className="text-lg sm:text-xl font-bold text-white mb-1">
            Earnings & SEC Calls
          </h3>
          <p className="text-[#b2bec3] text-sm sm:text-base">
            Extract sentiment from earnings transcripts and SEC filings to spot
            shifts in company outlook before the market reacts.
          </p>
        </div>
        <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-lg p-6 sm:p-8 border border-white/10 flex flex-col gap-3">
          <h3 className="text-lg sm:text-xl font-bold text-white mb-1">
            News Analytics
          </h3>
          <p className="text-[#b2bec3] text-sm sm:text-base">
            Monitor breaking news and headlines to gauge real-time market
            reactions and sentiment shifts.
          </p>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section
        id="how"
        className="w-full max-w-5xl mx-auto flex flex-col md:flex-row gap-8 sm:gap-10 py-10 sm:py-20 px-2"
      >
        <div className="flex-1 flex flex-col justify-center mb-8 md:mb-0">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3 sm:mb-4">
            How Sentirion Works
          </h2>
          <p className="text-[#b2bec3] text-base sm:text-lg mb-3 sm:mb-4">
            Sentirion aggregates and analyzes millions of data points using
            advanced natural language processing and machine learning. Our
            algorithms detect sentiment shifts, trending tickers, and
            market-moving events in real time.
          </p>
          <ul className="list-disc list-inside text-[#b2bec3] text-sm sm:text-base space-y-2">
            <li>Real-time social, news, and SEC data ingestion</li>
            <li>AI-powered sentiment scoring and anomaly detection</li>
            <li>Customizable dashboards and alerts</li>
            <li>API access for programmatic integration</li>
          </ul>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-full sm:max-w-[1000px] min-w-0 h-[220px] sm:h-[400px] overflow-x-auto rounded-xl shadow-xl border border-white/10">
            <iframe
              src="https://cork-shout-49815262.figma.site/"
              allowFullScreen
              className="w-full h-full border-0"
            />
          </div>
        </div>
      </section>

      {/* API & INTEGRATIONS */}
      <section
        id="api"
        className="w-full max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-10 py-10 sm:py-20 px-2"
      >
        <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-lg p-6 sm:p-8 border border-white/10 flex flex-col gap-3">
          <h3 className="text-lg sm:text-xl font-bold text-white mb-2">
            Integrations & API
          </h3>
          <p className="text-[#b2bec3] text-sm sm:text-base">
            Connect Sentirion with your favorite trading platforms and tools.
            Our robust API lets you access sentiment data programmatically for
            custom strategies and research.
          </p>
        </div>
        <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-lg p-6 sm:p-8 border border-white/10 flex flex-col gap-3">
          <h3 className="text-lg sm:text-xl font-bold text-white mb-2">
            Transparent Methodology
          </h3>
          <p className="text-[#b2bec3] text-sm sm:text-base">
            We believe in transparency. Learn how our sentiment scores are
            calculated and how we ensure data quality, accuracy, and fairness in
            our analytics.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section
        id="contact"
        className="w-full flex flex-col items-center justify-center py-12 sm:py-20 px-2"
      >
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 text-center">
          Ready to transform your trading?
        </h2>
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <button
            onClick={() => setShowModal(true)}
            className="px-8 py-4 rounded-full bg-[#00cec9] text-white font-semibold text-base sm:text-xl shadow-lg hover:bg-[#0984e3] transition"
          >
            Request Early Access
          </button>
        </div>
        <a
          href="mailto:contact@sentirion.net"
          className="text-[#00cec9] hover:underline text-base sm:text-lg"
        >
          contact@sentirion.net
        </a>
      </section>

      {/* FOOTER */}
      <footer className="w-full py-6 sm:py-8 flex flex-col items-center border-t border-white/10 mt-8 px-2">
        <span className="text-[#b2bec3] text-xs mb-2 text-center">
          &copy; {new Date().getFullYear()} Sentirion. All rights reserved.
        </span>
        <div className="flex gap-4 mb-2 flex-wrap justify-center">
          <a href="#" className="text-[#b2bec3] hover:text-[#00cec9] text-xs">
            Privacy Policy
          </a>
          <a href="#" className="text-[#b2bec3] hover:text-[#00cec9] text-xs">
            Terms of Service
          </a>
        </div>
        <a
          href="mailto:contact@sentirion.net"
          className="text-[#00cec9] hover:underline text-xs"
        >
          contact@sentirion.net
        </a>
        <span className="text-[#d63031] text-xs mt-4 text-center">
          Disclaimer: Sentirion is not a registered financial institution. This
          site does not provide investment advice.
        </span>
      </footer>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#232526] rounded-xl p-6 w-full max-w-xs mx-2 shadow-xl flex flex-col items-center">
            <h3 className="text-lg font-bold text-white mb-2 text-center">
              Subscribe for Early Access
            </h3>
            <form
              className="w-full flex flex-col gap-3"
              onSubmit={handleSubmit}
            >
              <input
                type="text"
                required
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="px-3 py-2 rounded bg-[#2c5364] text-white border border-[#00cec9] focus:outline-none"
              />
              <input
                type="email"
                required
                placeholder="Your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="px-3 py-2 rounded bg-[#2c5364] text-white border border-[#00cec9] focus:outline-none"
              />
              <input
                type="tel"
                placeholder="Phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="px-3 py-2 rounded bg-[#2c5364] text-white border border-[#00cec9] focus:outline-none"
              />
              <textarea
                placeholder="Comments"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                className="px-3 py-2 rounded bg-[#2c5364] text-white border border-[#00cec9] focus:outline-none resize-none"
                rows={3}
              />
              <button
                type="submit"
                className="px-4 py-2 rounded bg-[#00cec9] text-white font-semibold shadow hover:bg-[#0984e3] transition"
              >
                Subscribe
              </button>
            </form>
            <button
              className="mt-3 text-[#b2bec3] hover:text-[#00cec9] text-sm"
              onClick={() => {
                setShowModal(false);
                setStatus("");
              }}
            >
              Close
            </button>
            {status && (
              <div className="mt-2 text-xs text-[#00cec9] text-center">
                {status}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
