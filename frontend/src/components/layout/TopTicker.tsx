'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/authContext';

export default function TopTicker() {
  const { user, role } = useAuth();

  return (
    <div className="bg-[#0A0A0A] text-[#8E8E8E] text-[10px] tracking-[0.2em] uppercase py-2 px-4 sm:px-8 border-b border-neutral-900 flex flex-col sm:flex-row items-center justify-between gap-1 z-50">
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="font-mono text-neutral-300">STATUTORY LEGAL METROLOGY LIMS</span>
        <span className="text-neutral-600 hidden sm:inline">•</span>
        <span className="hidden sm:inline text-neutral-400">ISO/IEC 17025 ACCREDITED</span>
        <span className="text-neutral-600 hidden sm:inline">•</span>
        <span className="hidden sm:inline text-neutral-400">OIML R 76-1:2006</span>
      </div>
      <div className="flex items-center gap-4 text-[10px] text-neutral-400 font-mono tracking-widest">
        {user ? (
          <>
            <Link href="/standards" className="hover:text-white transition-colors">STANDARDS VAULT</Link>
            {role !== 'APPROVER' && (
              <>
                <span className="text-neutral-700">|</span>
                <Link href="/evaluations" className="hover:text-white transition-colors">EVALUATIONS</Link>
              </>
            )}
            {role !== 'TECHNICIAN' && (
              <>
                <span className="text-neutral-700">|</span>
                <Link href="/verification" className="hover:text-white transition-colors">VERIFICATION QUEUE</Link>
              </>
            )}
            <span className="text-neutral-700">|</span>
            <Link href="/archive" className="hover:text-white transition-colors">SEAL REGISTRY</Link>
          </>
        ) : (
          <Link href="/login" className="hover:text-white transition-colors">OFFICER SIGN IN</Link>
        )}
      </div>
    </div>
  );
}
