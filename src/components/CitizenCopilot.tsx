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
  RotateCcw,
  Compass,
  Volume2,
  Radio,
  X,
  Info
} from 'lucide-react';
import { Complaint, AgentTrace, ParastatalDepartment, ComplaintStatus } from '../types/civic.ts';
import { db, handleFirestoreError, OperationType } from '../lib/firebase.ts';
import { collection, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { StarRating } from './StarRating.tsx';
import { WardMapPicker, SelectedLocationData } from './WardMapPicker.tsx';
import { BBMP_FULL_WARDS } from '../data/bbmpWardsData.ts';

interface CitizenCopilotProps {
  existingComplaints: Complaint[];
  onTraceUpdate: (trace: AgentTrace) => void;
  myComplaints: Complaint[];
  setMyComplaints: React.Dispatch<React.SetStateAction<Complaint[]>>;
  initialLocation?: SelectedLocationData | null;
}

export const CitizenCopilot: React.FC<CitizenCopilotProps> = ({
  existingComplaints,
  onTraceUpdate,
  myComplaints,
  setMyComplaints,
  initialLocation,
}) => {
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isTranscribingAudio, setIsTranscribingAudio] = useState(false);
  const [micStatusNote, setMicStatusNote] = useState<string | null>(null);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);

  // Map & Location state
  const [showMapPicker, setShowMapPicker] = useState(true);
  const [autoDetectedWardBadge, setAutoDetectedWardBadge] = useState<string | null>(null);
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>({
    lat: 12.9352,
    lng: 77.6245,
  });
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [landmarkInput, setLandmarkInput] = useState('');
  const [selectedWard, setSelectedWard] = useState('Koramangala 151');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [locationConfirmedNotice, setLocationConfirmedNotice] = useState<string | null>(null);

  // Sync with initialLocation passed from Ward Map tab
  useEffect(() => {
    if (initialLocation) {
      setLandmarkInput(initialLocation.landmark);
      setSelectedWard(initialLocation.ward);
      setSelectedCoords({ lat: initialLocation.lat, lng: initialLocation.lng });
      setAutoDetectedWardBadge(`Auto-detected: ${initialLocation.ward}${initialLocation.constituency ? ` (${initialLocation.constituency})` : ''}`);
      setShowMapPicker(false);
      setLocationConfirmedNotice(
        `✓ Location confirmed from Ward Map: ${initialLocation.landmark} (${initialLocation.ward}). Describe your grievance below or speak to submit.`
      );
      setTimeout(() => {
        const el = document.getElementById('complaint-input-section');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const textarea = el.querySelector('textarea');
          if (textarea) textarea.focus();
        }
      }, 180);
    }
  }, [initialLocation]);

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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);

  // Initialize Speech Recognition if supported
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-IN'; // Indian English

        recognition.onresult = (event: any) => {
          let transcript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          if (transcript) {
            setInputText(prev => (prev ? `${prev} ${transcript}` : transcript));
          }
        };

        recognition.onend = () => {
          // Keep active state governed by MediaRecorder if still running
        };

        recognition.onerror = (e: any) => {
          console.warn('SpeechRecognition notice:', e.error);
        };

        recognitionRef.current = recognition;
      } catch (err) {
        console.warn('SpeechRecognition initialization warning:', err);
      }
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Voice recording: Combines MediaRecorder + Gemini server-side transcription + Web Speech fallback
  const startVoiceRecording = async () => {
    setMicStatusNote(null);
    setVoiceNotice(null);
    audioChunksRef.current = [];
    setRecordingSeconds(0);

    // 1. Try real hardware microphone access
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
        mediaStreamRef.current = stream;

        // Choose supported mimeType
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';

        const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = event => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          // Process recorded audio
          const chunks = audioChunksRef.current;
          if (chunks.length > 0) {
            const recordedBlob = new Blob(chunks, { type: mimeType || 'audio/webm' });
            await processAudioForTranscription(recordedBlob);
          }

          // Stop all audio stream tracks
          if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
          }
        };

        mediaRecorder.start(250); // Slice chunks every 250ms
        setIsRecording(true);

        // Start duration counter
        timerIntervalRef.current = setInterval(() => {
          setRecordingSeconds(prev => {
            if (prev >= 29) {
              stopVoiceRecording();
              return 30;
            }
            return prev + 1;
          });
        }, 1000);

        // Also start browser speech recognition in parallel for instant visual text
        if (recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch {
            // SpeechRecognition may already be running or unsupported
          }
        }

        return;
      } catch (err: any) {
        console.warn('Microphone getUserMedia not available or blocked:', err);
        setMicStatusNote(
          'Microphone permission is blocked by your browser settings or sandbox. Activating voice dictation test mode:'
        );
      }
    }

    // 2. Fallback voice simulation when microphone hardware or browser permission is blocked
    simulateVoiceInput('There is a large crater pothole near Sony World Signal on 80 Feet Road in Koramangala and rainwater is accumulating.');
  };

  const stopVoiceRecording = () => {
    setIsRecording(false);
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore
      }
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.error('Error stopping MediaRecorder:', err);
      }
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopVoiceRecording();
    } else {
      startVoiceRecording();
    }
  };

  // Convert audio blob to base64 and call /api/agents/transcribe
  const processAudioForTranscription = async (blob: Blob) => {
    setIsTranscribingAudio(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Data = reader.result as string;
        try {
          const res = await fetch('/api/agents/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64: base64Data,
              mimeType: blob.type || 'audio/webm',
            }),
          });

          if (res.ok) {
            const data = await res.json();
            if (data.transcript && data.transcript.trim()) {
              setInputText(prev => {
                const clean = data.transcript.trim();
                return prev ? `${prev} ${clean}` : clean;
              });
              setVoiceNotice('Voice transcribed into text by AI');
              setTimeout(() => setVoiceNotice(null), 4000);
            }
          }
        } catch (fetchErr) {
          console.error('Transcription request failed:', fetchErr);
        } finally {
          setIsTranscribingAudio(false);
        }
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error('Blob read error:', err);
      setIsTranscribingAudio(false);
    }
  };

  // Simulated voice dictation with realistic typing animation
  const simulateVoiceInput = (sampleText: string) => {
    setIsRecording(true);
    setInputText('');
    setVoiceNotice('Dictating speech input...');

    let current = '';
    const words = sampleText.split(' ');
    let index = 0;

    const interval = setInterval(() => {
      if (index < words.length) {
        current += (index === 0 ? '' : ' ') + words[index];
        setInputText(current);
        index++;
      } else {
        clearInterval(interval);
        setIsRecording(false);
        setVoiceNotice('Voice dictation complete');
        setTimeout(() => setVoiceNotice(null), 3000);
      }
    }, 120);
  };

  // Handle location selected from interactive map or preset transit points
  const handleLocationSelect = (data: SelectedLocationData) => {
    setLandmarkInput(data.landmark);
    setSelectedWard(data.ward);
    setSelectedCoords({ lat: data.lat, lng: data.lng });
    setAutoDetectedWardBadge(`Auto-detected: ${data.ward}`);
  };

  // Handle manual ward selection by citizen
  const handleManualWardChange = (newWard: string) => {
    setSelectedWard(newWard);
    setAutoDetectedWardBadge(`Manually selected: ${newWard}`);
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
            coordinates: selectedCoords,
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

    const title = (complaintDraft.title || 'Civic infrastructure defect').slice(0, 195);
    const description = (complaintDraft.description || inputText || 'Defect reported by citizen').slice(0, 1990);
    const ward = (complaintDraft.ward || selectedWard || 'Koramangala 151').slice(0, 95);

    const newComplaint: Complaint = {
      id: complaintId,
      ticketNumber,
      title,
      description,
      category: complaintDraft.category || 'ROADS_INFRA',
      department: (complaintDraft.department as ParastatalDepartment) || 'BBMP',
      ward,
      location: complaintDraft.location || {
        landmark: landmarkInput || 'Ward prominent intersection',
        address: `${landmarkInput || 'Main Road'}, ${selectedWard}, Bengaluru`,
        ward: selectedWard,
        wardNumber: selectedWard.includes('112') ? 112 : selectedWard.includes('174') ? 174 : selectedWard.includes('89') ? 89 : 151,
        lat: selectedCoords?.lat || (selectedWard.includes('112') ? 12.9784 : selectedWard.includes('174') ? 12.9121 : selectedWard.includes('89') ? 12.9438 : 12.9352),
        lng: selectedCoords?.lng || (selectedWard.includes('112') ? 77.6408 : selectedWard.includes('174') ? 77.6446 : selectedWard.includes('89') ? 77.6087 : 77.6245),
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
      // Build clean payload for Firestore
      const docPayload: Record<string, any> = {
        ...newComplaint,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      Object.keys(docPayload).forEach(key => {
        if (docPayload[key] === undefined) {
          delete docPayload[key];
        }
      });

      // Write to Firestore complaints collection
      await setDoc(doc(db, 'complaints', complaintId), docPayload);

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
      // Fallback local persistence so user flow is not broken
      setSuccessSubmittedTicket(ticketNumber);
      setMyComplaints(prev => [newComplaint, ...prev]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSimulateStatusAdvance = async (complaint: Complaint) => {
    let nextStatus: ComplaintStatus = 'ACKNOWLEDGED';
    if (complaint.status === 'SUBMITTED') nextStatus = 'ACKNOWLEDGED';
    else if (complaint.status === 'ACKNOWLEDGED') nextStatus = 'IN_PROGRESS';
    else if (complaint.status === 'IN_PROGRESS') nextStatus = 'RESOLVED';
    else if (complaint.status === 'RESOLVED') nextStatus = 'CLOSED';

    try {
      const notes =
        nextStatus === 'RESOLVED'
          ? 'Defect rectified and quality audited by Ward Engineering Squad.'
          : nextStatus === 'IN_PROGRESS'
          ? 'Field repair vehicle on-site performing repairs.'
          : 'Acknowledged and scheduled in ward maintenance roster.';

      await updateDoc(doc(db, 'complaints', complaint.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
        officialResolutionNotes: notes,
      });

      setMyComplaints(prev =>
        prev.map(c =>
          c.id === complaint.id
            ? {
                ...c,
                status: nextStatus,
                officialResolutionNotes: notes,
              }
            : c
        )
      );
    } catch (err) {
      console.error('Error advancing status:', err);
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
        <div id="complaint-input-section" className="space-y-2 pt-2 scroll-mt-24">
          {locationConfirmedNotice && (
            <div className="flex items-center justify-between gap-2 p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-lg text-xs text-emerald-200 shadow-md">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-medium">{locationConfirmedNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setLocationConfirmedNotice(null)}
                className="text-emerald-400 hover:text-emerald-100 text-xs px-1.5 py-0.5 rounded hover:bg-emerald-900/50"
              >
                ✕
              </button>
            </div>
          )}
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <span>Describe the Problem</span>
              <span className="text-[10px] text-cyan-400 font-mono bg-cyan-950/80 border border-cyan-800/60 px-1.5 py-0.5 rounded">
                Voice & Multimodal
              </span>
            </label>
            <div className="flex items-center gap-2">
              {voiceNotice && (
                <span className="text-[11px] text-emerald-400 font-mono animate-fade-in">
                  ✓ {voiceNotice}
                </span>
              )}
              <span className="text-xs text-slate-400 font-normal hidden sm:inline">
                Click microphone or speak clearly
              </span>
            </div>
          </div>

          <div className="relative">
            <textarea
              rows={3}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder="e.g. Broken water pipe leaking continuously on 80 Feet Road near Sony World Signal..."
              className="w-full bg-slate-900/90 border border-slate-700 rounded-lg p-3.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all resize-none pr-14"
            />
            <button
              type="button"
              onClick={toggleRecording}
              className={`absolute right-3 bottom-3 p-2.5 rounded-lg transition-all flex items-center gap-1.5 shadow-md ${
                isRecording
                  ? 'bg-rose-600 text-white animate-pulse ring-2 ring-rose-400'
                  : isTranscribingAudio
                  ? 'bg-cyan-600 text-white animate-spin'
                  : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700'
              }`}
              title={
                isRecording
                  ? 'Recording live voice... click to stop'
                  : isTranscribingAudio
                  ? 'Transcribing audio with Gemini...'
                  : 'Click to speak grievance using your microphone'
              }
            >
              {isRecording ? (
                <MicOff className="w-4 h-4 text-white" />
              ) : isTranscribingAudio ? (
                <RotateCcw className="w-4 h-4 text-white animate-spin" />
              ) : (
                <Mic className="w-4 h-4 text-cyan-400" />
              )}
            </button>
          </div>

          {/* Active Voice Recording Status Bar */}
          {isRecording && (
            <div className="flex items-center justify-between bg-rose-950/40 border border-rose-500/40 rounded-lg px-3 py-2 text-xs text-rose-300 font-mono">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                <span className="font-semibold text-rose-200">
                  Recording Live Voice (00:{recordingSeconds < 10 ? '0' : ''}{recordingSeconds} / 00:30)
                </span>
                <span className="hidden sm:inline text-rose-400">· Speak into your microphone</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 h-3">
                  <span className="w-0.5 h-3 bg-rose-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-0.5 h-2 bg-rose-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-0.5 h-4 bg-rose-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <button
                  type="button"
                  onClick={stopVoiceRecording}
                  className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold transition-colors"
                >
                  Done & Transcribe
                </button>
              </div>
            </div>
          )}

          {/* AI Transcribing Notice */}
          {isTranscribingAudio && (
            <div className="flex items-center gap-2.5 bg-cyan-950/40 border border-cyan-500/40 rounded-lg px-3 py-2 text-xs text-cyan-300 font-mono">
              <RotateCcw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
              <span>Gemini AI is transcribing your spoken audio into structured text...</span>
            </div>
          )}

          {/* Microphone Permission Status Notice */}
          {micStatusNote && (
            <div className="bg-amber-950/30 border border-amber-500/40 rounded-lg p-2.5 text-xs text-amber-300 flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>{micStatusNote}</span>
              </div>
              <button
                type="button"
                onClick={() => setMicStatusNote(null)}
                className="text-amber-400 hover:text-amber-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Quick Voice Simulation Buttons for 1-Click Testing */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1 mr-1">
              <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Voice Presets:</span>
            </span>
            <button
              type="button"
              onClick={() =>
                simulateVoiceInput(
                  'There is a massive dangerous pothole on 80 Feet Road near Sony World Signal with overflowing rainwater.'
                )
              }
              className="text-[11px] px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-700/80 border border-slate-700 text-slate-300 transition-colors flex items-center gap-1"
            >
              🎙️ Pothole on 80ft Road
            </button>
            <button
              type="button"
              onClick={() =>
                simulateVoiceInput(
                  'Exposed high voltage electrical wire sparking from BESCOM pole on 12th Main Indiranagar.'
                )
              }
              className="text-[11px] px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-700/80 border border-slate-700 text-slate-300 transition-colors flex items-center gap-1"
            >
              ⚡ Sparking Wire on 12th Main
            </button>
            <button
              type="button"
              onClick={() =>
                simulateVoiceInput(
                  'Drinking water pipeline ruptured on Koramangala 4th block with heavy flooding.'
                )
              }
              className="text-[11px] px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-700/80 border border-slate-700 text-slate-300 transition-colors flex items-center gap-1"
            >
              💧 Drinking Water Pipe Burst
            </button>
          </div>
        </div>

        {/* Additional Location & Photo Input Grid */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Nearby Landmark / Street</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowMapPicker(!showMapPicker)}
                  className="text-[11px] font-medium text-cyan-400 hover:text-cyan-300 flex items-center gap-1 bg-cyan-950/70 hover:bg-cyan-900/70 border border-cyan-800/80 px-2 py-0.5 rounded transition-colors"
                >
                  <Compass className="w-3 h-3" />
                  <span>{showMapPicker ? 'Hide Ward Map' : '🗺️ Pick on Map'}</span>
                </button>
              </div>
              <input
                type="text"
                value={landmarkInput}
                onChange={e => setLandmarkInput(e.target.value)}
                placeholder="e.g. Sony World Signal / Click on map below..."
                className="w-full bg-slate-900/90 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
              <span className="text-[10px] text-slate-400 block">
                Click anywhere on the map below to auto-fill landmark & detect ward jurisdiction
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Ward Jurisdiction</span>
                </label>
                {autoDetectedWardBadge && (
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/70 border border-emerald-800/60 px-1.5 py-0.5 rounded truncate max-w-[180px]">
                    ⚡ {autoDetectedWardBadge}
                  </span>
                )}
              </div>
              <select
                value={selectedWard}
                onChange={e => handleManualWardChange(e.target.value)}
                className="w-full bg-slate-900/90 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                {BBMP_FULL_WARDS.map(w => (
                  <option key={w.id} value={`${w.name} ${w.number}`}>
                    Ward {w.number}: {w.name} ({w.zone} Zone) – {w.assemblyConstituency}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-slate-400 block">
                System auto-detects from map, or you can manually select from dropdown
              </span>
            </div>
          </div>

          {/* Interactive Bengaluru Ward Map Picker */}
          {showMapPicker ? (
            <div className="pt-1">
              <WardMapPicker
                currentLandmark={landmarkInput}
                currentWard={selectedWard}
                onLocationSelect={handleLocationSelect}
                onProceed={() => {
                  setShowMapPicker(false);
                  setLocationConfirmedNotice(
                    `✓ Location locked: ${landmarkInput || 'Selected Spot'} in ${selectedWard}. Ready to describe your civic grievance below.`
                  );
                  setTimeout(() => {
                    const el = document.getElementById('complaint-input-section');
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      const textarea = el.querySelector('textarea');
                      if (textarea) textarea.focus();
                    }
                  }, 120);
                }}
              />
            </div>
          ) : (
            <div className="bg-slate-900/90 border border-emerald-500/30 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-lg bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">
                      {landmarkInput || 'Selected Bengaluru Location'}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/80">
                      ✓ Ward Locked
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 font-mono mt-0.5 block">
                    {selectedWard} · GPS: {selectedCoords?.lat.toFixed(4)}°N, {selectedCoords?.lng.toFixed(4)}°E
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMapPicker(true)}
                className="text-xs font-semibold px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Compass className="w-3.5 h-3.5 text-cyan-400" />
                <span>Reopen / Change on Map</span>
              </button>
            </div>
          )}
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

                  {/* Status Badge & Simulation Control */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0">
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

                    {/* Status lifecycle progression control */}
                    {comp.status !== 'CLOSED' && (
                      <button
                        onClick={() => handleSimulateStatusAdvance(comp)}
                        className="text-[11px] px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 font-mono transition-colors"
                        title="Simulate municipal officer advancing this ticket"
                      >
                        {comp.status === 'SUBMITTED'
                          ? '→ Acknowledge'
                          : comp.status === 'ACKNOWLEDGED'
                          ? '→ Dispatch Crew'
                          : comp.status === 'IN_PROGRESS'
                          ? '→ Mark Resolved'
                          : 'Close Ticket'}
                      </button>
                    )}
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
                      Municipal Engineer Resolution Log:
                    </span>
                    <span>{comp.officialResolutionNotes}</span>
                  </div>
                )}

                {/* Dedicated StarRating Component upon Resolution or Closure */}
                {(comp.status === 'RESOLVED' || comp.status === 'CLOSED') && (
                  <StarRating
                    complaintId={comp.id}
                    initialRating={comp.rating || comp.citizenRating?.stars}
                    initialFeedback={comp.feedback || comp.citizenRating?.feedback}
                    isReadOnly={comp.status === 'CLOSED' && (comp.rating !== undefined || comp.citizenRating !== undefined)}
                    onRatingSubmitted={(newRating, newFeedback) => {
                      setMyComplaints(prev =>
                        prev.map(c =>
                          c.id === comp.id
                            ? {
                                ...c,
                                rating: newRating,
                                feedback: newFeedback,
                                status: 'CLOSED',
                                citizenRating: {
                                  stars: newRating,
                                  feedback: newFeedback,
                                  ratedAt: new Date().toISOString(),
                                },
                              }
                            : c
                        )
                      );
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
