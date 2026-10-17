import React, { useState } from 'react';
import { Star, CheckCircle2, MessageSquare, Send } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase.ts';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

interface StarRatingProps {
  complaintId: string;
  initialRating?: number;
  initialFeedback?: string;
  isReadOnly?: boolean;
  onRatingSubmitted?: (rating: number, feedback: string) => void;
}

const RATING_LABELS: Record<number, string> = {
  1: '1 - Poor (Issue unresolved or sub-standard)',
  2: '2 - Fair (Partial repair, incomplete)',
  3: '3 - Satisfactory (Fixed as required)',
  4: '4 - Very Good (Prompt & clean repair)',
  5: '5 - Excellent (Outstanding speed & quality)',
};

const FEEDBACK_PRESETS = [
  'Fixed on time',
  'High quality asphalt/pipe repair',
  'Debris & trash cleaned up',
  'Courteous field squad',
  'Durable and clean finish',
];

export const StarRating: React.FC<StarRatingProps> = ({
  complaintId,
  initialRating = 0,
  initialFeedback = '',
  isReadOnly = false,
  onRatingSubmitted,
}) => {
  const [rating, setRating] = useState<number>(initialRating);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [feedback, setFeedback] = useState<string>(initialFeedback);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(initialRating > 0);

  const activeStars = hoverRating || rating;

  const handleSelectStar = (selected: number) => {
    if (isReadOnly || isSubmitted) return;
    setRating(selected);
  };

  const handleAddPreset = (preset: string) => {
    if (isReadOnly || isSubmitted) return;
    setFeedback(prev => (prev ? `${prev}, ${preset.toLowerCase()}` : preset));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0 || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const finalFeedback = feedback.trim() || 'Civic resolution verified and approved by citizen.';

      // Update Firestore document with rating, feedback, and advance status to CLOSED
      const ref = doc(db, 'complaints', complaintId);
      await updateDoc(ref, {
        rating: rating,
        feedback: finalFeedback,
        citizenRating: {
          stars: rating,
          feedback: finalFeedback,
          ratedAt: new Date().toISOString(),
        },
        status: 'CLOSED',
        updatedAt: serverTimestamp(),
      });

      setIsSubmitted(true);
      if (onRatingSubmitted) {
        onRatingSubmitted(rating, finalFeedback);
      }
    } catch (err) {
      console.error('Error saving rating:', err);
      handleFirestoreError(err, OperationType.UPDATE, `complaints/${complaintId}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Read-only presentation mode
  if (isReadOnly || (isSubmitted && initialRating > 0)) {
    return (
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="flex items-center">
            {[1, 2, 3, 4, 5].map(star => (
              <Star
                key={star}
                className={`w-4 h-4 ${
                  star <= (rating || initialRating)
                    ? 'text-amber-400 fill-amber-400'
                    : 'text-slate-600'
                }`}
              />
            ))}
          </div>
          <span className="font-mono font-bold text-amber-400">
            {rating || initialRating}.0/5
          </span>
          <span className="text-slate-500">· Citizen Verified</span>
        </div>
        {(feedback || initialFeedback) && (
          <p className="text-slate-300 italic text-[11px] bg-slate-950/60 px-2.5 py-1.5 rounded border border-slate-800">
            "{feedback || initialFeedback}"
          </p>
        )}
      </div>
    );
  }

  // Interactive Form mode
  return (
    <div className="bg-slate-950/80 border border-emerald-500/40 rounded-xl p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold font-mono">
          <CheckCircle2 className="w-4 h-4" />
          <span>RESOLUTION QUALITY AUDIT · CITIZEN RATING</span>
        </div>
        <span className="text-xs text-slate-400">1-5 Stars Required</span>
      </div>

      {isSubmitted ? (
        <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-lg flex items-center gap-3 text-xs text-emerald-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <span className="font-bold block">Rating & Feedback Successfully Recorded!</span>
            <span>Thank you for verifying the ward repair work. Your ticket is now officially closed.</span>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Star selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300 block">
              How would you rate the speed and quality of this municipal repair?
            </label>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => handleSelectStar(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-1 text-slate-600 hover:scale-125 transition-transform focus:outline-none"
                    title={`Rate ${star} star${star > 1 ? 's' : ''}`}
                  >
                    <Star
                      className={`w-6 h-6 transition-colors ${
                        star <= activeStars
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-slate-700 hover:text-slate-500'
                      }`}
                    />
                  </button>
                ))}
              </div>
              <span className="text-xs font-mono font-semibold text-amber-400 ml-2">
                {activeStars > 0 ? RATING_LABELS[activeStars] : 'Select your rating'}
              </span>
            </div>
          </div>

          {/* Quick preset chips */}
          <div className="space-y-1.5">
            <span className="text-[11px] text-slate-400 block font-medium">
              Quick Feedback Tags (click to add):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {FEEDBACK_PRESETS.map((preset, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleAddPreset(preset)}
                  className="text-[11px] px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/80 transition-colors"
                >
                  + {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Freeform feedback text area */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
              <span>Additional Comments or Suggestions for the Ward Squad</span>
            </label>
            <textarea
              rows={2}
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder="e.g. Repaired within 24 hours, asphalt is smooth and road is completely reopened."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all resize-none"
            />
          </div>

          {/* Submit action */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-500">
              Ratings directly impact Ward Engineering SLA scorecards
            </span>
            <button
              type="submit"
              disabled={rating === 0 || isSubmitting}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all disabled:opacity-50 shadow-md shadow-emerald-950"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Submitting...' : 'Submit Resolution Rating'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
