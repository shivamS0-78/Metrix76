'use client';

import React from 'react';
import Link from 'next/link';
import { Scale, ArrowLeft, ShieldAlert } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4 py-16">
      <div className="max-w-md w-full bg-white border border-editorial-border p-8 shadow-editorial relative">
        {/* Top Tag */}
        <div className="flex items-center justify-between border-b border-editorial-border pb-3 mb-6">
          <span className="font-mono text-[10px] text-ink-500 uppercase tracking-widest">
            ERROR CODE // 404
          </span>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5">
            <ShieldAlert className="w-3 h-3" />
            UNRESOLVED RECORD
          </span>
        </div>

        {/* Icon & Title */}
        <div className="w-12 h-12 bg-ink-950 text-white flex items-center justify-center mx-auto mb-4">
          <Scale className="w-6 h-6 stroke-[1.5]" />
        </div>

        <h2 className="font-display font-black text-2xl uppercase tracking-tight text-ink-950 mb-2">
          Page Not Found
        </h2>
        <p className="font-mono text-xs text-ink-500 leading-relaxed mb-6">
          The requested statutory legal metrology worksheet, instrument record, or evaluation dossier does not exist or has been relocated.
        </p>

        {/* Navigation Action */}
        <div className="space-y-3 pt-2 border-t border-editorial-border">
          <Link
            href="/"
            className="w-full inline-flex items-center justify-center gap-2 bg-ink-950 text-white px-5 py-3 font-semibold text-xs uppercase tracking-wider hover:bg-neutral-800 transition-colors shadow-editorial cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Workspace Hub</span>
          </Link>
          <div className="flex items-center justify-center gap-4 text-[10px] font-mono text-ink-500 tracking-wider">
            <Link href="/evaluations" className="hover:text-ink-950 underline underline-offset-2">
              Evaluations
            </Link>
            <span>•</span>
            <Link href="/verification" className="hover:text-ink-950 underline underline-offset-2">
              Verification
            </Link>
            <span>•</span>
            <Link href="/standards" className="hover:text-ink-950 underline underline-offset-2">
              Standards
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
