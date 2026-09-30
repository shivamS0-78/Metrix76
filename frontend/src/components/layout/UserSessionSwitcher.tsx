'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useAuth, UserRole } from '@/lib/authContext';
import { 
  User, 
  ChevronDown, 
  Shield, 
  LogIn, 
  LogOut, 
  Wrench, 
  Award
} from 'lucide-react';

const ROLE_BADGES: Record<UserRole, { label: string; badge: string; icon: React.ElementType }> = {
  TECHNICIAN: {
    label: 'Testing Metrologist',
    badge: 'bg-neutral-100 text-neutral-900 border-neutral-300',
    icon: Wrench,
  },
  APPROVER: {
    label: 'Approving Officer',
    badge: 'bg-neutral-900 text-white border-neutral-900',
    icon: Award,
  },
  ADMIN: {
    label: 'Lab Director',
    badge: 'bg-neutral-800 text-neutral-100 border-neutral-700',
    icon: Shield,
  },
};

export default function UserSessionSwitcher() {
  const { user, role, signOut, loading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loading) {
    return <div className="text-[11px] font-mono text-neutral-400">Loading session...</div>;
  }

  // If user is not authenticated, show direct Sign In button (Luxury monochrome style)
  if (!user) {
    return (
      <Link
        href="/login"
        className="bg-ink-950 hover:bg-neutral-800 text-white font-semibold px-4 py-2 text-xs tracking-wider uppercase transition-all shadow-editorial flex items-center gap-1.5"
      >
        <LogIn className="w-3.5 h-3.5" />
        <span>Sign In</span>
      </Link>
    );
  }

  const roleMeta = role ? ROLE_BADGES[role] : ROLE_BADGES.TECHNICIAN;
  const RoleIcon = roleMeta.icon;
  const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Officer';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 bg-white hover:bg-alabaster-200 border border-editorial-border py-1.5 px-3 rounded-none text-xs transition-all shadow-editorial cursor-pointer group"
      >
        <div className="w-6 h-6 bg-ink-950 text-white flex items-center justify-center font-bold text-[10px] uppercase">
          {displayName.slice(0, 2)}
        </div>
        <div className="text-left hidden sm:block">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-ink-950 text-[11px] leading-tight truncate max-w-[130px]">
              {displayName}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          </div>
          <span className="text-[9px] font-mono text-ink-500 uppercase tracking-wider block leading-tight">
            {role || 'TECHNICIAN'}
          </span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-neutral-400 group-hover:text-ink-950 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white border border-editorial-border p-4 z-50 shadow-editorialLg animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="p-3 bg-alabaster-100 border border-editorial-border mb-3">
            <p className="text-xs font-bold text-ink-950 truncate uppercase tracking-tight">
              {displayName}
            </p>
            <p className="text-[11px] font-mono text-ink-500 truncate mt-0.5">
              {user.email}
            </p>
            <div className="mt-2.5 flex items-center gap-1.5">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider border ${roleMeta.badge}`}>
                <RoleIcon className="w-3 h-3" />
                {roleMeta.label}
              </span>
            </div>
          </div>

          <div className="border-t border-editorial-border pt-3 flex items-center justify-between">
            <Link
              href="/login"
              onClick={() => setIsOpen(false)}
              className="text-[11px] text-ink-600 hover:text-ink-950 font-semibold tracking-wider uppercase flex items-center gap-1 p-1 transition-colors"
            >
              <User className="w-3 h-3" />
              <span>Switch Account</span>
            </Link>

            <button
              type="button"
              onClick={async () => {
                await signOut();
                setIsOpen(false);
              }}
              className="text-[11px] text-neutral-500 hover:text-rose-600 font-semibold tracking-wider uppercase flex items-center gap-1 p-1 cursor-pointer transition-colors"
            >
              <LogOut className="w-3 h-3" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
