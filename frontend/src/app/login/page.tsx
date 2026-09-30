'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Scale, 
  ShieldCheck, 
  LogIn, 
  UserPlus, 
  Mail, 
  Lock, 
  User, 
  CheckCircle2, 
  AlertCircle,
  ArrowRight
} from 'lucide-react';
import { useAuth, UserRole } from '@/lib/authContext';

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signUp, user, role } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('TECHNICIAN');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setMessage({ type: 'error', text: 'Please enter both email and password.' });
      return;
    }

    if (mode === 'signup' && password.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters long.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      if (mode === 'signup') {
        const { error, session } = await signUp(email, password, selectedRole, fullName);
        if (error) throw error;

        setMessage({
          type: 'success',
          text: session 
            ? 'Account created and authenticated successfully! Redirecting...'
            : 'Registration complete! You can now sign in with your credentials.',
        });

        if (session) {
          setTimeout(() => {
            if (selectedRole === 'APPROVER') router.push('/verification');
            else router.push('/evaluations');
          }, 600);
        } else {
          setMode('signin');
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) throw error;

        setMessage({
          type: 'success',
          text: 'Signed in successfully! Redirecting to workspace...',
        });

        setTimeout(() => {
          router.push('/');
        }, 500);
      }
    } catch (err: any) {
      console.error('Authentication error:', err);
      setMessage({
        type: 'error',
        text: err.message || 'Authentication failed. Please check your credentials.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Quick helper to fill test credentials
  const fillCredentials = (testEmail: string) => {
    setEmail(testEmail);
    setPassword('Password123!');
    setMode('signin');
    setMessage(null);
  };

  return (
    <div className="max-w-lg mx-auto py-12 sm:py-20 px-4">
      {/* Brand Header */}
      <div className="text-center mb-8 space-y-2">
        <div className="w-12 h-12 bg-ink-950 text-white flex items-center justify-center font-display font-black text-sm tracking-wider mx-auto mb-4 shadow-editorial">
          M76
        </div>
        <h1 className="font-display font-extrabold text-3xl tracking-tight text-ink-950 uppercase">
          METRIX WORKSPACE
        </h1>
        <p className="text-xs font-mono text-ink-500 uppercase tracking-widest">
          STATUTORY OIML R 76 VERIFICATION PORTAL
        </p>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex border border-editorial-border bg-alabaster-200 p-1 mb-6">
        <button
          type="button"
          onClick={() => {
            setMode('signin');
            setMessage(null);
          }}
          className={`flex-1 py-2 text-xs font-mono font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            mode === 'signin'
              ? 'bg-ink-950 text-white shadow-editorial'
              : 'text-ink-600 hover:text-ink-950'
          }`}
        >
          <LogIn className="w-3.5 h-3.5" />
          <span>SIGN IN</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('signup');
            setMessage(null);
          }}
          className={`flex-1 py-2 text-xs font-mono font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            mode === 'signup'
              ? 'bg-ink-950 text-white shadow-editorial'
              : 'text-ink-600 hover:text-ink-950'
          }`}
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>REGISTER</span>
        </button>
      </div>

      {/* Status Message */}
      {message && (
        <div
          className={`mb-6 p-4 text-xs font-mono flex items-center gap-2.5 border ${
            message.type === 'success'
              ? 'bg-white text-emerald-800 border-emerald-300'
              : 'bg-white text-rose-800 border-rose-300'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Auth Card */}
      <div className="bg-white border border-editorial-border p-8 shadow-editorial">
        <form onSubmit={handleSubmit} className="space-y-5">
          {mode === 'signup' && (
            <div>
              <label className="block text-[10px] font-mono font-bold text-ink-600 uppercase tracking-widest mb-1.5">
                FULL NAME
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-ink-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Dr. Rajesh Sharma"
                  className="w-full pl-10 pr-3 py-2.5 bg-alabaster-50 border border-editorial-border text-xs text-ink-950 outline-none focus:border-ink-950 transition-colors"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-mono font-bold text-ink-600 uppercase tracking-widest mb-1.5">
              OFFICIAL EMAIL ADDRESS
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-ink-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="officer@metrology.gov.in"
                className="w-full pl-10 pr-3 py-2.5 bg-alabaster-50 border border-editorial-border text-xs text-ink-950 outline-none focus:border-ink-950 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-mono font-bold text-ink-600 uppercase tracking-widest mb-1.5">
              PASSWORD
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-ink-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-3 py-2.5 bg-alabaster-50 border border-editorial-border text-xs text-ink-950 outline-none focus:border-ink-950 transition-colors"
              />
            </div>
          </div>

          {mode === 'signup' && (
            <div>
              <label className="block text-[10px] font-mono font-bold text-ink-600 uppercase tracking-widest mb-1.5">
                DESIGNATED METROLOGY ROLE
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                className="w-full px-3 py-2.5 bg-alabaster-50 border border-editorial-border text-xs font-mono text-ink-950 outline-none focus:border-ink-950"
              >
                <option value="TECHNICIAN">Testing Metrologist (TECHNICIAN - Data Entry & Tests)</option>
                <option value="APPROVER">Legal Metrology Officer (APPROVER - Review & PIN Sign-off)</option>
                <option value="ADMIN">Laboratory Director (ADMIN - Superuser)</option>
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-ink-950 hover:bg-neutral-800 text-white font-mono font-bold text-xs uppercase tracking-widest py-3 px-4 shadow-editorial transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-4"
          >
            <span>{loading ? 'PROCESSING...' : mode === 'signin' ? 'ENTER WORKSPACE' : 'REGISTER ACCOUNT'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* Quick fill buttons for pre-registered test accounts */}
        <div className="mt-8 pt-6 border-t border-editorial-border">
          <span className="text-[10px] font-mono font-bold text-ink-400 uppercase tracking-widest block mb-2.5">
            QUICK ACCESS TEST METROLOGISTS:
          </span>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => fillCredentials('technician@metrology.gov.in')}
              className="px-2 py-2 border border-editorial-border hover:border-ink-950 bg-alabaster-50 hover:bg-white text-[10px] font-mono font-semibold text-ink-900 text-center transition-colors cursor-pointer"
            >
              TESTER
            </button>
            <button
              type="button"
              onClick={() => fillCredentials('approver@metrology.gov.in')}
              className="px-2 py-2 border border-editorial-border hover:border-ink-950 bg-alabaster-50 hover:bg-white text-[10px] font-mono font-semibold text-ink-900 text-center transition-colors cursor-pointer"
            >
              APPROVER
            </button>
            <button
              type="button"
              onClick={() => fillCredentials('admin@metrology.gov.in')}
              className="px-2 py-2 border border-editorial-border hover:border-ink-950 bg-alabaster-50 hover:bg-white text-[10px] font-mono font-semibold text-ink-900 text-center transition-colors cursor-pointer"
            >
              DIRECTOR
            </button>
          </div>
        </div>
      </div>

      {/* Compliance Notice */}
      <div className="mt-8 text-center text-[10px] font-mono text-ink-400 flex items-center justify-center gap-3 uppercase tracking-wider">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-ink-900" />
          ISO/IEC 17025 ACCREDITED
        </span>
        <span>•</span>
        <span>TWO-MAN RULE ENFORCED</span>
      </div>
    </div>
  );
}
