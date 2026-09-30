'use client';

import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine
} from 'recharts';
import { WeighingEvaluationResult, InstrumentMeta, AccuracyClass } from '@/types/metrology';
import { ShieldCheck, AlertTriangle, AlertOctagon } from 'lucide-react';

interface ToleranceCorridorProps {
  instrument: InstrumentMeta;
  results: WeighingEvaluationResult[];
}

/**
 * Calculates statutory Maximum Permissible Error (mpe) in scale intervals 'e'
 * per OIML R 76-1:2006 Table 6.
 */
export function calculateStatutoryMpeE(loadInE: number, accuracyClass: AccuracyClass): number {
  const m = Math.abs(loadInE);
  switch (accuracyClass) {
    case 'CLASS_I':
      if (m <= 50000) return 0.5;
      if (m <= 200000) return 1.0;
      return 1.5;
    case 'CLASS_II':
      if (m <= 5000) return 0.5;
      if (m <= 20000) return 1.0;
      return 1.5;
    case 'CLASS_III':
      if (m <= 500) return 0.5;
      if (m <= 2000) return 1.0;
      return 1.5;
    case 'CLASS_IIII':
      if (m <= 50) return 0.5;
      if (m <= 200) return 1.0;
      return 1.5;
    default:
      return 1.0;
  }
}

/**
 * Custom Dot renderer implementing the 3-state ISO/IEC 17025 compliance signaling:
 * - Emerald: Safe operational zone (|Ec| <= 0.9 * |mpe|)
 * - Amber: Tolerance warning (0.9 * |mpe| < |Ec| <= |mpe|)
 * - Rose / Pulse: Tolerance breach (|Ec| > |mpe|)
 */
const CustomToleranceDot = (props: any) => {
  const { cx, cy, payload } = props;
  if (!cx || !cy || payload?.correctedErrorEc === null || payload?.correctedErrorEc === undefined) {
    return null;
  }

  const ec = Math.abs(payload.correctedErrorEc);
  const mpe = Math.abs(payload.mpeAllowed || payload.upperMpe);
  const ratio = mpe > 0 ? ec / mpe : 0;

  let fill = '#10b981'; // Emerald Safe
  let stroke = '#047857';
  let isBreach = false;
  let isWarning = false;

  if (ratio > 1.0) {
    fill = '#ef4444'; // Rose Breach
    stroke = '#b91c1c';
    isBreach = true;
  } else if (ratio > 0.9) {
    fill = '#f59e0b'; // Amber Warning
    stroke = '#d97706';
    isWarning = true;
  }

  return (
    <g>
      {isBreach && (
        <circle
          cx={cx}
          cy={cy}
          r={9}
          fill="none"
          stroke="#ef4444"
          strokeWidth={1.5}
          opacity={0.7}
          className="animate-ping"
        />
      )}
      <circle
        cx={cx}
        cy={cy}
        r={isBreach ? 6 : isWarning ? 5 : 4.5}
        fill={fill}
        stroke={stroke}
        strokeWidth={1.5}
      />
    </g>
  );
};

export default function ToleranceCorridor({ instrument, results }: ToleranceCorridorProps) {
  const { e, unit, maxCap, accuracyClass } = useMemo(() => {
    const eVal = instrument.verification_interval_e || 1;
    const maxVal = instrument.max_capacity || 1000;
    const cls = instrument.accuracy_class || 'CLASS_III';
    return {
      e: eVal,
      unit: instrument.unit || 'g',
      maxCap: maxVal,
      accuracyClass: cls
    };
  }, [instrument]);

  // Generate synthetic stepped corridor vertices aligned with OIML Table 6 transition boundaries
  const chartData = useMemo(() => {
    const transitionMultipliers: Record<AccuracyClass, number[]> = {
      CLASS_I: [50000, 200000],
      CLASS_II: [5000, 20000],
      CLASS_III: [500, 2000],
      CLASS_IIII: [50, 200],
    };

    const rawSteps = transitionMultipliers[accuracyClass] || [500, 2000];
    const boundaryLoads = rawSteps
      .map((mult) => mult * e)
      .filter((load) => load < maxCap);

    // Merge observation loads and corridor boundary steps
    const sampleLoads = new Set<number>([0, ...boundaryLoads, maxCap]);
    results.forEach((r) => sampleLoads.add(r.load_applied));

    const sortedLoads = Array.from(sampleLoads).sort((a, b) => a - b);

    return sortedLoads.map((load) => {
      const loadInE = load / e;
      const mpeAllowedE = calculateStatutoryMpeE(loadInE, accuracyClass);
      const mpeAllowedEngineering = mpeAllowedE * e;

      // Find observed results matching this load
      const incRes = results.find((r) => r.direction === 'INCREASING' && Math.abs(r.load_applied - load) < 1e-6);
      const decRes = results.find((r) => r.direction === 'DECREASING' && Math.abs(r.load_applied - load) < 1e-6);
      const staticRes = results.find((r) => r.direction === 'STATIC' && Math.abs(r.load_applied - load) < 1e-6);
      const anyRes = incRes || decRes || staticRes;

      return {
        load,
        loadInE: Number(loadInE.toFixed(2)),
        upperMpe: mpeAllowedEngineering,
        lowerMpe: -mpeAllowedEngineering,
        mpeAllowed: mpeAllowedEngineering,
        increasingEc: incRes ? incRes.corrected_error_ec : null,
        decreasingEc: decRes ? decRes.corrected_error_ec : null,
        correctedErrorEc: anyRes ? anyRes.corrected_error_ec : null,
        observation: anyRes || null,
      };
    });
  }, [accuracyClass, e, maxCap, results]);

  // Metrics summary
  const summary = useMemo(() => {
    let safeCount = 0;
    let warnCount = 0;
    let breachCount = 0;
    let maxRatio = 0;

    results.forEach((r) => {
      const mpeE = calculateStatutoryMpeE(r.load_applied / e, accuracyClass);
      const mpeEng = mpeE * e;
      const ratio = mpeEng > 0 ? Math.abs(r.corrected_error_ec) / mpeEng : 0;
      if (ratio > maxRatio) maxRatio = ratio;

      if (ratio > 1.0) breachCount++;
      else if (ratio > 0.9) warnCount++;
      else safeCount++;
    });

    return {
      safeCount,
      warnCount,
      breachCount,
      maxRatioPct: (maxRatio * 100).toFixed(1),
      isCompliant: breachCount === 0
    };
  }, [results, e, accuracyClass]);

  return (
    <div className="bg-white p-6 border border-editorial-border shadow-editorial space-y-4">
      {/* Header & Status Badges */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-editorial-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-display font-black text-xs uppercase tracking-wider text-ink-950">
              METROLOGICAL ERROR CORRIDOR & STATUTORY ±mpe ENVELOPES
            </h3>
            <span className="px-2 py-0.5 bg-ink-950 text-white font-mono text-[10px] font-bold uppercase tracking-wider">
              OIML R 76-1 ({accuracyClass.replace('_', ' ')})
            </span>
          </div>
          <p className="text-[11px] font-mono text-ink-500 uppercase mt-0.5">
            DYNAMIC STEP-LINE ENVELOPES PLOTTING ±0.5e, ±1.0e, AND ±1.5e WITH REAL-TIME COMPLIANCE SIGNALING
          </p>
        </div>

        {/* Legend Pills */}
        <div className="flex items-center gap-3 text-[10px] font-mono uppercase font-bold tracking-wider">
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-editorial-border text-ink-900">
            <span className="w-2 h-2 bg-emerald-600 inline-block"></span>
            SAFE (≤90%): {summary.safeCount}
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-editorial-border text-ink-900">
            <span className="w-2 h-2 bg-amber-500 inline-block"></span>
            WARNING (90-100%): {summary.warnCount}
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-editorial-border text-ink-900">
            <span className="w-2 h-2 bg-rose-600 inline-block animate-pulse"></span>
            BREACH (&gt;100%): {summary.breachCount}
          </span>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="w-full h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 15, bottom: 25 }}>
            <CartesianGrid strokeDasharray="2 2" stroke="#E2E2DE" vertical={false} />
            <XAxis
              dataKey="load"
              unit={` ${unit}`}
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              label={{
                value: `Applied Test Load L [${unit}] (e = ${e} ${unit})`,
                position: 'insideBottom',
                offset: -15,
                fontSize: 11,
                fill: '#475569',
                fontWeight: 600
              }}
            />
            <YAxis
              unit={` ${unit}`}
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              label={{
                value: `Corrected Error Ec [${unit}]`,
                angle: -90,
                position: 'insideLeft',
                offset: 5,
                fontSize: 11,
                fill: '#475569',
                fontWeight: 600
              }}
            />
            <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" strokeWidth={1} />

            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null;
                const pointData = payload[0]?.payload;
                const obs = pointData?.observation;
                const upperMpe = pointData?.upperMpe;
                const ec = obs ? obs.corrected_error_ec : pointData?.correctedErrorEc;

                return (
                  <div className="bg-ink-950 text-white p-4 border border-neutral-800 text-xs space-y-2.5 min-w-[240px] font-mono shadow-editorial">
                    <div className="flex items-center justify-between border-b border-neutral-800 pb-1.5 font-bold">
                      <span className="text-[10px] text-neutral-400 uppercase tracking-wider">Applied Load (L):</span>
                      <span className="font-bold text-white">
                        {label} {unit}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-[11px] text-neutral-300">
                      {obs && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-neutral-400">Observed Indication (I):</span>
                            <span className="text-white font-bold">{obs.indication_observed} {unit}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-neutral-400">Turning Point (P):</span>
                            <span className="text-white font-bold">{obs.calculated_p?.toFixed(4)} {unit}</span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between">
                        <span className="text-neutral-400">Corrected Error (Ec):</span>
                        <span className="font-bold text-white">
                          {ec !== null && ec !== undefined ? `${ec > 0 ? '+' : ''}${ec.toFixed(4)} ${unit}` : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-400">Statutory Margin (±mpe):</span>
                        <span className="font-bold text-neutral-200">±{upperMpe?.toFixed(4)} {unit}</span>
                      </div>
                    </div>

                    {ec !== null && ec !== undefined && upperMpe && (
                      <div className="pt-2 border-t border-neutral-800 flex items-center justify-between font-bold text-[10px] uppercase tracking-wider">
                        <span className="text-neutral-400">Tolerance Ratio:</span>
                        <span
                          className={
                            Math.abs(ec) > upperMpe
                              ? 'text-rose-400'
                              : Math.abs(ec) > 0.9 * upperMpe
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }
                        >
                          {((Math.abs(ec) / upperMpe) * 100).toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </div>
                );
              }}
            />

            {/* Stepped Upper and Lower MPE Tolerance Lines */}
            <Line
              type="stepAfter"
              dataKey="upperMpe"
              stroke="#DC2626"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              dot={false}
              name="Upper statutory +mpe"
              isAnimationActive={false}
            />
            <Line
              type="stepAfter"
              dataKey="lowerMpe"
              stroke="#DC2626"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              dot={false}
              name="Lower statutory -mpe"
              isAnimationActive={false}
            />

            {/* Increasing Vector Curve with Custom Status Dot */}
            <Line
              type="monotone"
              dataKey="increasingEc"
              stroke="#0A0A0A"
              strokeWidth={2}
              dot={<CustomToleranceDot />}
              activeDot={{ r: 6, stroke: '#0A0A0A', strokeWidth: 2 }}
              name="Increasing Run (▲)"
              connectNulls
            />

            {/* Decreasing Vector Curve with Custom Status Dot */}
            <Line
              type="monotone"
              dataKey="decreasingEc"
              stroke="#525252"
              strokeWidth={1.5}
              strokeDasharray="3 3"
              dot={<CustomToleranceDot />}
              activeDot={{ r: 6, stroke: '#525252', strokeWidth: 2 }}
              name="Decreasing Run (▼)"
              connectNulls
            />

            <Legend
              verticalAlign="top"
              height={36}
              wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', paddingBottom: '12px' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Compliance Health Banner */}
      <div
        className={`p-4 border flex items-center justify-between text-xs font-mono uppercase tracking-wide ${
          summary.isCompliant
            ? 'bg-white border-emerald-300 text-emerald-900 shadow-editorial'
            : 'bg-neutral-900 border-neutral-900 text-white shadow-editorial'
        }`}
      >
        <div className="flex items-center gap-3">
          {summary.isCompliant ? (
            <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertOctagon className="w-4 h-4 text-rose-500 flex-shrink-0" />
          )}
          <span>
            {summary.isCompliant
              ? 'ALL OBSERVED WEIGHING POINTS RESIDE STRICTLY WITHIN STATUTORY OIML R 76 ERROR ENVELOPES.'
              : `TOLERANCE BREACH: ${summary.breachCount} TEST POINT(S) EXCEED MAXIMUM STATUTORY PERMISSIBLE ERROR LIMITS.`}
          </span>
        </div>
        <div className="font-mono text-xs font-bold pl-4">
          PEAK MARGIN: {summary.maxRatioPct}%
        </div>
      </div>
    </div>
  );
}
