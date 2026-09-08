import React from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';

export default function Tracker() {
  return (
    <AppLayout>
      <main className="max-w-6xl mx-auto w-full p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-6 text-sm text-slate-400">
          <Link to="/dashboard" className="hover:text-white transition">
            Dashboard
          </Link>
          <span>/</span>
          <span className="text-white">Tracker</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Application Tracker</h1>
            <p className="text-slate-400 text-sm mt-1">
              Track status, submission dates, ATS match scores, and interview stages.
            </p>
          </div>
          <Link
            to="/apply"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition shadow-sm shadow-blue-500/20 shrink-0"
          >
            + New Application
          </Link>
        </div>

        <div className="bg-slate-900/60 rounded-xl border border-slate-800 overflow-hidden">
          <div className="p-12 text-center text-slate-400">
            <p className="font-medium text-slate-300">No job applications tracked yet.</p>
            <p className="text-xs text-slate-500 mt-1">
              Applications created in ApplyForge will automatically appear here.
            </p>
          </div>
        </div>
      </main>
    </AppLayout>
  );
}
