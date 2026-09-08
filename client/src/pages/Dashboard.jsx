import React from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';

export default function Dashboard() {
  return (
    <AppLayout>
      <main className="max-w-6xl mx-auto w-full p-6 sm:p-8">
        <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 pb-6 border-b border-slate-800 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-sm text-slate-400 mt-1">
              Overview of your AI job applications, ATS scores, and outreach.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/apply"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition shadow-sm shadow-blue-500/20"
            >
              New Application
            </Link>
            <Link
              to="/tracker"
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-medium transition border border-slate-700"
            >
              Application Tracker
            </Link>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-slate-900/60 p-6 rounded-xl border border-slate-800 hover:border-slate-700 transition">
            <h3 className="text-slate-400 text-sm font-medium mb-1">Tailored Applications</h3>
            <p className="text-3xl font-bold text-white">0</p>
          </div>
          <div className="bg-slate-900/60 p-6 rounded-xl border border-slate-800 hover:border-slate-700 transition">
            <h3 className="text-slate-400 text-sm font-medium mb-1">Avg ATS Score</h3>
            <p className="text-3xl font-bold text-teal-400">--%</p>
          </div>
          <div className="bg-slate-900/60 p-6 rounded-xl border border-slate-800 hover:border-slate-700 transition">
            <h3 className="text-slate-400 text-sm font-medium mb-1">Pending Follow-ups</h3>
            <p className="text-3xl font-bold text-white">0</p>
          </div>
        </div>
      </main>
    </AppLayout>
  );
}
