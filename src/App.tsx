import React, { useState, useEffect } from 'react';
import { Header } from './components/Header.tsx';
import { CitizenCopilot } from './components/CitizenCopilot.tsx';
import { CommandCenter } from './components/CommandCenter.tsx';
import { WardTriage } from './components/WardTriage.tsx';
import { AgentInspector } from './components/AgentInspector.tsx';
import { WardMapPicker, SelectedLocationData } from './components/WardMapPicker.tsx';
import { Complaint, EmergingIssue, AgentTrace, UserRole } from './types/civic.ts';
import { db, handleFirestoreError, OperationType } from './lib/firebase.ts';
import { collection, onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore';

export default function App() {
  const [activeTab, setActiveTab] = useState<'copilot' | 'command' | 'ward-triage' | 'inspector' | 'ward-map'>('copilot');
  const [currentRole, setCurrentRole] = useState<UserRole>('CITIZEN');
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [emergingIssues, setEmergingIssues] = useState<EmergingIssue[]>([]);
  const [myComplaints, setMyComplaints] = useState<Complaint[]>([]);
  const [selectedLocationFromMap, setSelectedLocationFromMap] = useState<SelectedLocationData | null>(null);
  const [currentTrace, setCurrentTrace] = useState<AgentTrace | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isFirestoreConnected, setIsFirestoreConnected] = useState(false);

  // Real-time Firestore Listeners
  useEffect(() => {
    // 1. Listen to complaints collection
    const unsubComplaints = onSnapshot(
      collection(db, 'complaints'),
      snapshot => {
        setIsFirestoreConnected(true);
        const loaded: Complaint[] = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          loaded.push({
            ...data,
            id: docSnap.id,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt || new Date().toISOString(),
          } as Complaint);
        });

        // Sort latest first
        loaded.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setComplaints(loaded);

        // Auto-seed initial data if Firestore is empty on first boot
        if (loaded.length === 0 && !isSeeding) {
          triggerDataSeed();
        }
      },
      error => {
        console.warn('Complaints snapshot listener error, falling back:', error);
        handleFirestoreError(error, OperationType.LIST, 'complaints');
      }
    );

    // 2. Listen to emerging_issues collection
    const unsubEmerging = onSnapshot(
      collection(db, 'emerging_issues'),
      snapshot => {
        const issues: EmergingIssue[] = [];
        snapshot.forEach(docSnap => {
          issues.push({ ...docSnap.data(), id: docSnap.id } as EmergingIssue);
        });
        setEmergingIssues(issues);
      },
      error => {
        console.warn('Emerging issues listener notice:', error);
      }
    );

    return () => {
      unsubComplaints();
      unsubEmerging();
    };
  }, []);

  const triggerDataSeed = async () => {
    setIsSeeding(true);
    try {
      const res = await fetch('/api/seed-civic-data', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to fetch seed data');
      const data = await res.json();

      // Write each seed complaint into Firestore
      if (Array.isArray(data.complaints)) {
        for (const comp of data.complaints) {
          await setDoc(doc(db, 'complaints', comp.id), {
            ...comp,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }

      // Write each emerging issue into Firestore
      if (Array.isArray(data.emergingIssues)) {
        for (const issue of data.emergingIssues) {
          await setDoc(doc(db, 'emerging_issues', issue.id), {
            ...issue,
            detectedAt: serverTimestamp(),
          });
        }
      }
    } catch (err) {
      console.error('Data seed error:', err);
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Top Bar Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onSeedData={triggerDataSeed}
        isSeeding={isSeeding}
        complaintCount={complaints.length}
        currentRole={currentRole}
        onSelectRole={setCurrentRole}
      />

      {/* Main View Area */}
      <main className="flex-1 pb-16">
        {activeTab === 'copilot' && (
          <CitizenCopilot
            existingComplaints={complaints}
            onTraceUpdate={trace => {
              setCurrentTrace(trace);
            }}
            myComplaints={myComplaints}
            setMyComplaints={setMyComplaints}
            initialLocation={selectedLocationFromMap}
          />
        )}

        {activeTab === 'ward-map' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            <WardMapPicker
              currentLandmark={selectedLocationFromMap?.landmark}
              currentWard={selectedLocationFromMap?.ward}
              fullPageView={true}
              onLocationSelect={loc => {
                setSelectedLocationFromMap(loc);
              }}
              onProceed={() => {
                setActiveTab('copilot');
              }}
            />
          </div>
        )}

        {activeTab === 'command' && (
          <CommandCenter
            complaints={complaints}
            emergingIssues={emergingIssues}
            onRefreshData={triggerDataSeed}
            currentRole={currentRole}
          />
        )}

        {activeTab === 'ward-triage' && (
          <WardTriage complaints={complaints} />
        )}

        {activeTab === 'inspector' && (
          <AgentInspector currentTrace={currentTrace} />
        )}
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/60 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>CivicPulse · Bengaluru Municipal Multi-Agent Governance Architecture</span>
          <div className="flex items-center gap-3 text-slate-400 font-mono text-[11px]">
            <span>Parastatals: BBMP · BWSSB · BESCOM · BTP</span>
            <span>·</span>
            <span>Active Persona: <strong className="text-cyan-400">{currentRole}</strong></span>
          </div>
        </div>
      </footer>
    </div>
  );
}
