import React from 'react';
import { Link } from 'react-router-dom';

export default function Tracker() {
  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-2 mb-6 text-sm text-slate-400">
          <Link to="/dashboard" className="hover:text-white transition">
            Dashboard
          </Link>
          <span>/</span>
          <span className="text-white">Tracker</span>
        </div>
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Application Tracker</h1>
            <p className="text-slate-400 text-sm mt-1">
              Track status, submission dates, ATS match scores, and interview stages.
            </p>
          </div>
          <Link
            to="/apply"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition"
          >
            + New Application
          </Link>
        </div>

        <div className="bg-slate-800/40 rounded-xl border border-slate-700 overflow-hidden">
          <div className="p-8 text-center text-slate-400">
            <p>No job applications tracked yet.</p>
            <p className="text-xs text-slate-500 mt-1">
              Applications created in ApplyForge will automatically appear here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
