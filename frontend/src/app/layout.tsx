import type { Metadata } from 'next';
import './globals.css';
import TopTicker from '@/components/layout/TopTicker';
import Navbar from '@/components/layout/Navbar';
import { AuthProvider } from '@/lib/authContext';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'METRIX 76 | NAWI OIML R 76 Type Approval & LIMS',
  description: 'Statutory Legal Metrology LIMS and Precision Verification conforming to OIML R 76-1 / R 76-2',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className="bg-alabaster-100 text-ink-900 min-h-screen antialiased flex flex-col font-sans selection:bg-ink-900 selection:text-white">
        <AuthProvider>
          <TopTicker />
          <Navbar />

          <main className="flex-1 w-full mx-auto">
            {children}
          </main>

          {/* Luxury Editorial Footer */}
          <footer className="border-t border-editorial-border bg-alabaster-200/80 text-ink-600 mt-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
                <div className="space-y-3">
                  <div className="font-display font-extrabold text-xl tracking-tighter text-ink-950">
                    METRIX 76
                  </div>
                  <p className="text-xs text-ink-500 leading-relaxed max-w-xs">
                    Statutory automated type approval & verification platform for Non-Automatic Weighing Instruments conforming to OIML R 76-1 / R 76-2 standards.
                  </p>
                </div>

                <div>
                  <h4 className="text-[10px] font-bold tracking-[0.2em] uppercase text-ink-900 mb-3">
                    COMPLIANCE MODULES
                  </h4>
                  <ul className="space-y-2 text-xs text-ink-500 font-medium">
                    <li><Link href="/evaluations" className="hover:text-ink-950 transition-colors">M1: Turning Point Math Engine</Link></li>
                    <li><Link href="/verification" className="hover:text-ink-950 transition-colors">M2: Two-Man Rule Dual Custody</Link></li>
                    <li><Link href="/standards" className="hover:text-ink-950 transition-colors">M3: Mass Standards Traceability</Link></li>
                    <li><Link href="/archive" className="hover:text-ink-950 transition-colors">M4: SHA-256 Audit Repository</Link></li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-[10px] font-bold tracking-[0.2em] uppercase text-ink-900 mb-3">
                    STATUTORY STANDARDS
                  </h4>
                  <ul className="space-y-2 text-xs text-ink-500 font-medium">
                    <li>OIML R 76-1 (2006) Metrological Req.</li>
                    <li>OIML R 76-2 (2007) Test Report Format</li>
                    <li>Legal Metrology Act, 2009 (India)</li>
                    <li>ISO/IEC 17025 Calibration Rigor</li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-[10px] font-bold tracking-[0.2em] uppercase text-ink-900 mb-3">
                    SECURITY & INTEGRITY
                  </h4>
                  <div className="p-3 bg-white border border-editorial-border rounded-lg space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-ink-500">Dual-Custody:</span>
                      <span className="font-bold text-ink-950">ENFORCED</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-ink-500">Hash Algorithm:</span>
                      <span className="font-bold text-ink-950">SHA-256</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-ink-500">Seal Status:</span>
                      <span className="font-bold text-emerald-600">VALIDATED</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-editorial-border flex flex-col sm:flex-row items-center justify-between text-[11px] text-ink-400 gap-2">
                <p>© 2026 METRIX 76 • NATIONAL METROLOGY & TYPE APPROVAL LIMS</p>
                <p className="font-mono text-[10px] tracking-wider uppercase">ALL RIGHTS RESERVED • STATUTORY LABORATORY SYSTEM</p>
              </div>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
