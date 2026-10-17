import React from 'react';
import { ShieldAlert, RefreshCw, Cpu, Database, Compass, Layers, Presentation } from 'lucide-react';
import { UserRole } from '../types/civic.ts';
import { RoleSwitcher } from './RoleSwitcher.tsx';

interface HeaderProps {
  activeTab: 'copilot' | 'command' | 'ward-triage' | 'inspector' | 'ward-map';
  setActiveTab: (tab: 'copilot' | 'command' | 'ward-triage' | 'inspector' | 'ward-map') => void;
  onSeedData: () => void;
  isSeeding: boolean;
  complaintCount: number;
  currentRole: UserRole;
  onSelectRole: (role: UserRole) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onSeedData,
  isSeeding,
  complaintCount,
  currentRole,
  onSelectRole,
}) => {
  return (
    <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold">
            <ShieldAlert className="w-5 h-5 text-cyan-400" />
          </div>
          <span className="text-lg font-bold tracking-tight text-white whitespace-nowrap">
            CivicPulse
          </span>
          <span className="text-xs font-mono text-slate-400 hidden xl:inline">
            Bengaluru Ward Intelligence
          </span>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1 sm:gap-1.5">
          <button
            onClick={() => setActiveTab('copilot')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'copilot'
                ? 'bg-slate-800 text-cyan-400 shadow-sm border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            Citizen Copilot
          </button>
          <button
            onClick={() => setActiveTab('ward-map')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'ward-map'
                ? 'bg-slate-800 text-cyan-400 shadow-sm border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span>BBMP Ward Map</span>
          </button>
          <button
            onClick={() => setActiveTab('command')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'command'
                ? 'bg-slate-800 text-cyan-400 shadow-sm border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <span>Command Center</span>
            {complaintCount > 0 && (
              <span className="font-mono text-[11px] px-1.5 py-0.2 bg-cyan-950 text-cyan-300 rounded border border-cyan-800">
                {complaintCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('ward-triage')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'ward-triage'
                ? 'bg-slate-800 text-cyan-400 shadow-sm border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            Ward Triage
          </button>
          <button
            onClick={() => setActiveTab('inspector')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'inspector'
                ? 'bg-slate-800 text-cyan-400 shadow-sm border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Inspector</span>
          </button>
        </nav>

        {/* Zone 3: Role Switcher & Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Interactive Role Switcher */}
          <RoleSwitcher currentRole={currentRole} onSelectRole={onSelectRole} />

          {/* Seed Data Button */}
          {currentRole !== 'CITIZEN' && (
            <button
              onClick={onSeedData}
              disabled={isSeeding}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 transition-all disabled:opacity-50 whitespace-nowrap shadow-sm"
              title="Seed realistic historical complaints and emerging anomaly clusters into Firestore"
            >
              {isSeeding ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
              ) : (
                <Database className="w-3.5 h-3.5 text-cyan-400" />
              )}
              <span>{isSeeding ? 'Seeding...' : 'Seed Data'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile navigation row */}
      <div className="lg:hidden flex items-center justify-around border-t border-slate-800 py-2 px-3 text-xs bg-slate-900/80 overflow-x-auto gap-1">
        <button
          onClick={() => setActiveTab('copilot')}
          className={`py-1 px-2 rounded whitespace-nowrap ${
            activeTab === 'copilot' ? 'text-cyan-400 font-semibold bg-slate-800' : 'text-slate-400'
          }`}
        >
          Copilot
        </button>
        <button
          onClick={() => setActiveTab('ward-map')}
          className={`py-1 px-2 rounded whitespace-nowrap ${
            activeTab === 'ward-map' ? 'text-cyan-400 font-semibold bg-slate-800' : 'text-slate-400'
          }`}
        >
          Ward Map
        </button>
        <button
          onClick={() => setActiveTab('command')}
          className={`py-1 px-2 rounded whitespace-nowrap ${
            activeTab === 'command' ? 'text-cyan-400 font-semibold bg-slate-800' : 'text-slate-400'
          }`}
        >
          Command ({complaintCount})
        </button>
        <button
          onClick={() => setActiveTab('ward-triage')}
          className={`py-1 px-2 rounded whitespace-nowrap ${
            activeTab === 'ward-triage' ? 'text-cyan-400 font-semibold bg-slate-800' : 'text-slate-400'
          }`}
        >
          Triage
        </button>
        <button
          onClick={() => setActiveTab('inspector')}
          className={`py-1 px-2 rounded whitespace-nowrap ${
            activeTab === 'inspector' ? 'text-cyan-400 font-semibold bg-slate-800' : 'text-slate-400'
          }`}
        >
          Inspector
        </button>
      </div>
    </header>
  );
};
