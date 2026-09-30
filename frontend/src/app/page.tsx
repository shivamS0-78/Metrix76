'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ClipboardCheck, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldAlert, 
  ArrowRight, 
  TrendingUp, 
  Scale, 
  Award, 
  ShieldCheck, 
  Lock, 
  FileCheck2, 
  QrCode, 
  Search, 
  Database, 
  Layers, 
  ChevronRight, 
  UserCheck, 
  Sparkles, 
  FileText, 
  Activity, 
  ArrowUpRight,
  Shield,
  Check,
  Cpu
} from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import { getDashboardData } from '@/lib/api';
import { DashboardData } from '@/types/metrology';
import { formatDate } from '@/lib/utils';

export default function RootPage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();

  // Public Landing Page Search State
  const [verifySearchId, setVerifySearchId] = useState('');
  
  // Authenticated Dashboard State
  const [data, setData] = useState<DashboardData | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setLoadingDashboard(true);
      getDashboardData(user.id, role || undefined)
        .then(setData)
        .catch((err) => {
          console.error('Dashboard load error:', err);
          setError('Unable to load operational dashboard. Please ensure backend is running.');
        })
        .finally(() => setLoadingDashboard(false));
    }
  }, [user, role]);

  const handleQuickVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifySearchId.trim()) {
      router.push(`/verify/${encodeURIComponent(verifySearchId.trim())}`);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-2 border-ink-950 border-t-transparent animate-spin" />
        <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-ink-500">
          Initializing Metrology Security Engine...
        </span>
      </div>
    );
  }

  // =========================================================================
  // 1. PUBLIC LANDING PAGE (Inspired by Luxury Editorial Monochrome Theme)
  // =========================================================================
  if (!user) {
    return (
      <div className="w-full space-y-16 pb-20">
        
        {/* HERO SECTION: Monumental Editorial Layout */}
        <section className="relative overflow-hidden bg-alabaster-50 border-b border-editorial-border pt-12 pb-20 sm:pt-20 sm:pb-32 px-4 sm:px-8">
          
          {/* Giant Monumental Watermark Typography (like GAZU in the reference photo) */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
            <span className="font-display font-black text-[22vw] tracking-tighter text-ink-950/[0.04] leading-none uppercase">
              METRIX
            </span>
          </div>

          <div className="relative max-w-7xl mx-auto">
            
            {/* Top Micro-Captions */}
            <div className="flex justify-between items-start mb-8 sm:mb-16">
              <div className="text-[11px] font-mono tracking-[0.25em] text-ink-600 uppercase space-y-1">
                <div>LEGAL METROLOGY</div>
                <div>THAT DEFINES</div>
                <div>NATIONAL STANDARDS.</div>
              </div>
              <div className="text-right text-[11px] font-mono tracking-[0.25em] text-ink-600 uppercase space-y-1 hidden sm:block">
                <div>OIML R 76-1 / R 76-2</div>
                <div>TYPE APPROVAL SYSTEM</div>
                <div>2026 EDITION</div>
              </div>
            </div>

            {/* Central Focal Statement & Metrological Precision Visual */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              
              {/* Left Column: Bold Statement & CTAs */}
              <div className="lg:col-span-7 space-y-6 z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-ink-950 text-white text-[10px] font-mono tracking-widest uppercase">
                  <span>ISO/IEC 17025 ACCREDITED • OIML R 76 COMPLIANT</span>
                </div>

                <h1 className="font-display font-extrabold text-4xl sm:text-6xl md:text-7xl tracking-tighter text-ink-950 uppercase leading-[0.95]">
                  PRECISION<br />
                  WITHOUT<br />
                  COMPROMISE.
                </h1>

                <p className="text-xs sm:text-sm text-ink-600 max-w-lg leading-relaxed font-sans">
                  Automated compliance verification and cryptographic certificate generation for Non-Automatic Weighing Instruments. Rigorous mathematical error boundaries (Ec ≤ ±mpe), dual-custody governance, and traceable mass standards.
                </p>

                {/* Editorial High-Contrast Buttons */}
                <div className="flex flex-wrap items-center gap-4 pt-4">
                  <Link
                    href="/login"
                    className="bg-ink-950 hover:bg-neutral-800 text-white px-8 py-4 text-xs font-bold tracking-[0.16em] uppercase transition-all shadow-editorial flex items-center gap-2"
                  >
                    <span>ENTER WORKSPACE</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>

                  <a
                    href="#public-verify"
                    className="group border border-ink-950 hover:bg-ink-950 hover:text-white text-ink-950 px-8 py-4 text-xs font-bold tracking-[0.16em] uppercase transition-all flex items-center gap-2"
                  >
                    <span>VERIFY CERTIFICATE</span>
                    <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </a>
                </div>
              </div>

              {/* Right Column: Architectural Precision Balance Graphic */}
              <div className="lg:col-span-5 flex justify-center relative">
                <div className="w-full max-w-md bg-white border border-editorial-border p-6 shadow-editorialLg relative">
                  <div className="flex items-center justify-between border-b border-editorial-border pb-3 mb-4">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-ink-500">CALIBRATION CORRIDOR</span>
                    <span className="text-[10px] font-mono font-bold text-emerald-600 uppercase">PASS: Ec ≤ ±mpe</span>
                  </div>

                  {/* Technical Graphic Preview */}
                  <div className="aspect-[4/3] bg-alabaster-100 border border-editorial-border flex flex-col justify-between p-4 relative overflow-hidden">
                    <div className="flex justify-between text-[9px] font-mono text-ink-400">
                      <span>LOAD (m)</span>
                      <span>ERROR Ec (e)</span>
                    </div>

                    {/* Tolerance Corridor Waveform Visual */}
                    <div className="relative h-24 w-full flex items-center justify-center">
                      <div className="absolute inset-x-0 top-1/2 h-[1px] bg-neutral-300" />
                      <div className="absolute inset-x-0 top-1/4 h-[1px] border-t border-dashed border-neutral-400" />
                      <div className="absolute inset-x-0 bottom-1/4 h-[1px] border-t border-dashed border-neutral-400" />
                      
                      {/* Step graph simulation */}
                      <svg className="w-full h-full text-ink-900" viewBox="0 0 200 80" fill="none">
                        <path d="M 10 40 L 40 40 L 40 35 L 80 35 L 80 44 L 130 44 L 130 38 L 190 38" stroke="currentColor" strokeWidth="2" />
                        <circle cx="40" cy="35" r="3" fill="#0A0A0A" />
                        <circle cx="80" cy="44" r="3" fill="#0A0A0A" />
                        <circle cx="130" cy="38" r="3" fill="#0A0A0A" />
                        <circle cx="190" cy="38" r="3" fill="#0A0A0A" />
                      </svg>
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono border-t border-editorial-border pt-2 text-ink-700">
                      <span>P = I + 0.5e - ΔL</span>
                      <span className="font-bold">E0 ≤ 0.25e</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-editorial-border flex items-center justify-between text-[11px]">
                    <span className="text-ink-500 font-mono">SPECIFICATION</span>
                    <span className="font-bold text-ink-950 font-display">CLASS III NAWI (MAX 15kg)</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* 2. THE JET-BLACK CATEGORY SHOWCASE STRIP (Direct Parallel to Men, Women, Kids in the reference image) */}
        <section className="bg-[#0A0A0A] text-white py-14 px-4 sm:px-8 border-y border-neutral-800">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              
              {/* Card 1: Testing Metrologist */}
              <div className="group border border-neutral-800 hover:border-neutral-600 bg-neutral-950/60 p-6 sm:p-8 flex flex-col justify-between transition-all">
                <div className="space-y-4">
                  <div className="w-12 h-12 bg-neutral-900 border border-neutral-800 flex items-center justify-center text-white mb-6 group-hover:scale-105 transition-transform">
                    <Scale className="w-5 h-5 text-neutral-300" />
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-neutral-400">
                    MODULE M1 • TESTING
                  </div>
                  <h3 className="font-display font-bold text-xl tracking-tight uppercase text-white">
                    TESTING METROLOGIST
                  </h3>
                  <p className="text-xs text-neutral-400 leading-relaxed font-sans">
                    Rigorous testing worksheets, continuous turning point computations, repeatability standard deviation, and eccentricity corner checks.
                  </p>
                </div>
                <div className="pt-6 mt-6 border-t border-neutral-900">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-neutral-300 hover:text-white transition-colors"
                  >
                    <span>LAUNCH EVALUATION</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>

              {/* Card 2: Approving Officer */}
              <div className="group border border-neutral-800 hover:border-neutral-600 bg-neutral-950/60 p-6 sm:p-8 flex flex-col justify-between transition-all">
                <div className="space-y-4">
                  <div className="w-12 h-12 bg-neutral-900 border border-neutral-800 flex items-center justify-center text-white mb-6 group-hover:scale-105 transition-transform">
                    <Award className="w-5 h-5 text-neutral-300" />
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-neutral-400">
                    MODULE M2 • AUDIT
                  </div>
                  <h3 className="font-display font-bold text-xl tracking-tight uppercase text-white">
                    APPROVING OFFICER
                  </h3>
                  <p className="text-xs text-neutral-400 leading-relaxed font-sans">
                    Enforces statutory two-man rule separation. Requires 4-digit cryptographic PIN authentication for statutory certificate issuance.
                  </p>
                </div>
                <div className="pt-6 mt-6 border-t border-neutral-900">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-neutral-300 hover:text-white transition-colors"
                  >
                    <span>VERIFICATION CONSOLE</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>

              {/* Card 3: Mass Standards Vault */}
              <div className="group border border-neutral-800 hover:border-neutral-600 bg-neutral-950/60 p-6 sm:p-8 flex flex-col justify-between transition-all">
                <div className="space-y-4">
                  <div className="w-12 h-12 bg-neutral-900 border border-neutral-800 flex items-center justify-center text-white mb-6 group-hover:scale-105 transition-transform">
                    <Database className="w-5 h-5 text-neutral-300" />
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-neutral-400">
                    MODULE M3 • TRACEABILITY
                  </div>
                  <h3 className="font-display font-bold text-xl tracking-tight uppercase text-white">
                    STANDARDS VAULT
                  </h3>
                  <p className="text-xs text-neutral-400 leading-relaxed font-sans">
                    E₁, E₂, F₁, F₂, M₁ reference weight sets with calibration certificates, expanded uncertainty k=2, and automated expiry guardrails.
                  </p>
                </div>
                <div className="pt-6 mt-6 border-t border-neutral-900">
                  <Link
                    href="/standards"
                    className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-neutral-300 hover:text-white transition-colors"
                  >
                    <span>EXPLORE STANDARDS</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* 3. SECONDARY EDITORIAL FEATURE (Parallel to "NEW SEASON / NEW VIBES") */}
        <section className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="border border-editorial-border bg-white p-8 sm:p-14">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              
              <div className="lg:col-span-6 space-y-6">
                <div className="text-[10px] font-mono tracking-[0.25em] text-ink-500 uppercase">
                  STATUTORY FRAMEWORK
                </div>

                <h2 className="font-display font-extrabold text-3xl sm:text-5xl tracking-tighter uppercase text-ink-950 leading-tight">
                  LEGAL METROLOGY<br />
                  STANDARDS ENGINE.
                </h2>

                <p className="text-xs sm:text-sm text-ink-600 leading-relaxed">
                  Conforming strictly to OIML R 76-1:2006 (Non-automatic weighing instruments — Part 1: Metrological and technical requirements) and R 76-2:2007 (Part 2: Test report format).
                </p>

                <div className="pt-2">
                  <Link
                    href="/login"
                    className="bg-ink-950 hover:bg-neutral-800 text-white px-8 py-3.5 text-xs font-bold tracking-[0.16em] uppercase inline-flex items-center gap-2 shadow-editorial transition-all"
                  >
                    <span>EXPLORE PROTOCOLS</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              <div className="lg:col-span-6 bg-alabaster-100 border border-editorial-border p-6 space-y-4">
                <div className="text-[10px] font-mono tracking-widest text-ink-500 uppercase border-b border-editorial-border pb-2 flex justify-between">
                  <span>OIML R 76 COMPLIANCE CRITERIA</span>
                  <span>STATUTORY LIMITS</span>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex items-start justify-between border-b border-editorial-border/60 pb-2">
                    <div>
                      <span className="font-bold text-ink-900 block font-mono">1. Turning Point Correction</span>
                      <span className="text-ink-500 text-[11px]">Continuous indication: P = I + 0.5e - ΔL</span>
                    </div>
                    <span className="font-mono font-bold text-ink-900 text-[11px]">Ec ≤ ±mpe</span>
                  </div>

                  <div className="flex items-start justify-between border-b border-editorial-border/60 pb-2">
                    <div>
                      <span className="font-bold text-ink-900 block font-mono">2. Tare & Zero Validation</span>
                      <span className="text-ink-500 text-[11px]">Zero-setting and tare accuracy bounds</span>
                    </div>
                    <span className="font-mono font-bold text-ink-900 text-[11px]">E0 ≤ 0.25e</span>
                  </div>

                  <div className="flex items-start justify-between border-b border-editorial-border/60 pb-2">
                    <div>
                      <span className="font-bold text-ink-900 block font-mono">3. Eccentricity Corner Test</span>
                      <span className="text-ink-500 text-[11px]">Off-center load receptor distribution (Max/3 or Max/4)</span>
                    </div>
                    <span className="font-mono font-bold text-ink-900 text-[11px]">ΔE ≤ mpe</span>
                  </div>

                  <div className="flex items-start justify-between pt-1">
                    <div>
                      <span className="font-bold text-ink-900 block font-mono">4. Repeatability (s)</span>
                      <span className="text-ink-500 text-[11px]">Standard deviation across 10 identical loads</span>
                    </div>
                    <span className="font-mono font-bold text-ink-900 text-[11px]">Pmax - Pmin ≤ mpe</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* 4. TRUST & FEATURE BADGE STRIP (Parallel to the 4 Delivery/Return Badges in Reference Image) */}
        <section className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="border-y border-editorial-border py-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            
            <div className="space-y-2">
              <div className="flex justify-center text-ink-900 mb-2">
                <Scale className="w-5 h-5" />
              </div>
              <h4 className="font-display font-bold text-xs uppercase tracking-wider text-ink-950">
                OIML R 76-1:2006
              </h4>
              <p className="text-[11px] text-ink-500 font-sans">
                Strict error limits & mathematical turning points
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-center text-ink-900 mb-2">
                <UserCheck className="w-5 h-5" />
              </div>
              <h4 className="font-display font-bold text-xs uppercase tracking-wider text-ink-950">
                DUAL CUSTODY
              </h4>
              <p className="text-[11px] text-ink-500 font-sans">
                Two-man rule with secure PIN custody
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-center text-ink-900 mb-2">
                <Award className="w-5 h-5" />
              </div>
              <h4 className="font-display font-bold text-xs uppercase tracking-wider text-ink-950">
                ISO/IEC 17025
              </h4>
              <p className="text-[11px] text-ink-500 font-sans">
                Traceable E₁, E₂, F₁, F₂, M₁ mass standards
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-center text-ink-900 mb-2">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h4 className="font-display font-bold text-xs uppercase tracking-wider text-ink-950">
                SHA-256 SEALS
              </h4>
              <p className="text-[11px] text-ink-500 font-sans">
                Tamper-proof cryptographic QR verification
              </p>
            </div>

          </div>
        </section>

        {/* 5. PUBLIC QR & CERTIFICATE VERIFIER (Minimalist Editorial Search) */}
        <section id="public-verify" className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="border border-editorial-border bg-alabaster-50 p-8 sm:p-12 text-center max-w-3xl mx-auto">
            <div className="w-10 h-10 bg-ink-950 text-white flex items-center justify-center mx-auto mb-4">
              <QrCode className="w-5 h-5" />
            </div>
            
            <h3 className="font-display font-bold text-2xl uppercase tracking-tight text-ink-950 mb-2">
              PUBLIC CERTIFICATE & QR VERIFIER
            </h3>
            
            <p className="text-xs text-ink-500 max-w-md mx-auto mb-6">
              Enter any issued certificate identifier or scan instrument QR seal to verify statutory authenticity and cryptographic SHA-256 integrity.
            </p>

            <form onSubmit={handleQuickVerify} className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-ink-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={verifySearchId}
                  onChange={(e) => setVerifySearchId(e.target.value)}
                  placeholder="e.g. rep-001 or Certificate UUID"
                  className="w-full pl-10 pr-4 py-3 bg-white border border-editorial-border text-xs font-mono text-ink-950 outline-none focus:border-ink-950 transition-colors"
                />
              </div>
              <button
                type="submit"
                className="bg-ink-950 hover:bg-neutral-800 text-white px-6 py-3 text-xs font-bold font-mono uppercase tracking-wider transition-colors cursor-pointer"
              >
                VERIFY
              </button>
            </form>
          </div>
        </section>

        {/* 6. "BEST OF METRIX" SHOWCASE (Parallel to "BEST OF GAZU" Card Row in Reference Photo) */}
        <section className="max-w-7xl mx-auto px-4 sm:px-8 space-y-6">
          <div className="flex items-center justify-between border-b border-editorial-border pb-4">
            <h3 className="font-display font-extrabold text-xl tracking-tight uppercase text-ink-950">
              INSTRUMENT REGISTRY & ACCURACY CLASSES
            </h3>
            <Link
              href="/login"
              className="text-xs font-mono uppercase tracking-wider text-ink-600 hover:text-ink-950 underline underline-offset-4"
            >
              VIEW ALL →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Card 1 */}
            <div className="bg-white border border-editorial-border p-5 group hover:border-ink-950 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[10px] font-mono mb-3">
                  <span className="px-2 py-0.5 bg-ink-950 text-white font-bold">CLASS I</span>
                  <span className="text-ink-400">SPECIAL</span>
                </div>
                <div className="h-28 bg-alabaster-100 border border-editorial-border flex items-center justify-center mb-4 group-hover:bg-alabaster-200 transition-colors">
                  <Scale className="w-8 h-8 text-ink-700" />
                </div>
                <h4 className="font-display font-bold text-sm uppercase text-ink-950">
                  Micro & Analytical
                </h4>
                <p className="text-[11px] text-ink-500 font-sans mt-1">
                  e = 1mg, n &gt; 50,000 divisions. Used with E1 and E2 class weight sets.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-editorial-border flex items-center justify-between text-[11px] font-mono">
                <span className="text-ink-400">TOLERANCE</span>
                <span className="font-bold text-ink-900">±0.5e to ±1.5e</span>
              </div>
            </div>

            {/* Card 2 */}
            <div className="bg-white border border-editorial-border p-5 group hover:border-ink-950 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[10px] font-mono mb-3">
                  <span className="px-2 py-0.5 bg-ink-950 text-white font-bold">CLASS II</span>
                  <span className="text-ink-400">HIGH</span>
                </div>
                <div className="h-28 bg-alabaster-100 border border-editorial-border flex items-center justify-center mb-4 group-hover:bg-alabaster-200 transition-colors">
                  <Cpu className="w-8 h-8 text-ink-700" />
                </div>
                <h4 className="font-display font-bold text-sm uppercase text-ink-950">
                  Precision Balances
                </h4>
                <p className="text-[11px] text-ink-500 font-sans mt-1">
                  1mg ≤ e ≤ 50mg, up to 100,000 divisions. Calibrated with F1 and F2 mass standards.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-editorial-border flex items-center justify-between text-[11px] font-mono">
                <span className="text-ink-400">TOLERANCE</span>
                <span className="font-bold text-ink-900">±0.5e to ±1.5e</span>
              </div>
            </div>

            {/* Card 3 */}
            <div className="bg-white border border-editorial-border p-5 group hover:border-ink-950 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[10px] font-mono mb-3">
                  <span className="px-2 py-0.5 bg-ink-950 text-white font-bold">CLASS III</span>
                  <span className="text-ink-400">MEDIUM</span>
                </div>
                <div className="h-28 bg-alabaster-100 border border-editorial-border flex items-center justify-center mb-4 group-hover:bg-alabaster-200 transition-colors">
                  <Activity className="w-8 h-8 text-ink-700" />
                </div>
                <h4 className="font-display font-bold text-sm uppercase text-ink-950">
                  Commercial Platforms
                </h4>
                <p className="text-[11px] text-ink-500 font-sans mt-1">
                  Bench, retail counter, and platform scales. Max capacity up to 60kg.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-editorial-border flex items-center justify-between text-[11px] font-mono">
                <span className="text-ink-400">TOLERANCE</span>
                <span className="font-bold text-ink-900">±0.5e to ±1.5e</span>
              </div>
            </div>

            {/* Card 4 */}
            <div className="bg-white border border-editorial-border p-5 group hover:border-ink-950 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[10px] font-mono mb-3">
                  <span className="px-2 py-0.5 bg-ink-950 text-white font-bold">CLASS IIII</span>
                  <span className="text-ink-400">ORDINARY</span>
                </div>
                <div className="h-28 bg-alabaster-100 border border-editorial-border flex items-center justify-center mb-4 group-hover:bg-alabaster-200 transition-colors">
                  <Layers className="w-8 h-8 text-ink-700" />
                </div>
                <h4 className="font-display font-bold text-sm uppercase text-ink-950">
                  Heavy Weighbridges
                </h4>
                <p className="text-[11px] text-ink-500 font-sans mt-1">
                  High-capacity industrial weighbridges, bulk hoppers, and truck scales.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-editorial-border flex items-center justify-between text-[11px] font-mono">
                <span className="text-ink-400">TOLERANCE</span>
                <span className="font-bold text-ink-900">±0.5e to ±1.5e</span>
              </div>
            </div>

          </div>
        </section>

      </div>
    );
  }

  // =========================================================================
  // 2. AUTHENTICATED WORKSPACE DASHBOARD (Operations Hub in Luxury Theme)
  // =========================================================================
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {error && (
        <div className="border border-neutral-900 bg-neutral-900 text-white p-4 text-xs font-mono">
          <strong>SYSTEM NOTICE:</strong> {error}
        </div>
      )}

      {/* Top Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 border border-editorial-border shadow-editorial">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display font-black text-2xl tracking-tight uppercase text-ink-950">
              OPERATIONS HUB
            </h1>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-ink-950 text-white uppercase tracking-wider">
              {role === 'TECHNICIAN' ? 'Testing Metrologist' : role === 'APPROVER' ? 'Approving Officer' : 'Lab Director'}
            </span>
          </div>
          <p className="text-xs text-ink-500 font-mono mt-1">
            ACTIVE SESSION: <span className="font-semibold text-ink-900">{user.email}</span> • DATA SCOPED UNDER AUDIT CUSTODY
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/evaluations"
            className="bg-ink-950 hover:bg-neutral-800 text-white px-5 py-2.5 text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-editorial"
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            <span>Launch Evaluation</span>
          </Link>
          <Link
            href="/verification"
            className="border border-ink-950 hover:bg-ink-950 hover:text-white text-ink-950 px-5 py-2.5 text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all"
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            <span>Verification Queue</span>
          </Link>
        </div>
      </div>

      {/* Traceability Calibration Alert */}
      {data?.expiring_standards && data.expiring_standards.length > 0 && (
        <div className="bg-white border-l-4 border-ink-950 border border-editorial-border p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-ink-950" />
            <div>
              <h4 className="text-xs font-bold uppercase font-mono tracking-wider text-ink-950">
                STANDARDS TRACEABILITY NOTICE
              </h4>
              <p className="text-xs text-ink-500">
                {data.expiring_standards.length} standard weight set(s) expiring soon (Set #{data.expiring_standards[0].set_identifier}).
              </p>
            </div>
          </div>
          <Link
            href="/standards"
            className="text-xs font-bold uppercase font-mono text-ink-950 hover:underline flex items-center gap-1"
          >
            <span>Inspect Vault</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Operational Metric Cards (Monochrome High-Contrast) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white p-5 border border-editorial-border shadow-editorial flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-ink-400 block">
              {role === 'TECHNICIAN' ? 'My Active Drafts' : 'Active Pipeline'}
            </span>
            <span className="font-display text-3xl font-black text-ink-950 block mt-1">
              {data?.metrics.active_evaluations_count ?? 0}
            </span>
            <span className="text-[11px] font-mono text-ink-500">In laboratory testing</span>
          </div>
          <div className="w-10 h-10 bg-alabaster-100 border border-editorial-border flex items-center justify-center text-ink-900">
            <Scale className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 border border-editorial-border shadow-editorial flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-ink-400 block">
              Pending Audit
            </span>
            <span className="font-display text-3xl font-black text-ink-950 block mt-1">
              {data?.metrics.pending_approval_count ?? 0}
            </span>
            <span className="text-[11px] font-mono text-ink-500">Awaiting officer sign-off</span>
          </div>
          <div className="w-10 h-10 bg-alabaster-100 border border-editorial-border flex items-center justify-center text-ink-900">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 border border-editorial-border shadow-editorial flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-ink-400 block">
              Approved Certificates
            </span>
            <span className="font-display text-3xl font-black text-ink-950 block mt-1">
              {data?.metrics.completed_approvals_month ?? 0}
            </span>
            <span className="text-[11px] font-mono text-ink-500">Cryptographic seals</span>
          </div>
          <div className="w-10 h-10 bg-alabaster-100 border border-editorial-border flex items-center justify-center text-ink-900">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 border border-editorial-border shadow-editorial flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-ink-400 block">
              Compliance Pass Rate
            </span>
            <span className="font-display text-3xl font-black text-ink-950 block mt-1">
              {data?.metrics.overall_compliance_rate_pct ?? 100}%
            </span>
            <span className="text-[11px] font-mono text-ink-500">OIML Tolerance Index</span>
          </div>
          <div className="w-10 h-10 bg-alabaster-100 border border-editorial-border flex items-center justify-center text-ink-900">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

      </div>

      {/* User-Scoped Work Queues */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Testing Metrologist Queue */}
        <div className="bg-white border border-editorial-border shadow-editorial p-6 space-y-4">
          <div className="flex justify-between items-center border-b border-editorial-border pb-3">
            <div>
              <h3 className="font-display font-bold text-sm uppercase text-ink-950">
                {role === 'TECHNICIAN' ? 'My Active Test Evaluations' : 'Technician Testing Queue'}
              </h3>
              <p className="text-xs text-ink-500">
                {role === 'TECHNICIAN' ? 'Draft reports under your custody.' : 'Active draft evaluations under test.'}
              </p>
            </div>
            <span className="text-[11px] font-mono font-bold px-2 py-0.5 bg-alabaster-200 text-ink-900 border border-editorial-border">
              {data?.technician_work_queue.length ?? 0} Tasks
            </span>
          </div>

          {loadingDashboard ? (
            <div className="py-8 text-center text-xs font-mono text-ink-400">Loading work queue...</div>
          ) : !data?.technician_work_queue || data.technician_work_queue.length === 0 ? (
            <div className="py-8 text-center text-xs font-mono text-ink-400">No active test drafts in progress.</div>
          ) : (
            <div className="divide-y divide-editorial-border">
              {data.technician_work_queue.map((item) => (
                <div key={item.id} className="py-3 flex items-center justify-between hover:bg-alabaster-100 px-2 transition-colors">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-ink-950">{item.report_number}</span>
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 bg-ink-950 text-white uppercase">
                        {item.accuracy_class}
                      </span>
                    </div>
                    <span className="text-xs font-medium text-ink-800 block mt-0.5">
                      {item.manufacturer_name} • {item.instrument_model} ({item.instrument_serial})
                    </span>
                    <span className="text-[10px] font-mono text-ink-400">
                      Updated: {formatDate(item.updated_at)}
                    </span>
                  </div>
                  <Link
                    href="/evaluations"
                    className="text-[11px] font-mono uppercase bg-ink-950 hover:bg-neutral-800 text-white px-3 py-1 font-semibold transition-colors"
                  >
                    Resume
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Approving Officer Work Queue */}
        <div className="bg-white border border-editorial-border shadow-editorial p-6 space-y-4">
          <div className="flex justify-between items-center border-b border-editorial-border pb-3">
            <div>
              <h3 className="font-display font-bold text-sm uppercase text-ink-950">
                Verification & Review Queue
              </h3>
              <p className="text-xs text-ink-500">Packets awaiting dual-custody audit and sign-off.</p>
            </div>
            <span className="text-[11px] font-mono font-bold px-2 py-0.5 bg-ink-950 text-white">
              {data?.approver_work_queue.length ?? 0} Pending
            </span>
          </div>

          {loadingDashboard ? (
            <div className="py-8 text-center text-xs font-mono text-ink-400">Loading audit queue...</div>
          ) : !data?.approver_work_queue || data.approver_work_queue.length === 0 ? (
            <div className="py-8 text-center text-xs font-mono text-ink-400">Audit queue is completely clear.</div>
          ) : (
            <div className="divide-y divide-editorial-border">
              {data.approver_work_queue.map((item) => (
                <div key={item.id} className="py-3 flex items-center justify-between hover:bg-alabaster-100 px-2 transition-colors">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-ink-950">{item.report_number}</span>
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 bg-neutral-200 text-neutral-900 border border-neutral-300 uppercase">
                        PENDING AUDIT
                      </span>
                    </div>
                    <span className="text-xs font-medium text-ink-800 block mt-0.5">
                      {item.manufacturer_name} • {item.instrument_model}
                    </span>
                    <span className="text-[10px] font-mono text-ink-400">
                      Conducted by: {item.conducted_by_name}
                    </span>
                  </div>
                  {role !== 'TECHNICIAN' && (
                    <Link
                      href="/verification"
                      className="text-[11px] font-mono uppercase bg-ink-950 hover:bg-neutral-800 text-white px-3 py-1 font-semibold transition-colors"
                    >
                      Audit
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
