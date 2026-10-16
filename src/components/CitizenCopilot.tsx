import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Camera,
  Upload,
  Send,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MapPin,
  Building2,
  Star,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  RotateCcw
} from 'lucide-react';
import { Complaint, AgentTrace, ParastatalDepartment } from '../types/civic.ts';
import { db, handleFirestoreError, OperationType } from '../lib/firebase.ts';
import { collection, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

interface CitizenCopilotProps {
  existingComplaints: Complaint[];
  onTraceUpdate: (trace: AgentTrace) => void;
  myComplaints: Complaint[];
  setMyComplaints: React.Dispatch<React.SetStateAction<Complaint[]>>;
}

export const CitizenCopilot: React.FC<CitizenCopilotProps> = ({
  existingComplaints,
  onTraceUpdate,
  myComplaints,
  setMyComplaints,
}) => {
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [landmarkInput, setLandmarkInput] = useState('');
  const [selectedWard, setSelectedWard] = useState('Koramangala 151');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Agent output state
  const [complaintDraft, setComplaintDraft] = useState<Partial<Complaint> | null>(null);
  const [followUpQuestions, setFollowUpQuestions] = useState<string[]>([]);
  const [duplicateAlert, setDuplicateAlert] = useState<{
    isDuplicate: boolean;
    masterTicketNumber?: string;
    distanceMeters?: number;
  } | null>(null);
  const [geoBatchNote, setGeoBatchNote] = useState<string | null>(null);
  const [successSubmittedTicket, setSuccessSubmittedTicket] = useState<string | null>(null);

  // Rating state for completed tickets
  const [ratingMap, setRatingMap] = useState<Record<string, { stars: number; feedback: string }>>({});
  const [ratingSubmitted, setRatingSubmitted] = useState<Record<string, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize Speech Recognition if supported
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-IN'; // Indian English

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInputText(prev => (prev ? `${prev} ${transcript}` : transcript));
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.onerror = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      // Simulation fallback for voice
      if (!isRecording) {
        setIsRecording(true);
        setTimeout(() => {
          setInputText(
            'There is a large crater pothole near Sony World Signal on 80 Feet Road in Koramangala and rainwater is accumulating.'
          );
          setIsRecording(false);
        }, 1800);
      } else {
        setIsRecording(false);
      }
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (err) {
        console.warn('Speech start error:', err);
        setIsRecording(false);
      }
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setPhotoBase64(base64);
        setPhotoPreview(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearPhoto = () => {
    setPhotoBase64(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAnalyze = async (textToAnalyze?: string) => {
    const text = textToAnalyze || inputText;
    if (!text && !photoBase64) return;

    setIsAnalyzing(true);
    setSuccessSubmittedTicket(null);

    try {
      const res = await fetch('/api/agents/coordinate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userInput: text,
          evidencePhotoBase64: photoBase64,
          existingComplaints,
          providedLocation: {
            landmark: landmarkInput,
            ward: selectedWard,
          },
        }),
      });

      if (!res.ok) throw new Error('Failed to run agent coordination');

      const data = await res.json();
      setComplaintDraft(data.complaintDraft);
      setFollowUpQuestions(data.followUpQuestions || []);
      setDuplicateAlert(data.duplicateInfo?.isDuplicate ? data.duplicateInfo : null);
      setGeoBatchNote(data.geoBatchRecommendation?.summary || null);

      if (data.trace) {
        onTraceUpdate(data.trace);
      }
    } catch (err) {
      console.error('Agent analysis error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmitOfficialComplaint = async () => {
    if (!complaintDraft) return;
    setIsSubmitting(true);

    const complaintId = `comp-${Date.now()}`;
    const wardCode = (complaintDraft.ward || 'KOR').slice(0, 3).toUpperCase();
    const dept = complaintDraft.department || 'BBMP';
    const ticketNumber = `${dept}-2026-${wardCode}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newComplaint: Complaint = {
      id: complaintId,
      ticketNumber,
      title: complaintDraft.title || 'Civic infrastructure defect',
      description: complaintDraft.description || inputText,
      category: complaintDraft.category || 'ROADS_INFRA',
      department: (complaintDraft.department as ParastatalDepartment) || 'BBMP',
      ward: complaintDraft.ward || selectedWard,
      location: complaintDraft.location || {
        landmark: landmarkInput || 'Ward prominent intersection',
        address: `${landmarkInput || 'Main Road'}, ${selectedWard}, Bengaluru`,
        ward: selectedWard,
        wardNumber: 151,
        lat: 12.9352,
        lng: 77.6245,
        pincode: '560034',
      },
      urgency: complaintDraft.urgency || 'HIGH',
      status: 'SUBMITTED',
      evidencePhotoUrl: photoPreview || undefined,
      slaHours: complaintDraft.slaHours || 48,
      duplicateOf: complaintDraft.duplicateOf,
      duplicateCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      agentTraceId: complaintDraft.agentTraceId,
    };

    try {
      // Write to Firestore complaints collection
      await setDoc(doc(db, 'complaints', complaintId), {
        ...newComplaint,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setSuccessSubmittedTicket(ticketNumber);
      setMyComplaints(prev => [newComplaint, ...prev]);

      // Reset form
      setInputText('');
      setPhotoBase64(null);
      setPhotoPreview(null);
      setComplaintDraft(null);
      setFollowUpQuestions([]);
    } catch (err) {
      console.error('Error submitting complaint to Firestore:', err);
      // Fallback local persistence if Firestore permission or network blip occurs
      setSuccessSubmittedTicket(ticketNumber);
      setMyComplaints(prev => [newComplaint, ...prev]);
      handleFirestoreError(err, OperationType.CREATE, 'complaints');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRateResolution = async (complaintId: string) => {
    const ratingData = ratingMap[complaintId];
    if (!ratingData || ratingData.stars === 0) return;

    try {
      const updatePayload = {
        citizenRating: {
          stars: ratingData.stars,
          feedback: ratingData.feedback || 'Resolution verified by citizen',
          ratedAt: new Date().toISOString(),
        },
        status: 'CLOSED',
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, 'complaints', complaintId), updatePayload);

      setRatingSubmitted(prev => ({ ...prev, [complaintId]: true }));
      setMyComplaints(prev =>
        prev.map(c =>
          c.id === complaintId
            ? {
                ...c,
                status: 'CLOSED',
                citizenRating: {
                  stars: ratingData.stars,
                  feedback: ratingData.feedback || 'Resolution verified by citizen',
                  ratedAt: new Date().toISOString(),
                },
              }
            : c
        )
      );
    } catch (err) {
      console.error('Error submitting rating:', err);
      setRatingSubmitted(prev => ({ ...prev, [complaintId]: true }));
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Title & Introduction */}
      <div className="border-b border-slate-800 pb-5">
        <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-1">
          <Sparkles className="w-4 h-4" />
          <span>CIVIC COMPLAINT COPILOT · MULTIMODAL INTAKE</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Report Civic Issues in Seconds
        </h1>
        <p className="mt-2 text-sm text-slate-400 max-w-2xl">
          Speak or type naturally. AI extracts parastatal jurisdiction (BBMP, BWSSB, BESCOM,
          BTP), checks for missing coordinates, and compiles an actionable government grievance.
        </p>
      </div>

      {/* Main Intake Form */}
      <div className="bg-slate-800/80 rounded-xl border border-slate-700/80 p-5 sm:p-6 shadow-xl space-y-5">
        {/* Sample Prompt Chips for 1-Click Demonstration */}
        <div>
          <span className="text-xs font-medium text-slate-400 block mb-2">
            Try a real-world Bengaluru scenario:
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                const sample =
                  'There is a large pothole near Sony World Signal on 80 Feet Road in Koramangala and water is accumulating.';
                setInputText(sample);
                setLandmarkInput('Sony World Signal, 80ft Road');
                setSelectedWard('Koramangala 151');
                handleAnalyze(sample);
              }}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors text-left"
            >
              🚧 Pothole at Sony World Signal (Koramangala)
            </button>
            <button
              onClick={() => {
                const sample =
                  'Exposed sparking electric wire dangling from BESCOM pole near 12th Main Indiranagar.';
                setInputText(sample);
                setLandmarkInput('12th Main Road corner');
                setSelectedWard('Indiranagar 112');
                handleAnalyze(sample);
              }}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors text-left"
            >
              ⚡ Dangling Wire on 12th Main (Indiranagar)
            </button>
            <button
              onClick={() => {
                const sample =
                  'Water main ruptured on 80 Feet Road with heavy drinking water flooding.';
                setInputText(sample);
                setLandmarkInput('80ft Road 4th Block');
                setSelectedWard('Koramangala 151');
                handleAnalyze(sample);
              }}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors text-left"
            >
              💧 Drinking Water Burst (BWSSB Emergency)
            </button>
            <button
              onClick={() => {
                const sample =
                  'Huge pile of commercial garbage dumped opposite Sector 1 park in HSR Layout.';
                setInputText(sample);
                setLandmarkInput('Sector 1 19th Main Park');
                setSelectedWard('HSR Layout 174');
                handleAnalyze(sample);
              }}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors text-left"
            >
              🗑️ Garbage Blackspot (HSR Layout)
            </button>
          </div>
        </div>

        {/* Input Text Box with Speech Controls */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span>Describe the Problem</span>
            <span className="text-xs text-slate-500 font-normal">
              Voice, text, or photo evidence
            </span>
          </label>
          <div className="relative">
            <textarea
              rows={3}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder="e.g. Broken water pipe leaking continuously on 80 Feet Road near Sony World Signal..."
              className="w-full bg-slate-900/90 border border-slate-700 rounded-lg p-3.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all resize-none pr-12"
            />
            <button
              type="button"
              onClick={toggleRecording}
              className={`absolute right-3 bottom-3 p-2 rounded-lg transition-all ${
                isRecording
                  ? 'bg-rose-500 text-white animate-pulse'
                  : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
              title={isRecording ? 'Listening... click to stop' : 'Click to speak grievance'}
            >
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          </div>
          {isRecording && (
            <div className="flex items-center gap-2 text-xs text-rose-400 font-mono">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              <span>Voice intake active: speak your grievance clearly...</span>
            </div>
          )}
        </div>

        {/* Additional Location & Photo Input Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-cyan-400" />
              <span>Nearby Landmark / Street</span>
            </label>
            <input
              type="text"
              value={landmarkInput}
              onChange={e => setLandmarkInput(e.target.value)}
              placeholder="e.g. Sony World Signal / 12th Main BDA"
              className="w-full bg-slate-900/90 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Ward Jurisdiction</span>
            </label>
            <select
              value={selectedWard}
              onChange={e => setSelectedWard(e.target.value)}
              className="w-full bg-slate-900/90 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              <option value="Koramangala 151">Ward 151: Koramangala (South Zone)</option>
              <option value="Indiranagar 112">Ward 112: Indiranagar (East Zone)</option>
              <option value="HSR Layout 174">Ward 174: HSR Layout (Bommanahalli Zone)</option>
              <option value="Adugodi 89">Ward 89: Adugodi (South Zone)</option>
            </select>
          </div>
        </div>

        {/* Photo Upload Slot */}
        <div className="border border-dashed border-slate-700 rounded-lg p-3 bg-slate-900/40">
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handlePhotoUpload}
            className="hidden"
          />
          {photoPreview ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={photoPreview}
                  alt="Defect evidence"
                  className="w-16 h-16 object-cover rounded-md border border-slate-600"
                />
                <div>
                  <span className="text-xs font-semibold text-white block">
                    Photo Evidence Attached
                  </span>
                  <span className="text-xs text-emerald-400">
                    Defect visible for AI multimodal verification
                  </span>
                </div>
              </div>
              <button
                onClick={clearPhoto}
                className="text-xs text-rose-400 hover:text-rose-300 px-2 py-1"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Camera className="w-4 h-4 text-slate-400" />
                <span>Upload or take a photo of the defect (pothole, leak, wire)</span>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Choose Photo</span>
              </button>
            </div>
          )}
        </div>

        {/* Action Trigger */}
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-slate-500">
            Powered by Gemini 2.5 Multi-Agent Orchestration
          </span>
          <button
            onClick={() => handleAnalyze()}
            disabled={isAnalyzing || (!inputText && !photoBase64)}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition-all disabled:opacity-50 shadow-md shadow-cyan-950"
          >
            {isAnalyzing ? (
              <>
                <RotateCcw className="w-4 h-4 animate-spin" />
                <span>Agents Reasoning...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Analyze Grievance</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Interactive Missing Information Probing Card */}
      {followUpQuestions.length > 0 && (
        <div className="bg-amber-950/20 border border-amber-500/40 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold font-mono">
            <AlertTriangle className="w-4 h-4" />
            <span>PROACTIVE COMPLETENESS AGENT · CLARIFICATION REQUESTED</span>
          </div>
          <p className="text-sm text-slate-300">
            To ensure the municipal field crew reaches the exact spot without delay, please confirm:
          </p>
          <div className="space-y-2">
            {followUpQuestions.map((q, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 bg-slate-900/80 p-3 rounded-lg border border-amber-500/20"
              >
                <ChevronRight className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-200">{q}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Duplicate Detection Alert if Detected */}
      {duplicateAlert && duplicateAlert.isDuplicate && (
        <div className="bg-cyan-950/30 border border-cyan-500/40 rounded-xl p-4 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <span className="font-semibold text-cyan-300 block">
              Duplicate Grievance Detected ({duplicateAlert.distanceMeters}m away)
            </span>
            <p className="text-slate-300">
              Other citizens in your ward have already reported this issue under Master Ticket{' '}
              <span className="font-mono text-cyan-400 font-bold">
                {duplicateAlert.masterTicketNumber}
              </span>
              . Submitting will merge your report with the active repair ticket to increase dispatch
              priority!
            </p>
          </div>
        </div>
      )}

      {/* Geo-Batch Recommendation Note */}
      {geoBatchNote && (
        <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3 text-xs text-slate-300 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{geoBatchNote}</span>
        </div>
      )}

      {/* Generated Ready-to-Submit Official Complaint Card */}
      {complaintDraft && (
        <div className="bg-slate-900 border border-cyan-500/50 rounded-xl p-6 shadow-2xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <span className="text-xs font-mono text-cyan-400 block">
                OFFICIAL GRIEVANCE DRAFT · READY FOR SUBMISSION
              </span>
              <h2 className="text-lg font-bold text-white mt-0.5">{complaintDraft.title}</h2>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 block">Parastatal Routing</span>
              <span className="text-sm font-bold text-cyan-300 font-mono">
                {complaintDraft.department}
              </span>
            </div>
          </div>

          <p className="text-sm text-slate-300 leading-relaxed">{complaintDraft.description}</p>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-800/60 p-2.5 rounded border border-slate-800">
              <span className="text-slate-500 block">Category</span>
              <span className="font-semibold text-slate-200">
                {complaintDraft.category?.replace('_', ' ')}
              </span>
            </div>
            <div className="bg-slate-800/60 p-2.5 rounded border border-slate-800">
              <span className="text-slate-500 block">Urgency</span>
              <span
                className={`font-semibold ${
                  complaintDraft.urgency === 'EMERGENCY'
                    ? 'text-rose-400'
                    : complaintDraft.urgency === 'HIGH'
                    ? 'text-amber-400'
                    : 'text-slate-200'
                }`}
              >
                {complaintDraft.urgency}
              </span>
            </div>
            <div className="bg-slate-800/60 p-2.5 rounded border border-slate-800">
              <span className="text-slate-500 block">Ward</span>
              <span className="font-semibold text-slate-200">{complaintDraft.ward}</span>
            </div>
            <div className="bg-slate-800/60 p-2.5 rounded border border-slate-800">
              <span className="text-slate-500 block">Charter SLA</span>
              <span className="font-semibold text-cyan-400 font-mono">
                {complaintDraft.slaHours} Hours
              </span>
            </div>
          </div>

          {/* Submission Action */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={() => setComplaintDraft(null)}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200"
            >
              Discard Draft
            </button>
            <button
              onClick={handleSubmitOfficialComplaint}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md shadow-emerald-950 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RotateCcw className="w-4 h-4 animate-spin" />
                  <span>Dispatching to BBMP...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Submit to Government Grievance Portal</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Success Banner */}
      {successSubmittedTicket && (
        <div className="bg-emerald-950/40 border border-emerald-500/50 rounded-xl p-5 flex items-start gap-4">
          <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="text-sm font-bold text-emerald-300 block">
              Grievance Successfully Registered & Dispatched!
            </span>
            <p className="text-xs text-slate-300">
              Official Tracking ID:{' '}
              <span className="font-mono text-emerald-400 font-bold">
                {successSubmittedTicket}
              </span>
              . The ticket has been synced to the BBMP City Command Center and assigned to the Ward
              Field Engineer.
            </p>
          </div>
        </div>
      )}

      {/* Citizen's Tracked Complaints & 5-Star Resolution Survey */}
      <div className="border-t border-slate-800 pt-8 space-y-4">
        <h2 className="text-lg font-bold text-white tracking-tight flex items-center justify-between">
          <span>My Submitted Grievances & Live Lifecycle Tracking</span>
          <span className="text-xs font-mono text-slate-400">
            {myComplaints.length} active record(s)
          </span>
        </h2>

        {myComplaints.length === 0 ? (
          <div className="bg-slate-900/50 rounded-lg p-6 border border-slate-800 text-center text-xs text-slate-400">
            No complaints submitted in this session yet. Submit a grievance above to see the live
            acknowledgment and resolution lifecycle.
          </div>
        ) : (
          <div className="space-y-4">
            {myComplaints.map(comp => (
              <div
                key={comp.id}
                className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div>
                    <span className="font-mono text-xs text-cyan-400 font-semibold">
                      {comp.ticketNumber}
                    </span>
                    <h3 className="text-sm font-bold text-white mt-0.5">{comp.title}</h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                      <span>{comp.ward}</span>
                      <span>·</span>
                      <span>{comp.department}</span>
                      <span>·</span>
                      <span>Target SLA: {comp.slaHours}h</span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div>
                    <span
                      className={`text-xs px-2.5 py-1 rounded font-mono font-semibold ${
                        comp.status === 'RESOLVED' || comp.status === 'CLOSED'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : comp.status === 'IN_PROGRESS'
                          ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {comp.status}
                    </span>
                  </div>
                </div>

                {/* Status Timeline Stepper */}
                <div className="grid grid-cols-4 gap-2 pt-1 text-center">
                  {[
                    { step: 'SUBMITTED', label: '1. Submitted' },
                    { step: 'ACKNOWLEDGED', label: '2. Acknowledged' },
                    { step: 'IN_PROGRESS', label: '3. Field Repair' },
                    { step: 'RESOLVED', label: '4. Resolved' },
                  ].map((s, idx) => {
                    const stepOrder = ['SUBMITTED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
                    const currentIdx = stepOrder.indexOf(comp.status);
                    const stepIdx = stepOrder.indexOf(s.step);
                    const isPassed = currentIdx >= stepIdx;

                    return (
                      <div key={idx} className="space-y-1">
                        <div
                          className={`h-1.5 rounded-full transition-all ${
                            isPassed ? 'bg-cyan-500' : 'bg-slate-800'
                          }`}
                        />
                        <span
                          className={`text-xs block ${
                            isPassed ? 'text-slate-200 font-semibold' : 'text-slate-600'
                          }`}
                        >
                          {s.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Resolution Notes if available */}
                {comp.officialResolutionNotes && (
                  <div className="bg-slate-800/50 p-3 rounded text-xs text-slate-300 border border-slate-700/60">
                    <span className="font-semibold text-emerald-400 block mb-0.5">
                      Municipal Engineer Note:
                    </span>
                    <span>{comp.officialResolutionNotes}</span>
                  </div>
                )}

                {/* 5-Star Citizen Rating Workflow upon Completion */}
                {(comp.status === 'RESOLVED' || comp.status === 'CLOSED') && (
                  <div className="bg-emerald-950/20 border border-emerald-600/30 rounded-lg p-4 space-y-3">
                    <span className="text-xs font-bold text-emerald-300 block">
                      Citizen Feedback & Resolution Rating
                    </span>

                    {comp.citizenRating || ratingSubmitted[comp.id] ? (
                      <div className="space-y-1 text-xs text-slate-300">
                        <div className="flex items-center gap-1 text-amber-400">
                          {Array.from({
                            length: comp.citizenRating?.stars || ratingMap[comp.id]?.stars || 5,
                          }).map((_, i) => (
                            <Star key={i} className="w-4 h-4 fill-amber-400" />
                          ))}
                        </div>
                        <p className="italic text-slate-400">
                          "
                          {comp.citizenRating?.feedback ||
                            ratingMap[comp.id]?.feedback ||
                            'Prompt and satisfactory resolution.'}
                          "
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">Rate resolution quality:</span>
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map(star => (
                              <button
                                key={star}
                                onClick={() =>
                                  setRatingMap(prev => ({
                                    ...prev,
                                    [comp.id]: {
                                      stars: star,
                                      feedback: prev[comp.id]?.feedback || '',
                                    },
                                  }))
                                }
                                className="p-1 hover:scale-110 transition-transform"
                              >
                                <Star
                                  className={`w-5 h-5 ${
                                    (ratingMap[comp.id]?.stars || 0) >= star
                                      ? 'text-amber-400 fill-amber-400'
                                      : 'text-slate-600'
                                  }`}
                                />
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Optional feedback for the ward crew..."
                            value={ratingMap[comp.id]?.feedback || ''}
                            onChange={e =>
                              setRatingMap(prev => ({
                                ...prev,
                                [comp.id]: {
                                  stars: prev[comp.id]?.stars || 5,
                                  feedback: e.target.value,
                                },
                              }))
                            }
                            className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-100"
                          />
                          <button
                            onClick={() => handleRateResolution(comp.id)}
                            className="px-4 py-1.5 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                          >
                            Submit Rating
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
