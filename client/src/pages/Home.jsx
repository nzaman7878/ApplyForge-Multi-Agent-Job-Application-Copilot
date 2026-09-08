import React from 'react';
import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-5xl font-extrabold mb-4 bg-gradient-to-r from-blue-400 to-teal-300 bg-clip-text text-transparent">
        ApplyForge
      </h1>
      <p className="text-slate-400 text-lg max-w-md mb-8">
        Multi-Agent Job Application Copilot. Tailor your resume, verify ATS fit, and track your
        application lifecycle.
      </p>
      <div className="flex gap-4">
        <Link
          to="/login"
          className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition"
        >
          Sign In
        </Link>
        <Link
          to="/register"
          className="px-6 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition border border-slate-700"
        >
          Create Account
        </Link>
      </div>
    </div>
  );
}
