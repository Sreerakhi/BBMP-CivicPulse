import React, { useState, useRef, useEffect } from 'react';
import { Shield, User, ChevronDown, Check, Building2, Droplets, Zap, Siren, Sparkles } from 'lucide-react';
import { UserRole } from '../types/civic.ts';
import { USER_ROLES } from '../data/rolesData.ts';

interface RoleSwitcherProps {
  currentRole: UserRole;
  onSelectRole: (role: UserRole) => void;
}

export const RoleSwitcher: React.FC<RoleSwitcherProps> = ({ currentRole, onSelectRole }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeProfile = USER_ROLES.find(r => r.role === currentRole) || USER_ROLES[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'CITIZEN':
        return <User className="w-3.5 h-3.5 text-emerald-400" />;
      case 'OFFICER_BBMP':
        return <Building2 className="w-3.5 h-3.5 text-amber-400" />;
      case 'OFFICER_BWSSB':
        return <Droplets className="w-3.5 h-3.5 text-cyan-400" />;
      case 'OFFICER_BESCOM':
        return <Zap className="w-3.5 h-3.5 text-yellow-400" />;
      case 'OFFICER_BTP':
        return <Siren className="w-3.5 h-3.5 text-purple-400" />;
      case 'ADMIN':
        return <Shield className="w-3.5 h-3.5 text-rose-400" />;
      default:
        return <User className="w-3.5 h-3.5" />;
    }
  };

  const getRoleBadgeClasses = (role: UserRole) => {
    switch (role) {
      case 'CITIZEN':
        return 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300';
      case 'OFFICER_BBMP':
        return 'bg-amber-950/70 border-amber-500/40 text-amber-300';
      case 'OFFICER_BWSSB':
        return 'bg-cyan-950/70 border-cyan-500/40 text-cyan-300';
      case 'OFFICER_BESCOM':
        return 'bg-yellow-950/70 border-yellow-500/40 text-yellow-300';
      case 'OFFICER_BTP':
        return 'bg-purple-950/70 border-purple-500/40 text-purple-300';
      case 'ADMIN':
        return 'bg-rose-950/70 border-rose-500/40 text-rose-300';
      default:
        return 'bg-slate-800 border-slate-700 text-slate-300';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${getRoleBadgeClasses(
          currentRole
        )} hover:brightness-110 shadow-sm`}
        title="Switch user role persona to test different permissions"
      >
        <span className="flex items-center gap-1.5">
          {getRoleIcon(currentRole)}
          <span className="font-semibold whitespace-nowrap">{activeProfile.title}</span>
        </span>
        <ChevronDown className="w-3 h-3 opacity-70" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 sm:w-80 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl py-2 z-50 text-xs">
          <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
              Select User Persona (RBAC)
            </span>
            <span className="text-[10px] text-cyan-400 font-mono">Live Simulator</span>
          </div>

          <div className="py-1 max-h-96 overflow-y-auto divide-y divide-slate-850">
            {USER_ROLES.map(roleItem => {
              const isSelected = roleItem.role === currentRole;
              return (
                <button
                  key={roleItem.role}
                  onClick={() => {
                    onSelectRole(roleItem.role);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2.5 transition-colors flex items-start gap-3 hover:bg-slate-800/80 ${
                    isSelected ? 'bg-slate-800/90' : ''
                  }`}
                >
                  <div className="mt-0.5">{getRoleIcon(roleItem.role)}</div>
                  <div className="flex-1 space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-100">{roleItem.title}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                    </div>
                    <span className="text-[11px] text-cyan-300 font-mono block">
                      {roleItem.badge}
                    </span>
                    <p className="text-[11px] text-slate-400 leading-tight">
                      {roleItem.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="px-3 pt-2 pb-1 border-t border-slate-800 text-[10px] text-slate-500 font-mono flex items-center justify-between">
            <span>Role-Based Access Control</span>
            <span>Firestore Enforced</span>
          </div>
        </div>
      )}
    </div>
  );
};
