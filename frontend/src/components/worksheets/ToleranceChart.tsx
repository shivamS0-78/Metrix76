'use client';

import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine
} from 'recharts';
import { WeighingEvaluationResult, InstrumentMeta } from '@/types/metrology';
import { getMPE } from '@/lib/metrology/r76';

interface ToleranceChartProps {
  instrument: InstrumentMeta;
  results: WeighingEvaluationResult[];
}

export default function ToleranceChart({ instrument, results }: ToleranceChartProps) {
  const maxCap = instrument.max_capacity;

  // Build continuous envelope points
  const sortedLoads = Array.from(new Set([0, ...results.map((r) => r.load_applied), maxCap])).sort((a, b) => a - b);
  
  const chartData = sortedLoads.map((load) => {
    const mpe = getMPE(load, instrument);
    const matchingRes = results.find((r) => Math.abs(r.load_applied - load) < 1e-6);
    return {
      load,
      upperMpe: mpe,
      lowerMpe: -mpe,
      correctedErrorEc: matchingRes ? matchingRes.corrected_error_ec : null,
      status: matchingRes ? matchingRes.status : null,
      direction: matchingRes ? matchingRes.direction : null,
    };
  });

  return (
    <div className="bg-white p-6 border border-editorial-border shadow-editorial space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-editorial-border gap-3">
        <div>
          <h3 className="font-display font-black text-xs uppercase tracking-wider text-ink-950">
            DYNAMIC ERROR ENVELOPE & STATUTORY MPE CORRIDOR
          </h3>
          <p className="text-[11px] font-mono text-ink-500 uppercase mt-0.5">
            REAL-TIME COMPARISON OF CORRECTED ERROR (Ec) AGAINST STATUTORY ±mpe BOUNDARIES (OIML R 76-1)
          </p>
        </div>
        <div className="flex items-center gap-4 text-[10px] font-mono uppercase font-bold tracking-wider">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-emerald-600 inline-block"></span> CONFORMING
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-amber-500 inline-block"></span> NEAR LIMIT (&gt;90%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-rose-600 inline-block"></span> EXCEEDED (FAIL)
          </span>
        </div>
      </div>

      <div className="w-full h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 15, right: 30, left: 10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="2 2" stroke="#E2E2DE" />
            <XAxis
              dataKey="load"
              unit={` ${instrument.unit}`}
              stroke="#737373"
              fontSize={10}
              tickLine={false}
              label={{ value: `APPLIED LOAD L [${instrument.unit}]`, position: 'insideBottom', offset: -10, fontSize: 10, fill: '#737373', fontFamily: 'monospace' }}
            />
            <YAxis
              unit={` ${instrument.unit}`}
              stroke="#737373"
              fontSize={10}
              tickLine={false}
              label={{ value: `Ec [${instrument.unit}]`, angle: -90, position: 'insideLeft', fontSize: 10, fill: '#737373', fontFamily: 'monospace' }}
            />
            <Tooltip
              formatter={(val: any, name: string) => [
                typeof val === 'number' ? `${val.toFixed(5)} ${instrument.unit}` : val,
                name === 'upperMpe' ? '+mpe (Upper)' : name === 'lowerMpe' ? '-mpe (Lower)' : 'Corrected Error Ec'
              ]}
              labelFormatter={(label) => `LOAD: ${label} ${instrument.unit}`}
              contentStyle={{ backgroundColor: '#0A0A0A', color: '#FFFFFF', borderRadius: '0px', border: '1px solid #262626', fontSize: '10px', fontFamily: 'monospace' }}
            />
            <ReferenceLine y={0} stroke="#A3A3A3" strokeDasharray="3 3" />

            {/* Statutory ±mpe tolerance step lines */}
            <Line
              type="stepAfter"
              dataKey="upperMpe"
              stroke="#DC2626"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              dot={false}
              name="+mpe Corridor"
            />
            <Line
              type="stepAfter"
              dataKey="lowerMpe"
              stroke="#DC2626"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              dot={false}
              name="-mpe Corridor"
            />

            {/* Observed Error Points */}
            <Line
              type="monotone"
              dataKey="correctedErrorEc"
              stroke="#0A0A0A"
              strokeWidth={2}
              dot={{ r: 4, fill: '#0A0A0A' }}
              activeDot={{ r: 6 }}
              name="Corrected Error (Ec)"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
