import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema } from '../schemas/auth.schemas';
import { useAuth } from '../context/AuthContext';
import {
  Button,
  FormField,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '../components/ui';

export default function Register() {
  const [serverError, setServerError] = useState('');
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSchema),
    mode: 'onChange',
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const passwordValue = watch('password', '');
  const hasMinLength = passwordValue.length >= 8;

  const onSubmit = async (data) => {
    try {
      setServerError('');
      await registerUser(data.name, data.email, data.password);
      navigate('/dashboard');
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Registration failed. Please try again.';
      setServerError(message);
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 sm:p-6 overflow-hidden">
      {/* Background Decorative Blur Orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none -z-0" />
      <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-teal-500/15 rounded-full blur-3xl pointer-events-none -z-0" />

      {/* Main Container with smooth fade/slide animation */}
      <div className="w-full max-w-md relative z-10 animate-fade-in transition-all duration-300">
        {/* Logo / Brand Header */}
        <div className="text-center mb-6">
          <Link to="/" className="inline-block group">
            <span className="text-2xl font-black tracking-tight bg-gradient-to-r from-blue-400 via-sky-300 to-teal-300 bg-clip-text text-transparent group-hover:opacity-90 transition">
              ApplyForge
            </span>
          </Link>
        </div>

        <Card className="border-slate-800/80 bg-slate-900/70 backdrop-blur-xl shadow-2xl shadow-black/40">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl font-bold text-white tracking-tight">
              Create your account
            </CardTitle>
            <CardDescription className="text-slate-400 text-sm">
              Start tailoring and tracking job applications with AI
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4">
            {/* Server Error Alert */}
            {serverError && (
              <div
                className="mb-5 p-3.5 rounded-lg bg-red-950/50 border border-red-800/60 text-red-300 text-sm flex items-start gap-2.5 animate-shake"
                role="alert"
              >
                <svg
                  className="w-5 h-5 text-red-400 shrink-0 mt-0.5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <span>{serverError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <FormField
                label="Full Name"
                name="name"
                type="text"
                placeholder="e.g. Alice Smith"
                required
                register={register}
                errors={errors}
                autoComplete="name"
              />

              <FormField
                label="Email Address"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
                register={register}
                errors={errors}
                autoComplete="email"
              />

              <FormField
                label="Password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
                register={register}
                errors={errors}
                autoComplete="new-password"
              />

              {/* Password Requirement Indicator */}
              {passwordValue && (
                <div className="flex items-center gap-2 text-xs transition-colors">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${
                      hasMinLength ? 'bg-teal-400' : 'bg-slate-600'
                    }`}
                  />
                  <span className={hasMinLength ? 'text-teal-300' : 'text-slate-400'}>
                    At least 8 characters
                  </span>
                </div>
              )}

              <FormField
                label="Confirm Password"
                name="confirmPassword"
                type="password"
                placeholder="••••••••"
                required
                register={register}
                errors={errors}
                autoComplete="new-password"
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isSubmitting}
                className="w-full mt-2 font-semibold shadow-blue-500/20 shadow-lg hover:shadow-blue-500/30"
              >
                Create Account
              </Button>
            </form>

            <p className="text-center text-xs text-slate-400 mt-6">
              Already have an account?{' '}
              <Link
                to="/login"
                className="text-blue-400 hover:text-blue-300 font-medium transition underline-offset-4 hover:underline"
              >
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
