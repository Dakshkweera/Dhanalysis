import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";

const features = [
  {
    src: "/dashboard.jpg",
    title: "Dashboard & Performance Overview",
    desc: "Monitor your entire portfolio at a glance: see best and worst performers, track overall value, profits, and compare results to benchmarks instantly.",
  },
  {
    src: "/reports.jpg",
    title: "Detailed Analytics and Reports",
    desc: "View comprehensive analytics including XIRR, CAGR, ROI, portfolio allocation charts, and distribution types. Gain deep insights into growth and diversification.",
  },
  {
    src: "/ai-advisor.jpg",
    title: "AI Portfolio Advisor",
    desc: "Ask personalized questions about your investments. Get expert, AI-powered answers referencing your real portfolio data—performance, risk, and allocation.",
  },
  {
    src: "/investments.jpg",
    title: "Investments & Holdings Management",
    desc: "Easily add or review all stocks and ETFs you hold. Visualize real-time returns and averages, with smart search and filtering.",
  },
  {
  src: "/risk-analysis.jpg",
  title: "Risk Analysis & Metrics",
  desc: "Visualize your portfolio risk in real-time: track max drawdown, volatility, Sharpe ratio, and market sensitivity. Instantly understand downside, concentration, and return consistency for smarter investment decisions."
  },
];

export default function AnimatedCarouselLandingPage() {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!paused) {
      const timer = setTimeout(() => {
        setCurrent((prev) => (prev + 1) % features.length);
      }, 5000); // slower: 5s
      return () => clearTimeout(timer);
    }
  }, [current, paused]);

  const goTo = (idx: number) => {
    setCurrent(idx);
    setPaused(true);
  };

  const goLeft = () => {
    setCurrent((prev) => (prev - 1 + features.length) % features.length);
    setPaused(true);
  };

  const goRight = () => {
    setCurrent((prev) => (prev + 1) % features.length);
    setPaused(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-900 via-blue-900 to-gray-900 text-white overflow-x-hidden">
      {/* Navbar and Hero (keep as before) */}
      <header className="flex items-center justify-between px-8 py-6">
        <h1 className="text-2xl font-bold text-white tracking-wide">Dhanalysis</h1>
        <nav className="flex items-center gap-6 text-sm">
          <Link to="/login" className="hover:text-blue-400 transition-colors">Login</Link>
          <Link to="/signup" className="hover:text-blue-400 transition-colors">Signup</Link>
        </nav>
      </header>

      <main className="flex flex-col items-center flex-1 px-6 pt-12 pb-0 justify-center">
        <h2 className="text-5xl md:text-6xl font-extrabold mb-8 bg-gradient-to-r from-blue-400 to-cyan-400 text-transparent bg-clip-text text-center">
          Smarter Portfolio Decisions, Powered by AI
        </h2>
        <p className="mb-10 text-gray-200 max-w-xl text-center text-lg">
          Dhanalysis helps you analyze investments, understand risks, and get personalized insights based on your actual portfolio.
        </p>
        <div className="mb-8 flex gap-4 justify-center">
          <Link
            to="/login"
            className="px-8 py-4 rounded-xl bg-gradient-to-r from-blue-400 to-indigo-600 text-white text-lg font-semibold shadow-lg flex items-center gap-2 hover:scale-105 transition-transform"
          >
            Sign In 🔒
          </Link>
          <Link
            to="/signup"
            className="px-8 py-4 rounded-xl bg-gradient-to-r from-teal-400 to-green-600 text-white text-lg font-semibold shadow-lg flex items-center gap-2 hover:scale-105 transition-transform"
          >
            Sign Up ✨
          </Link>
        </div>

        <section className="w-full flex flex-col items-center justify-center">
          <div className="relative flex flex-col items-center w-full">
            {/* Arrows */}
            <button
              aria-label="Previous feature"
              className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 bg-blue-900/60 hover:bg-blue-800 text-white rounded-full p-3 shadow-xl"
              style={{ fontSize: 22 }}
              onClick={goLeft}
            >
              {"<"}
            </button>
            <button
              aria-label="Next feature"
              className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10 bg-blue-900/60 hover:bg-blue-800 text-white rounded-full p-3 shadow-xl"
              style={{ fontSize: 22 }}
              onClick={goRight}
            >
              {">"}
            </button>

            <AnimatePresence mode="wait">
              <motion.div
                key={current}
                initial={{ opacity: 0, y: 30, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -30, scale: 0.95 }}
                transition={{ duration: 0.7 }}
                className="flex flex-col items-center w-full"
              >
                <div className="relative flex justify-center w-full mx-auto my-2 px-4">
                  <div className="bg-blue-900/20 rounded-2xl shadow-2xl px-2 py-2 w-full flex justify-center items-center"
                    style={{ width: '88vw', maxWidth: '950px', height: '430px' }}>
                    <img
                      src={features[current].src}
                      alt={features[current].title}
                      className="rounded-2xl border-4 border-white/10 object-contain mx-auto transition-all"
                      style={{ width: "83vw", maxWidth: 880, maxHeight: 400 }}
                      onClick={() => goRight()}
                    />
                  </div>
                </div>
                <div className="mt-7 mb-1 text-3xl font-extrabold text-blue-100 text-center">
                  {features[current].title}
                </div>
                <div className="mb-8 text-lg text-blue-100/90 text-center max-w-2xl font-medium px-4">
                  {features[current].desc}
                </div>
                <div className="flex gap-3 justify-center mt-1 mb-8">
                  {features.map((f, idx) => (
                    <button
                      key={idx}
                      aria-label={f.title}
                      className={`w-4 h-4 rounded-full transition-all border-2 border-blue-300 ${idx === current ? "bg-blue-500 scale-110" : "bg-blue-100 opacity-70"} `}
                      onClick={() => goTo(idx)}
                    />
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </section>
      </main>
      
      <footer className="bg-gray-950 py-8 text-center text-gray-500 text-sm mt-auto">
        <p>© {new Date().getFullYear()} Dhanalysis. Easing your investment journey — by Daksh Kweera.</p>
        <div className="flex justify-center gap-6 mt-2">
          <a href="https://github.com/Dakshkweera" className="hover:text-blue-400" target="_blank" rel="noopener noreferrer">GitHub</a>
          <a href="https://www.linkedin.com/in/daksh-kweera-2008aa289/" className="hover:text-blue-400" target="_blank" rel="noopener noreferrer">LinkedIn</a>
          <a href="mailto:kweera2005@example.com" className="hover:text-blue-400">Contact</a>
        </div>
      </footer>
    </div>
  );
}
