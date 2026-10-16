import React from 'react';
import { ShieldAlert, RefreshCw, Cpu, Database } from 'lucide-react';

interface HeaderProps {
  activeTab: 'copilot' | 'command' | 'ward-triage' | 'inspector';
  setActiveTab: (tab: 'copilot' | 'command' | 'ward-triage' | 'inspector') => void;
  onSeedData: () => void;
  isSeeding: boolean;
  complaintCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onSeedData,
  isSeeding,
  complaintCount,
}) => {
  return (
    <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark (Single element, no pills attached) */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold">
            <ShieldAlert className="w-5 h-5 text-cyan-400" />
          </div>
          <span className="text-lg font-bold tracking-tight text-white whitespace-nowrap">
            BBMP CivicPulse
          </span>
          <span className="text-xs font-mono text-slate-400 hidden sm:inline">
            Bengaluru Ward Intelligence
          </span>
        </div>

        {/* Zone 2: Navigation Links (Single line, text with active states) */}
        <nav className="hidden md:flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => setActiveTab('copilot')}
            className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'copilot'
                ? 'bg-slate-800 text-cyan-400 shadow-sm border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            Citizen Copilot
          </button>
          <button
            onClick={() => setActiveTab('command')}
            className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'command'
                ? 'bg-slate-800 text-cyan-400 shadow-sm border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <span>City Command Center</span>
            {complaintCount > 0 && (
              <span className="font-mono text-xs px-1.5 py-0.2 bg-cyan-950 text-cyan-300 rounded border border-cyan-800">
                {complaintCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('ward-triage')}
            className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'ward-triage'
                ? 'bg-slate-800 text-cyan-400 shadow-sm border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            Ward Triage
          </button>
          <button
            onClick={() => setActiveTab('inspector')}
            className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'inspector'
                ? 'bg-slate-800 text-cyan-400 shadow-sm border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Agent Inspector</span>
          </button>
        </nav>

        {/* Zone 3: Primary Action Button */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onSeedData}
            disabled={isSeeding}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition-all disabled:opacity-50 whitespace-nowrap shadow-sm shadow-cyan-950"
            title="Seed realistic historical complaints and emerging anomaly clusters into Firestore"
          >
            {isSeeding ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Database className="w-3.5 h-3.5" />
            )}
            <span>{isSeeding ? 'Seeding...' : 'Seed Live Data'}</span>
          </button>
        </div>
      </div>

      {/* Mobile navigation row */}
      <div className="md:hidden flex items-center justify-around px-2 py-2 border-t border-slate-800 bg-slate-900 text-xs">
        <button
          onClick={() => setActiveTab('copilot')}
          className={`py-1 px-2 rounded ${activeTab === 'copilot' ? 'text-cyan-400 font-semibold' : 'text-slate-400'}`}
        >
          Copilot
        </button>
        <button
          onClick={() => setActiveTab('command')}
          className={`py-1 px-2 rounded ${activeTab === 'command' ? 'text-cyan-400 font-semibold' : 'text-slate-400'}`}
        >
          Command Center ({complaintCount})
        </button>
        <button
          onClick={() => setActiveTab('ward-triage')}
          className={`py-1 px-2 rounded ${activeTab === 'ward-triage' ? 'text-cyan-400 font-semibold' : 'text-slate-400'}`}
        >
          Ward Triage
        </button>
        <button
          onClick={() => setActiveTab('inspector')}
          className={`py-1 px-2 rounded ${activeTab === 'inspector' ? 'text-cyan-400 font-semibold' : 'text-slate-400'}`}
        >
          Inspector
        </button>
      </div>
    </header>
  );
};
