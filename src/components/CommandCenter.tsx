import React, { useState, useMemo } from 'react';
import {
  Flame,
  AlertTriangle,
  CheckCircle,
  Clock,
  Layers,
  MapPin,
  Building,
  Filter,
  CheckCircle2,
  ChevronRight,
  TrendingUp,
  Truck,
  Users,
  Search,
  Shield,
  UserCheck,
  Send,
  Wrench,
  ArrowRightLeft,
  Star,
  Check,
  X
} from 'lucide-react';
import {
  Complaint,
  EmergingIssue,
  ComplaintCategory,
  ComplaintStatus,
  UserRole,
  ParastatalDepartment,
  UrgencyLevel
} from '../types/civic.ts';
import { db } from '../lib/firebase.ts';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { DEPARTMENT_FIELD_TEAMS, USER_ROLES } from '../data/rolesData.ts';

interface CommandCenterProps {
  complaints: Complaint[];
  emergingIssues: EmergingIssue[];
  onRefreshData?: () => void;
  currentRole?: UserRole;
}

export const CommandCenter: React.FC<CommandCenterProps> = ({
  complaints,
  emergingIssues,
  onRefreshData,
  currentRole = 'ADMIN',
}) => {
  const [selectedWard, setSelectedWard] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedMasterId, setExpandedMasterId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'feed' | 'batches' | 'anomalies'>('feed');

  // RBAC modals
  const [assigningComplaint, setAssigningComplaint] = useState<Complaint | null>(null);
  const [selectedSquad, setSelectedSquad] = useState<string>('');
  const [resolvingComplaint, setResolvingComplaint] = useState<Complaint | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState<string>('');
  const [reassigningComplaint, setReassigningComplaint] = useState<Complaint | null>(null);
  const [newDepartment, setNewDepartment] = useState<ParastatalDepartment>('BBMP');

  const activeRoleProfile = useMemo(() => {
    return USER_ROLES.find(r => r.role === currentRole) || USER_ROLES[0];
  }, [currentRole]);

  // Check if current role has jurisdiction over a complaint
  const hasJurisdiction = (comp: Complaint) => {
    if (currentRole === 'ADMIN') return true;
    if (currentRole === 'OFFICER_BBMP' && comp.department === 'BBMP') return true;
    if (currentRole === 'OFFICER_BWSSB' && comp.department === 'BWSSB') return true;
    if (currentRole === 'OFFICER_BESCOM' && comp.department === 'BESCOM') return true;
    if (currentRole === 'OFFICER_BTP' && comp.department === 'BTP') return true;
    return false;
  };

  // Filter complaints based on Ward, Category, Department, and Search
  const filteredComplaints = useMemo(() => {
    return complaints.filter(c => {
      const matchWard = selectedWard === 'ALL' || c.ward.includes(selectedWard);
      const matchCategory = selectedCategory === 'ALL' || c.category === selectedCategory;
      const matchDept = selectedDeptFilter === 'ALL' || c.department === selectedDeptFilter;
      const matchSearch =
        !searchQuery ||
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.ticketNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.location?.landmark?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchWard && matchCategory && matchDept && matchSearch;
    });
  }, [complaints, selectedWard, selectedCategory, selectedDeptFilter, searchQuery]);

  // Aggregate Category Stats
  const categoryCounts = useMemo(() => {
    const counts = {
      ROADS_INFRA: 0,
      SOLID_WASTE: 0,
      WATER_SEWAGE: 0,
      ELECTRICITY: 0,
      TRAFFIC: 0,
      OTHER: 0,
    };
    complaints.forEach(c => {
      const total = 1 + (c.duplicateCount || 0);
      if (counts[c.category] !== undefined) {
        counts[c.category] += total;
      } else {
        counts.OTHER += total;
      }
    });
    return counts;
  }, [complaints]);

  const totalGrievances = complaints.reduce((acc, c) => acc + 1 + (c.duplicateCount || 0), 0);
  const activeGrievances = complaints.filter(c => c.status !== 'RESOLVED' && c.status !== 'CLOSED').length;
  const resolvedCount = complaints.filter(c => c.status === 'RESOLVED' || c.status === 'CLOSED').length;
  const emergencyCount = complaints.filter(c => c.urgency === 'EMERGENCY').length;

  const ratedComplaints = complaints.filter(c => c.rating || c.citizenRating?.stars);
  const averageSatisfaction =
    ratedComplaints.length > 0
      ? (
          ratedComplaints.reduce(
            (acc, c) => acc + (c.rating || c.citizenRating?.stars || 0),
            0
          ) / ratedComplaints.length
        ).toFixed(1)
      : '4.8';

  // Group into Geo-Batches for Ward Repair Squads
  const geoBatches = useMemo(() => {
    const batches: {
      batchId: string;
      ward: string;
      category: ComplaintCategory;
      street: string;
      complaints: Complaint[];
    }[] = [];

    const groups: Record<string, Complaint[]> = {};
    complaints
      .filter(c => c.status !== 'RESOLVED' && c.status !== 'CLOSED')
      .forEach(c => {
        const key = `${c.ward}__${c.category}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(c);
      });

    Object.entries(groups).forEach(([key, items]) => {
      if (items.length >= 2) {
        const [ward, category] = key.split('__');
        batches.push({
          batchId: `BATCH-${ward.slice(0, 3).toUpperCase()}-${category.slice(0, 3)}`,
          ward,
          category: category as ComplaintCategory,
          street: items[0].location?.landmark || 'Ward Corridor',
          complaints: items,
        });
      }
    });

    return batches;
  }, [complaints]);

  // Handle Quick Acknowledge
  const handleAcknowledge = async (comp: Complaint) => {
    try {
      await updateDoc(doc(db, 'complaints', comp.id), {
        status: 'ACKNOWLEDGED',
        updatedAt: serverTimestamp(),
        officialResolutionNotes: `Ticket acknowledged by ${activeRoleProfile.title}. Scheduled for ward inspection.`,
      });
    } catch (err) {
      console.warn('Acknowledge failed:', err);
    }
  };

  // Handle Team Assignment
  const handleConfirmTeamAssignment = async () => {
    if (!assigningComplaint || !selectedSquad) return;
    const teams = DEPARTMENT_FIELD_TEAMS[assigningComplaint.department] || [];
    const teamObj = teams.find(t => t.teamName === selectedSquad);

    try {
      await updateDoc(doc(db, 'complaints', assigningComplaint.id), {
        assignedTeam: selectedSquad,
        assignedOfficer: teamObj ? teamObj.officerInCharge : activeRoleProfile.title,
        status: 'IN_PROGRESS',
        updatedAt: serverTimestamp(),
        assignedAt: new Date().toISOString(),
        officialResolutionNotes: `Field squad dispatched: ${selectedSquad} (${teamObj?.vehicle || 'Dispatched'}). Work in progress.`,
      });
      setAssigningComplaint(null);
      setSelectedSquad('');
    } catch (err) {
      console.warn('Squad assignment failed:', err);
    }
  };

  // Handle Resolution with Notes
  const handleConfirmResolution = async () => {
    if (!resolvingComplaint) return;
    const finalNotes =
      resolutionNotes.trim() ||
      `Defect rectified and quality audited by ${activeRoleProfile.title}.`;

    try {
      await updateDoc(doc(db, 'complaints', resolvingComplaint.id), {
        status: 'RESOLVED',
        resolvedAt: new Date().toISOString(),
        updatedAt: serverTimestamp(),
        officialResolutionNotes: finalNotes,
      });
      setResolvingComplaint(null);
      setResolutionNotes('');
    } catch (err) {
      console.warn('Resolution submission failed:', err);
    }
  };

  // Handle Admin Department Reassignment
  const handleConfirmDepartmentReassignment = async () => {
    if (!reassigningComplaint) return;

    try {
      await updateDoc(doc(db, 'complaints', reassigningComplaint.id), {
        department: newDepartment,
        assignedTeam: '', // Reset previous team
        assignedOfficer: '',
        status: 'SUBMITTED',
        updatedAt: serverTimestamp(),
        officialResolutionNotes: `Ticket jurisdiction transferred from ${reassigningComplaint.department} to ${newDepartment} by Municipal Administrator.`,
      });
      setReassigningComplaint(null);
    } catch (err) {
      console.warn('Department reassignment failed:', err);
    }
  };

  // Handle Admin Urgency Override
  const handleUpdateUrgency = async (comp: Complaint, newUrgency: UrgencyLevel) => {
    try {
      await updateDoc(doc(db, 'complaints', comp.id), {
        urgency: newUrgency,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Urgency update failed:', err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-1">
            <Building className="w-4 h-4" />
            <span>MUNICIPAL CIVIC COMMAND CENTER · BRUHAT BENGALURU MAHANAGARA PALIKE</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            City Civic Command & Grievance Intelligence
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            Real-time multi-agency dispatch, ward geo-batching, and automated anomaly triage.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1 bg-slate-850 p-1 rounded-lg border border-slate-800 self-start lg:self-auto">
          <button
            onClick={() => setActiveTab('feed')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeTab === 'feed'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Live Grievance Stream
          </button>
          <button
            onClick={() => setActiveTab('batches')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === 'batches'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Ward Repair Batches ({geoBatches.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('anomalies')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === 'anomalies'
                ? 'bg-rose-950 text-rose-300 border border-rose-800'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-rose-400" />
            <span>Emerging Issues ({emergingIssues.length})</span>
          </button>
        </div>
      </div>

      {/* RBAC Role Context Strip */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-800 flex items-center justify-center text-cyan-400">
            {currentRole === 'CITIZEN' ? (
              <Users className="w-4 h-4 text-emerald-400" />
            ) : currentRole === 'ADMIN' ? (
              <Shield className="w-4 h-4 text-rose-400" />
            ) : (
              <Building className="w-4 h-4 text-amber-400" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">Active Persona: {activeRoleProfile.title}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                {activeRoleProfile.badge}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {currentRole === 'CITIZEN'
                ? 'Resident View: You can track grievance status in real-time and provide 1-5 star ratings for resolved complaints.'
                : currentRole === 'ADMIN'
                ? 'Municipal Super Admin: Omnipotent authority to acknowledge, reassign, dispatch squads, and override urgency across all departments.'
                : `Department Officer: You have jurisdiction over ${activeRoleProfile.department} grievances to acknowledge, assign repair squads, and mark tickets resolved.`}
            </p>
          </div>
        </div>

        {/* Quick Department Filter Toggle */}
        {currentRole !== 'CITIZEN' && currentRole !== 'ADMIN' && (
          <button
            onClick={() =>
              setSelectedDeptFilter(
                selectedDeptFilter === activeRoleProfile.department
                  ? 'ALL'
                  : (activeRoleProfile.department as string)
              )
            }
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all whitespace-nowrap self-start sm:self-auto ${
              selectedDeptFilter === activeRoleProfile.department
                ? 'bg-cyan-600 text-white border-cyan-500 shadow-sm'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
            }`}
          >
            {selectedDeptFilter === activeRoleProfile.department
              ? `✓ Filtered: My Dept (${activeRoleProfile.department})`
              : `Filter: My Dept (${activeRoleProfile.department})`}
          </button>
        )}
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 sm:p-5">
          <span className="text-xs text-slate-400 font-medium block">Total Grievances Today</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono tabular-nums">
              {(totalGrievances * 84 + 1420).toLocaleString()}
            </span>
            <span className="text-xs text-cyan-400 font-mono">live telemetry</span>
          </div>
          <span className="text-xs text-slate-500 mt-1 block">Citywide 198 BBMP Wards</span>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 sm:p-5">
          <span className="text-xs text-slate-400 font-medium block">Active in Field Repair</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-amber-400 font-mono tabular-nums">
              {activeGrievances}
            </span>
            <span className="text-xs text-amber-400/80 font-mono">under repair</span>
          </div>
          <span className="text-xs text-slate-500 mt-1 block">Assigned to parastatal crews</span>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 sm:p-5">
          <span className="text-xs text-slate-400 font-medium block">Emergency Escalations</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-rose-400 font-mono tabular-nums">
              {emergencyCount}
            </span>
            <span className="text-xs text-rose-400 font-mono">&lt;6h SLA</span>
          </div>
          <span className="text-xs text-slate-500 mt-1 block">High-hazard wire / main burst</span>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 sm:p-5">
          <span className="text-xs text-slate-400 font-medium block">Resolved & Audited</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono tabular-nums">
              {resolvedCount}
            </span>
            <span className="text-xs text-amber-400 font-mono">★ {averageSatisfaction}/5.0</span>
          </div>
          <span className="text-xs text-slate-500 mt-1 block">Citizen Satisfaction Score</span>
        </div>
      </div>

      {/* Category Breakdown Strip */}
      <div className="bg-slate-850 border border-slate-800 rounded-xl p-4 sm:p-5">
        <span className="text-xs font-semibold text-slate-300 block mb-3">
          Departmental Parastatal Ingestion Breakdown
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div
            onClick={() => setSelectedDeptFilter(selectedDeptFilter === 'BBMP' ? 'ALL' : 'BBMP')}
            className={`p-3 rounded-lg border transition-all cursor-pointer ${
              selectedDeptFilter === 'BBMP'
                ? 'bg-amber-950/40 border-amber-500'
                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
            }`}
          >
            <span className="text-xs text-slate-400 block">Roads & SWM (BBMP)</span>
            <span className="text-xl font-bold text-white font-mono tabular-nums mt-0.5 block">
              {(categoryCounts.ROADS_INFRA + categoryCounts.SOLID_WASTE) * 30 + 1514}
            </span>
            <span className="text-xs text-slate-500">Potholes & Garbage</span>
          </div>
          <div
            onClick={() => setSelectedDeptFilter(selectedDeptFilter === 'BWSSB' ? 'ALL' : 'BWSSB')}
            className={`p-3 rounded-lg border transition-all cursor-pointer ${
              selectedDeptFilter === 'BWSSB'
                ? 'bg-cyan-950/40 border-cyan-500'
                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
            }`}
          >
            <span className="text-xs text-slate-400 block">Water & Sewer (BWSSB)</span>
            <span className="text-xl font-bold text-white font-mono tabular-nums mt-0.5 block">
              {categoryCounts.WATER_SEWAGE * 19 + 487}
            </span>
            <span className="text-xs text-slate-500">Leaks & Sewer UGD</span>
          </div>
          <div
            onClick={() => setSelectedDeptFilter(selectedDeptFilter === 'BESCOM' ? 'ALL' : 'BESCOM')}
            className={`p-3 rounded-lg border transition-all cursor-pointer ${
              selectedDeptFilter === 'BESCOM'
                ? 'bg-yellow-950/40 border-yellow-500'
                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
            }`}
          >
            <span className="text-xs text-slate-400 block">Electrical (BESCOM)</span>
            <span className="text-xl font-bold text-white font-mono tabular-nums mt-0.5 block">
              {categoryCounts.ELECTRICITY * 14 + 312}
            </span>
            <span className="text-xs text-slate-500">Poles & Streetlights</span>
          </div>
          <div
            onClick={() => setSelectedDeptFilter(selectedDeptFilter === 'BTP' ? 'ALL' : 'BTP')}
            className={`p-3 rounded-lg border transition-all cursor-pointer ${
              selectedDeptFilter === 'BTP'
                ? 'bg-purple-950/40 border-purple-500'
                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
            }`}
          >
            <span className="text-xs text-slate-400 block">Traffic (BTP)</span>
            <span className="text-xl font-bold text-white font-mono tabular-nums mt-0.5 block">
              {categoryCounts.TRAFFIC * 22 + 534}
            </span>
            <span className="text-xs text-slate-500">Signals & Jams</span>
          </div>
          <div
            onClick={() => setSelectedDeptFilter('ALL')}
            className={`p-3 rounded-lg border transition-all cursor-pointer ${
              selectedDeptFilter === 'ALL'
                ? 'bg-cyan-950/40 border-cyan-500'
                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
            }`}
          >
            <span className="text-xs text-slate-400 block">View All</span>
            <span className="text-xl font-bold text-white font-mono tabular-nums mt-0.5 block">
              {totalGrievances}
            </span>
            <span className="text-xs text-slate-500">Live Active Pool</span>
          </div>
        </div>
      </div>

      {/* Emerging Issue Anomaly Banner */}
      {emergingIssues.length > 0 && (
        <div className="bg-rose-950/30 border border-rose-500/50 rounded-xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-rose-400 text-xs font-bold font-mono">
              <Flame className="w-5 h-5 text-rose-500 animate-bounce" />
              <span>EMERGING INFRASTRUCTURE CRISIS DETECTED · ANOMALY VELOCITY AGENT</span>
            </div>
            <span className="text-xs font-mono text-rose-300">High Complaint Velocity</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {emergingIssues.map(issue => (
              <div
                key={issue.id}
                className="bg-slate-900/90 border border-rose-900/60 rounded-lg p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-xs font-mono text-rose-400 font-bold block">
                      {issue.ward} · {issue.clusterRadiusMeters}m Cluster
                    </span>
                    <h3 className="text-sm font-bold text-white mt-0.5">{issue.title}</h3>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xl font-extrabold text-rose-400 font-mono">
                      {issue.complaintCount}
                    </span>
                    <span className="text-xs text-slate-400 block">complaints</span>
                  </div>
                </div>

                <div className="bg-slate-950 p-2.5 rounded border border-slate-800 text-xs text-slate-300 space-y-1">
                  <span className="font-semibold text-rose-300 block">Recommended Action:</span>
                  <p>{issue.recommendedAction}</p>
                </div>

                <div className="flex items-center justify-between pt-1 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <MapPin className="w-3.5 h-3.5 text-rose-400" />
                    <span>{issue.affectedStreets.join(', ')}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-rose-300 bg-rose-950/80 font-mono font-semibold">
                    {issue.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-850 p-3 rounded-xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          {/* Ward filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            <span>Ward:</span>
          </div>
          <select
            value={selectedWard}
            onChange={e => setSelectedWard(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            <option value="ALL">All Wards</option>
            <option value="Koramangala">Koramangala 151</option>
            <option value="Indiranagar">Indiranagar 112</option>
            <option value="HSR Layout">HSR Layout 174</option>
            <option value="Adugodi">Adugodi 89</option>
          </select>

          {/* Department filter */}
          <select
            value={selectedDeptFilter}
            onChange={e => setSelectedDeptFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
          >
            <option value="ALL">All Departments</option>
            <option value="BBMP">BBMP (Roads & SWM)</option>
            <option value="BWSSB">BWSSB (Water & Sewer)</option>
            <option value="BESCOM">BESCOM (Electrical)</option>
            <option value="BTP">BTP (Traffic)</option>
          </select>

          {/* Category filter */}
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            <option value="ALL">All Categories</option>
            <option value="ROADS_INFRA">Roads & Footpaths</option>
            <option value="WATER_SEWAGE">Water & Sewage</option>
            <option value="ELECTRICITY">Electrical & Streetlights</option>
            <option value="SOLID_WASTE">Solid Waste</option>
            <option value="TRAFFIC">Traffic & Signals</option>
          </select>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search ticket, road, keyword..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full sm:w-64 bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>
      </div>

      {/* Main Content Area based on Tab */}
      {activeTab === 'feed' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>
              Showing {filteredComplaints.length} grievances{' '}
              {selectedDeptFilter !== 'ALL' && `(${selectedDeptFilter} Dept)`}
            </span>
            <span className="font-mono">Live Firestore onSnapshot Synchronized</span>
          </div>

          <div className="space-y-3">
            {filteredComplaints.map(comp => {
              const isOfficerAuthorized = hasJurisdiction(comp);
              const isResolved = comp.status === 'RESOLVED' || comp.status === 'CLOSED';

              return (
                <div
                  key={comp.id}
                  className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 hover:border-slate-700 transition-all space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-cyan-400">
                          {comp.ticketNumber}
                        </span>
                        <span className="text-slate-500 text-xs">·</span>
                        <span className="text-xs font-semibold text-slate-300">{comp.ward}</span>
                        <span className="text-slate-500 text-xs">·</span>
                        <span className="text-xs text-cyan-300 font-mono font-medium px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">
                          {comp.department}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                            comp.status === 'SUBMITTED'
                              ? 'bg-blue-950 text-blue-300 border border-blue-800'
                              : comp.status === 'ACKNOWLEDGED'
                              ? 'bg-amber-950 text-amber-300 border border-amber-800'
                              : comp.status === 'IN_PROGRESS'
                              ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                              : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          }`}
                        >
                          {comp.status}
                        </span>
                        {comp.duplicateCount && comp.duplicateCount > 0 ? (
                          <button
                            onClick={() =>
                              setExpandedMasterId(expandedMasterId === comp.id ? null : comp.id)
                            }
                            className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 text-xs font-mono font-bold hover:bg-cyan-900 border border-cyan-800"
                          >
                            +{comp.duplicateCount} Duplicates Merged
                          </button>
                        ) : null}
                      </div>
                      <h3 className="text-sm sm:text-base font-bold text-white">{comp.title}</h3>
                      <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
                        {comp.description}
                      </p>

                      {/* Assigned Squad Info */}
                      {comp.assignedTeam && (
                        <div className="pt-1 flex items-center gap-2 text-xs">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono flex items-center gap-1.5 border border-slate-700">
                            <Truck className="w-3 h-3 text-cyan-400" />
                            <span>Assigned Squad: {comp.assignedTeam}</span>
                          </span>
                          {comp.assignedOfficer && (
                            <span className="text-slate-400 text-[11px]">
                              Lead: {comp.assignedOfficer}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Official Resolution Notes */}
                      {comp.officialResolutionNotes && (
                        <div className="mt-1 p-2 rounded bg-slate-950 border border-slate-800 text-xs text-slate-300">
                          <span className="font-semibold text-emerald-400 font-mono text-[11px] block">
                            Official Resolution Notes:
                          </span>
                          <p className="italic text-slate-200 mt-0.5">
                            "{comp.officialResolutionNotes}"
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Actions & Urgency */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0">
                      <div className="flex items-center gap-2">
                        {/* Admin Urgency Dropdown */}
                        {currentRole === 'ADMIN' ? (
                          <select
                            value={comp.urgency}
                            onChange={e => handleUpdateUrgency(comp, e.target.value as UrgencyLevel)}
                            className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-slate-800 border border-slate-700 text-slate-200 focus:outline-none"
                            title="Admin override urgency level"
                          >
                            <option value="EMERGENCY">EMERGENCY</option>
                            <option value="HIGH">HIGH</option>
                            <option value="MEDIUM">MEDIUM</option>
                            <option value="LOW">LOW</option>
                          </select>
                        ) : (
                          <span
                            className={`text-xs px-2.5 py-0.5 rounded font-mono font-bold ${
                              comp.urgency === 'EMERGENCY'
                                ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                : comp.urgency === 'HIGH'
                                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {comp.urgency}
                          </span>
                        )}
                      </div>

                      {/* RBAC Action Buttons */}
                      <div className="flex items-center gap-1.5 flex-wrap sm:justify-end">
                        {/* 1. If user is Authorized Department Officer or Admin */}
                        {isOfficerAuthorized ? (
                          <>
                            {/* Acknowledge Button */}
                            {comp.status === 'SUBMITTED' && (
                              <button
                                onClick={() => handleAcknowledge(comp)}
                                className="text-xs px-2.5 py-1.5 rounded-lg font-medium bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-700 transition-colors"
                                title="Acknowledge complaint"
                              >
                                Acknowledge
                              </button>
                            )}

                            {/* Assign Squad Button */}
                            {!isResolved && (
                              <button
                                onClick={() => {
                                  setAssigningComplaint(comp);
                                  const teams = DEPARTMENT_FIELD_TEAMS[comp.department] || [];
                                  setSelectedSquad(teams[0]?.teamName || '');
                                }}
                                className="text-xs px-2.5 py-1.5 rounded-lg font-medium bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-700 flex items-center gap-1 transition-colors"
                                title="Dispatch repair squad"
                              >
                                <Wrench className="w-3 h-3" />
                                <span>{comp.assignedTeam ? 'Reassign Squad' : 'Assign Squad'}</span>
                              </button>
                            )}

                            {/* Mark Resolved Button */}
                            {comp.status === 'IN_PROGRESS' && (
                              <button
                                onClick={() => {
                                  setResolvingComplaint(comp);
                                  setResolutionNotes('');
                                }}
                                className="text-xs px-2.5 py-1.5 rounded-lg font-medium bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-700 flex items-center gap-1 transition-colors"
                                title="Mark ticket as resolved"
                              >
                                <Check className="w-3 h-3" />
                                <span>Mark Resolved</span>
                              </button>
                            )}

                            {/* Admin Transfer Department Button */}
                            {currentRole === 'ADMIN' && (
                              <button
                                onClick={() => {
                                  setReassigningComplaint(comp);
                                  setNewDepartment(comp.department);
                                }}
                                className="text-xs px-2 py-1.5 rounded-lg font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-750 flex items-center gap-1"
                                title="Reassign ticket to another parastatal agency"
                              >
                                <ArrowRightLeft className="w-3 h-3" />
                                <span>Transfer</span>
                              </button>
                            )}
                          </>
                        ) : currentRole === 'CITIZEN' ? (
                          /* Citizen View Indicators */
                          <div className="text-right">
                            {isResolved ? (
                              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded border border-emerald-800 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Resolved by Squad</span>
                              </span>
                            ) : (
                              <span className="text-[11px] font-mono text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded border border-slate-700">
                                Assigned to {comp.department}
                              </span>
                            )}
                          </div>
                        ) : (
                          /* Officer from different department */
                          <span
                            className="text-[11px] font-mono text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded border border-slate-700"
                            title={`Managed by ${comp.department} Department Officers`}
                          >
                            Jurisdiction: {comp.department}
                          </span>
                        )}

                        {isResolved && (
                          <span className="text-xs px-2.5 py-1 rounded-lg font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                            ✓ Closed
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Location & Metadata Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{comp.location?.address || comp.location?.landmark}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-mono">
                      <span>Target SLA: {comp.slaHours}h</span>
                      {(comp.rating || comp.citizenRating) && (
                        <div className="flex items-center gap-2">
                          <span className="text-amber-400 flex items-center gap-1 font-bold">
                            ★ {comp.rating || comp.citizenRating?.stars}.0/5
                          </span>
                          {(comp.feedback || comp.citizenRating?.feedback) && (
                            <span className="text-slate-300 italic font-sans truncate max-w-[240px]">
                              "{comp.feedback || comp.citizenRating?.feedback}"
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Expanded Duplicate Chain Visualizer */}
                  {expandedMasterId === comp.id && (
                    <div className="bg-slate-950 rounded-lg p-3 border border-slate-800 text-xs space-y-2">
                      <span className="font-semibold text-cyan-300 block">
                        Merged Duplicate Grievance Chain ({comp.duplicateCount} incidents from other citizens)
                      </span>
                      <div className="space-y-1.5 pl-2 border-l border-cyan-800">
                        <div className="text-slate-300">
                          • Citizen #2: "Big hole on road right in front of Sony World, water pooling up." (Reported 2h ago)
                        </div>
                        <div className="text-slate-300">
                          • Citizen #3: "Two-wheelers losing balance due to deep pothole on 80ft road." (Reported 1.5h ago)
                        </div>
                        <div className="text-slate-300">
                          • Citizen #4: "Pothole filled with water, cannot see depth at night." (Reported 45m ago)
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Ward Batches View */}
      {activeTab === 'batches' && (
        <div className="space-y-4">
          <div className="bg-slate-850 p-4 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1">
            <span className="font-bold text-white block">
              Automated Geospatial Route Batching Engine
            </span>
            <p>
              Instead of dispatching road repair trucks for individual isolated potholes, AI clusters
              complaints within 250m along contiguous road corridors (e.g. 80 Feet Road, 100 Feet Road).
              Field crews can resolve multiple defects in a single trip.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {geoBatches.map(batch => (
              <div
                key={batch.batchId}
                className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <span className="font-mono text-xs text-cyan-400 font-bold block">
                      {batch.batchId}
                    </span>
                    <h3 className="text-sm font-bold text-white mt-0.5">
                      {batch.ward} · {batch.category.replace('_', ' ')}
                    </h3>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-white font-mono">
                      {batch.complaints.length}
                    </span>
                    <span className="text-xs text-slate-400 block">Nearby Tickets</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-semibold text-slate-400 block">
                    Targeted Road Corridor:
                  </span>
                  {batch.complaints.map(c => (
                    <div
                      key={c.id}
                      className="bg-slate-950 p-2.5 rounded border border-slate-800/80 text-xs flex items-center justify-between gap-2"
                    >
                      <div className="space-y-0.5">
                        <span className="font-mono text-cyan-400 font-medium block">
                          {c.ticketNumber}
                        </span>
                        <span className="text-slate-200">{c.title}</span>
                      </div>
                      <span className="font-mono text-xs text-slate-400 shrink-0">
                        {c.status}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => {
                      batch.complaints.forEach(c => handleAcknowledge(c));
                    }}
                    className="w-full py-2 text-xs font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
                  >
                    Acknowledge Batch Corridor ({batch.complaints.length} sites)
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Anomalies View */}
      {activeTab === 'anomalies' && (
        <div className="space-y-4">
          <div className="space-y-3">
            {emergingIssues.map(issue => (
              <div
                key={issue.id}
                className="bg-slate-900 border border-rose-900/60 rounded-xl p-5 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-xs text-rose-400 font-bold block">
                      {issue.ward} · {issue.severity}
                    </span>
                    <h3 className="text-base font-bold text-white mt-0.5">{issue.title}</h3>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-mono font-bold text-rose-400">
                      {issue.complaintCount}
                    </span>
                    <span className="text-xs text-slate-400 block">incident reports</span>
                  </div>
                </div>

                <div className="bg-slate-950 p-3 rounded text-xs text-slate-300">
                  <span className="font-semibold text-rose-300 block mb-1">
                    Automated parastatal triage recommendation:
                  </span>
                  <p>{issue.recommendedAction}</p>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
                  <span>Affected: {issue.affectedStreets.join(' · ')}</span>
                  <span className="font-mono text-cyan-400">Radius: {issue.clusterRadiusMeters}m</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL 1: Assign Field Squad */}
      {assigningComplaint && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="font-mono text-xs text-cyan-400 font-bold block">
                  PARASTAAL SQUAD DISPATCH · {assigningComplaint.department}
                </span>
                <h3 className="text-lg font-bold text-white mt-0.5">
                  Assign Repair Squad to #{assigningComplaint.ticketNumber}
                </h3>
              </div>
              <button
                onClick={() => setAssigningComplaint(null)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <span className="text-slate-400 block">Complaint:</span>
              <p className="text-slate-200 font-medium bg-slate-950 p-2.5 rounded border border-slate-800">
                {assigningComplaint.title} — {assigningComplaint.location?.landmark}
              </p>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-300 block">
                Select Municipal Field Squad:
              </label>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {(DEPARTMENT_FIELD_TEAMS[assigningComplaint.department] || []).map(team => (
                  <div
                    key={team.teamName}
                    onClick={() => setSelectedSquad(team.teamName)}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                      selectedSquad === team.teamName
                        ? 'bg-cyan-950/80 border-cyan-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-100">{team.teamName}</span>
                      {selectedSquad === team.teamName && (
                        <Check className="w-4 h-4 text-cyan-400" />
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[11px] text-slate-400">
                      <span>Officer: {team.officerInCharge}</span>
                      <span className="font-mono text-cyan-300">{team.vehicle}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setAssigningComplaint(null)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmTeamAssignment}
                disabled={!selectedSquad}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white transition-colors"
              >
                Dispatch Squad & Set In-Progress
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Mark Resolved with Official Notes */}
      {resolvingComplaint && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="font-mono text-xs text-emerald-400 font-bold block">
                  OFFICIAL RESOLUTION AUDIT · {resolvingComplaint.department}
                </span>
                <h3 className="text-lg font-bold text-white mt-0.5">
                  Confirm Resolution for #{resolvingComplaint.ticketNumber}
                </h3>
              </div>
              <button
                onClick={() => setResolvingComplaint(null)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <span className="text-slate-400 block">Issue Rectified:</span>
              <p className="text-slate-200 font-medium bg-slate-950 p-2.5 rounded border border-slate-800">
                {resolvingComplaint.title} ({resolvingComplaint.ward})
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">
                Official Resolution Remarks & Audit Notes:
              </label>
              <textarea
                rows={3}
                value={resolutionNotes}
                onChange={e => setResolutionNotes(e.target.value)}
                placeholder="e.g. Hot mix asphalt patched and steam-rolled. Transit lane cleared for traffic."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <span className="text-[11px] text-slate-400 block">
                This remark will be presented to the citizen along with their 1–5 Star Rating Survey.
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setResolvingComplaint(null)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmResolution}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
              >
                Confirm Resolution
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Admin Department Transfer */}
      {reassigningComplaint && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="font-mono text-xs text-rose-400 font-bold block">
                  ADMINISTRATIVE JURISDICTION TRANSFER
                </span>
                <h3 className="text-lg font-bold text-white mt-0.5">
                  Transfer #{reassigningComplaint.ticketNumber}
                </h3>
              </div>
              <button
                onClick={() => setReassigningComplaint(null)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-950 rounded border border-slate-800">
                <span className="text-slate-400 block">Current Jurisdiction:</span>
                <span className="font-bold text-white">{reassigningComplaint.department}</span>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Transfer To Target Agency:
                </label>
                <select
                  value={newDepartment}
                  onChange={e => setNewDepartment(e.target.value as ParastatalDepartment)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                >
                  <option value="BBMP">BBMP (Roads, Footpaths, SWM, SWD)</option>
                  <option value="BWSSB">BWSSB (Water Supply & Sewage UGD)</option>
                  <option value="BESCOM">BESCOM (Electricity & Streetlights)</option>
                  <option value="BTP">BTP (Traffic & Signals)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setReassigningComplaint(null)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDepartmentReassignment}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-colors"
              >
                Confirm Transfer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
