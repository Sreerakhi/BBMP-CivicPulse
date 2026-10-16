import React from 'react';
import { Building2, MapPin, AlertTriangle, CheckCircle2, TrendingUp, Layers } from 'lucide-react';
import { Complaint } from '../types/civic.ts';

interface WardTriageProps {
  complaints: Complaint[];
  onSelectWardFilter?: (ward: string) => void;
}

export const WardTriage: React.FC<WardTriageProps> = ({ complaints }) => {
  const wards = [
    {
      name: 'Koramangala',
      number: 151,
      zone: 'South Zone',
      keyStreets: ['80 Feet Road', '100 Feet Road', 'Sony World Signal', '4th & 5th Block'],
      pin: '560034',
    },
    {
      name: 'Indiranagar',
      number: 112,
      zone: 'East Zone',
      keyStreets: ['100 Feet Road', 'CMH Road', '12th Main', 'Defence Colony'],
      pin: '560038',
    },
    {
      name: 'HSR Layout',
      number: 174,
      zone: 'Bommanahalli Zone',
      keyStreets: ['27th Main Road', 'Sector 1 to 7', 'Agara Lake Junction'],
      pin: '560102',
    },
    {
      name: 'Adugodi',
      number: 89,
      zone: 'South Zone',
      keyStreets: ['Dairy Circle', 'Hosur Road', 'Bosch Gate Corridor'],
      pin: '560030',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="border-b border-slate-800 pb-5">
        <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-1">
          <Building2 className="w-4 h-4" />
          <span>WARD-WISE CONSTITUENCY TRIAGE & GIS DEMARCATION</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Bengaluru Ward Intelligence Matrix
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Compare grievance density, parastatal dispatch response times, and road repair corridors
          across representative municipal wards.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {wards.map(ward => {
          const wardComplaints = complaints.filter(c => c.ward.includes(ward.name));
          const totalCount = wardComplaints.reduce((acc, c) => acc + 1 + (c.duplicateCount || 0), 0);
          const activeCount = wardComplaints.filter(
            c => c.status !== 'RESOLVED' && c.status !== 'CLOSED'
          ).length;
          const emergencyCount = wardComplaints.filter(c => c.urgency === 'EMERGENCY').length;

          // Category distribution
          const catCounts: Record<string, number> = {};
          wardComplaints.forEach(c => {
            catCounts[c.category] = (catCounts[c.category] || 0) + 1;
          });
          const topCategory = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'ROADS_INFRA';

          return (
            <div
              key={ward.number}
              className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5"
            >
              <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                <div>
                  <span className="font-mono text-xs text-cyan-400 font-bold block">
                    Ward {ward.number} · {ward.zone}
                  </span>
                  <h2 className="text-xl font-bold text-white mt-0.5">{ward.name}</h2>
                  <span className="text-xs text-slate-400">Pincode: {ward.pin}</span>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-extrabold text-white font-mono tabular-nums">
                    {totalCount}
                  </span>
                  <span className="text-xs text-slate-400 block">Total Grievances</span>
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-850">
                  <span className="text-xs text-slate-400 block">Active Tickets</span>
                  <span className="text-lg font-bold text-amber-400 font-mono mt-0.5 block">
                    {activeCount}
                  </span>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-850">
                  <span className="text-xs text-slate-400 block">Emergencies</span>
                  <span className="text-lg font-bold text-rose-400 font-mono mt-0.5 block">
                    {emergencyCount}
                  </span>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-850">
                  <span className="text-xs text-slate-400 block">Top Issue</span>
                  <span className="text-xs font-bold text-cyan-300 mt-1 block truncate">
                    {topCategory.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {/* Key Road Corridors */}
              <div className="space-y-1.5 text-xs">
                <span className="font-semibold text-slate-400 block">
                  Key Transit & Repair Corridors:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {ward.keyStreets.map((st, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 font-mono text-xs"
                    >
                      {st}
                    </span>
                  ))}
                </div>
              </div>

              {/* Recent Active Issues in this ward */}
              <div className="space-y-2 pt-2 border-t border-slate-850">
                <span className="text-xs font-semibold text-slate-400 block">
                  Active Grievances in Ward:
                </span>
                {wardComplaints.slice(0, 2).map(c => (
                  <div
                    key={c.id}
                    className="p-2.5 rounded bg-slate-950 border border-slate-800/80 text-xs flex items-center justify-between"
                  >
                    <div className="space-y-0.5 truncate max-w-[80%]">
                      <span className="font-mono text-cyan-400 font-medium">{c.ticketNumber}</span>
                      <p className="text-slate-300 truncate">{c.title}</p>
                    </div>
                    <span className="font-mono text-xs text-slate-400">{c.status}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
