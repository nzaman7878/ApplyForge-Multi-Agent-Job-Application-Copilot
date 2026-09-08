import React from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';

export default function Apply() {
  return (
    <AppLayout>
      <main className="max-w-5xl mx-auto w-full p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-6 text-sm text-slate-400">
          <Link to="/dashboard" className="hover:text-white transition">
            Dashboard
          </Link>
          <span>/</span>
          <span className="text-white">New Application</span>
        </div>
        <h1 className="text-3xl font-bold mb-2 tracking-tight">Tailor New Application</h1>
        <p className="text-slate-400 mb-8">
          Paste the job description and your resume to initiate the multi-agent tailoring pipeline.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900/60 p-6 rounded-xl border border-slate-800">
            <h2 className="text-lg font-semibold mb-3">1. Job Description</h2>
            <textarea
              rows={8}
              placeholder="Paste job description here..."
              className="w-full p-3 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>
          <div className="bg-slate-900/60 p-6 rounded-xl border border-slate-800">
            <h2 className="text-lg font-semibold mb-3">2. Master Resume</h2>
            <textarea
              rows={8}
              placeholder="Paste markdown/text resume or upload..."
              className="w-full p-3 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>
        </div>
        <button
          type="button"
          className="mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold text-white transition shadow-sm shadow-blue-500/20"
        >
          Run Multi-Agent Copilot
        </button>
      </main>
    </AppLayout>
  );
}
