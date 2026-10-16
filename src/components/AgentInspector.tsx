import React from 'react';
import { Cpu, CheckCircle2, AlertCircle, Clock, Zap, Database, ArrowRight, Shield } from 'lucide-react';
import { AgentTrace } from '../types/civic.ts';

interface AgentInspectorProps {
  currentTrace: AgentTrace | null;
}

export const AgentInspector: React.FC<AgentInspectorProps> = ({ currentTrace }) => {
  // If no trace is currently active, show a demonstration trace
  const trace: AgentTrace = currentTrace || {
    id: 'trace-demo-101',
    timestamp: new Date().toISOString(),
    rawInput:
      'There is a large pothole near Sony World Signal on 80 Feet Road in Koramangala and water is accumulating.',
    isComplete: true,
    steps: [
      {
        agentName: 'Intake & Multimodal Agent',
        action: 'Grievance Extraction & Vision Scan',
        reasoning:
          'Extracted issue category as ROADS_INFRA with HIGH urgency. Detected landmark: Sony World Signal on 80 Feet Road.',
        durationMs: 420,
        outputSummary: 'ROADS_INFRA · HIGH · Landmark: Sony World Signal',
        confidenceScore: 0.94,
      },
      {
        agentName: 'Completeness Interviewer Agent',
        action: 'Information Completeness Audit',
        reasoning:
          'All essential parameters verified (landmark, defect severity, category). No mandatory details missing.',
        durationMs: 180,
        outputSummary: '100% Complete · Ready for Dispatch',
        confidenceScore: 0.98,
      },
      {
        agentName: 'Civic RAG & Routing Agent',
        action: 'Parastatal Demarcation & SLA Lookup',
        reasoning:
          'Retrieved Bengaluru Citizen Charter. Routed grievance to BBMP Roads & Infrastructure under Ward 151 (Koramangala) with 48h resolution SLA.',
        durationMs: 290,
        outputSummary: 'Parastatal: BBMP · Ward 151 · SLA: 48h',
        confidenceScore: 0.96,
      },
      {
        agentName: 'Geospatial & Deduplication Agent',
        action: 'Haversine Proximity & Route Clustering',
        reasoning:
          'Scanned existing active complaints in Ward 151. Found adjacent pothole reports within 180m along 80 Feet Road. Tagged for field repair batching.',
        durationMs: 210,
        outputSummary: 'Unique Ticket · 3 nearby route targets',
        confidenceScore: 0.92,
      },
    ],
  };

  const totalDuration = trace.steps.reduce((acc, s) => acc + s.durationMs, 0);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="border-b border-slate-800 pb-5">
        <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-1">
          <Cpu className="w-4 h-4" />
          <span>MULTI-AGENT ORCHESTRATION PIPELINE · LIVE REASONING INSPECTOR</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Agent Reasoning & Coordination Trace
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Inspect how each specialized sub-agent (Intake, Completeness, Civic RAG, Geospatial
          Deduplication) executes in sequence to process civic grievances.
        </p>
      </div>

      {/* Execution Summary Bar */}
      <div className="bg-slate-850 border border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs text-slate-500 font-mono block">Trace Session ID</span>
          <span className="text-sm font-mono font-bold text-white">{trace.id}</span>
        </div>
        <div>
          <span className="text-xs text-slate-500 font-mono block">Pipeline Latency</span>
          <span className="text-sm font-mono font-bold text-cyan-400">{totalDuration} ms</span>
        </div>
        <div>
          <span className="text-xs text-slate-500 font-mono block">Status</span>
          <span className="text-sm font-mono font-bold text-emerald-400">
            {trace.isComplete ? 'Execution Completed' : 'Awaiting Citizen Input'}
          </span>
        </div>
        <div>
          <span className="text-xs text-slate-500 font-mono block">Model Runtime</span>
          <span className="text-sm font-mono font-bold text-slate-300">Gemini 2.5 Flash</span>
        </div>
      </div>

      {/* Raw Input Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs space-y-1.5">
        <span className="font-semibold text-slate-400 block font-mono">
          Citizen Raw Input (Voice/Text):
        </span>
        <p className="text-slate-200 font-mono italic bg-slate-950 p-3 rounded border border-slate-800">
          "{trace.rawInput}"
        </p>
      </div>

      {/* Step-by-Step Execution Sequence */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-white tracking-tight">
          Sub-Agent Reasoning Sequence
        </h2>

        <div className="space-y-4">
          {trace.steps.map((step, idx) => (
            <div
              key={idx}
              className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-3 relative overflow-hidden"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-300 flex items-center justify-center font-mono text-xs font-bold shrink-0">
                    {idx + 1}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{step.agentName}</h3>
                    <span className="text-xs font-mono text-cyan-400">{step.action}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono text-slate-400 self-end sm:self-auto">
                  {step.confidenceScore && (
                    <span className="text-emerald-400">
                      Confidence: {Math.round(step.confidenceScore * 100)}%
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{step.durationMs}ms</span>
                  </span>
                </div>
              </div>

              {/* Rationale and Output */}
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-slate-500 font-semibold block mb-0.5">
                    Agent Rationale & Thoughts:
                  </span>
                  <p className="text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded border border-slate-850">
                    {step.reasoning}
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <span className="text-slate-500 font-semibold shrink-0">Extracted Output:</span>
                  <span className="font-mono text-slate-200 bg-slate-800 px-2.5 py-1 rounded">
                    {step.outputSummary}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
