import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col selection:bg-blue-500 selection:text-white">
      <Navbar />
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 text-center max-w-6xl mx-auto w-full">
        {/* Release Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/40 mb-6 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          <span>Autonomous LangGraph Multi-Agent Architecture</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-5xl sm:text-6xl font-extrabold mb-5 tracking-tight bg-gradient-to-r from-blue-400 via-sky-300 to-teal-300 bg-clip-text text-transparent">
          ApplyForge
        </h1>

        {/* Hero Subtitle */}
        <p className="text-slate-300 text-lg sm:text-xl max-w-2xl mb-8 leading-relaxed font-normal">
          Multi-Agent Job Application Copilot. Tailor your resume, benchmark ATS fit scores, generate cover letters, and track your CRM job pipeline effortlessly.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-12">
          <Link
            to="/login"
            className="px-7 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition shadow-lg shadow-blue-600/25 active:scale-98"
          >
            Get Started Free
          </Link>
          <Link
            to="/register"
            className="px-7 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold transition border border-slate-700/80 hover:border-slate-600 active:scale-98"
          >
            Create Account
          </Link>
        </div>

        {/* Optimized Hero Visual with fetchpriority high and explicit aspect ratio */}
        <div className="relative w-full max-w-4xl rounded-2xl p-2 bg-gradient-to-b from-slate-800/60 to-slate-900/60 border border-slate-800 shadow-2xl shadow-blue-500/5 backdrop-blur-sm">
          <img
            src="/hero-preview.svg"
            alt="ApplyForge multi-agent architecture and ATS scoring pipeline showcase"
            width="800"
            height="450"
            fetchPriority="high"
            decoding="async"
            className="w-full h-auto rounded-xl shadow-inner border border-slate-800/80"
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-slate-900 text-center text-xs text-slate-400">
        ApplyForge &copy; {new Date().getFullYear()} — Production Ready Multi-Agent Copilot
      </footer>
    </div>
  );
}
