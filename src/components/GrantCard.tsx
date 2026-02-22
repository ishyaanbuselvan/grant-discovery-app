'use client';
import { useState } from 'react';
import { Grant } from '@/lib/types';
import { useSavedGrants } from '@/context/SavedGrantsContext';

interface GrantCardProps {
  grant: Grant;
  showSaveButton?: boolean;
}

export default function GrantCard({ grant, showSaveButton = true }: GrantCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { addGrant, removeGrant, isGrantSaved } = useSavedGrants();
  const isSaved = isGrantSaved(grant.id);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const getDaysUntilDeadline = (dateStr: string) => {
    const deadline = new Date(dateStr);
    const today = new Date();
    const diffTime = deadline.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysLeft = grant.deadline ? getDaysUntilDeadline(grant.deadline) : null;

  return (
    <div className="grant-card overflow-hidden">
      <div
        className="p-5 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center flex-wrap gap-2 mb-2">
              <h3 className="text-lg font-semibold text-[var(--midnight)]" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                {grant.organizationName}
              </h3>
              <span className="px-2 py-0.5 text-xs rounded-full bg-[var(--background-alt)] text-[var(--slate-dark)]">
                {grant.artsDiscipline}
              </span>
              {grant.isInvitationOnly && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">
                  Invitation Only
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--slate)]">
              <span className="flex items-center">
                <span className="text-[var(--gold)] mr-1">$</span>
                {formatCurrency(grant.budgetMin)} - {formatCurrency(grant.budgetMax)}
              </span>
              <span className="flex items-center">
                <span className="mr-1">&#128205;</span>
                {grant.location}
              </span>
              {grant.deadlineType === 'invitation_only' ? (
                <span className="flex items-center text-amber-600">
                  <span className="mr-1">&#128197;</span>
                  By Invitation Only
                </span>
              ) : grant.deadlineType === 'rolling' ? (
                <span className="flex items-center text-emerald-600">
                  <span className="mr-1">&#128197;</span>
                  Rolling: {grant.rollingDates || (grant.deadline ? `Next: ${formatDate(grant.deadline)}` : 'See website')}
                </span>
              ) : grant.deadline ? (
                <span className={`flex items-center ${daysLeft && daysLeft <= 30 ? 'text-red-600 font-medium' : ''}`}>
                  <span className="mr-1">&#128197;</span>
                  {formatDate(grant.deadline)}
                  {daysLeft && daysLeft > 0 && daysLeft <= 60 && (
                    <span className="ml-1 text-xs">({daysLeft} days)</span>
                  )}
                </span>
              ) : (
                <span className="flex items-center text-[var(--slate)]">
                  <span className="mr-1">&#128197;</span>
                  See website for deadline
                </span>
              )}
              <span className="px-2 py-0.5 text-xs rounded bg-[var(--midnight)]/10 text-[var(--midnight)]">
                {grant.fundingType}
              </span>
              <span className="px-2 py-0.5 text-xs rounded bg-[var(--gold)]/20 text-[var(--gold-dark)]">
                {grant.funderType}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 ml-4">
            {showSaveButton && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  isSaved ? removeGrant(grant.id) : addGrant(grant);
                }}
                className={`p-2 rounded-lg transition-all ${
                  isSaved
                    ? 'bg-[var(--gold)] text-white'
                    : 'bg-[var(--background-alt)] text-[var(--slate)] hover:bg-[var(--gold)]/20 hover:text-[var(--gold)]'
                }`}
                title={isSaved ? 'Remove from saved' : 'Save grant'}
              >
                {isSaved ? '♥' : '♡'}
              </button>
            )}
            <span className={`text-[var(--slate)] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="px-5 pb-5 pt-0 border-t border-[var(--card-border)]">
          <div className="pt-4 space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-[var(--midnight)] mb-1">Overview</h4>
              <p className="text-sm text-[var(--slate-dark)] leading-relaxed">{grant.overview}</p>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-[var(--midnight)] mb-1">Eligibility</h4>
              <p className="text-sm text-[var(--slate-dark)]">{grant.eligibility}</p>
            </div>

            {grant.deadlineNotes && (
              <div>
                <h4 className="text-sm font-semibold text-[var(--midnight)] mb-1">Deadline Details</h4>
                <p className="text-sm text-[var(--slate-dark)]">{grant.deadlineNotes}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-3 pt-2">
              <a
                href={grant.website}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary text-sm inline-flex items-center"
                onClick={(e) => e.stopPropagation()}
              >
                Visit Website →
              </a>
              {grant.applicationUrl && (
                <a
                  href={grant.applicationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary text-sm inline-flex items-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  Apply Now
                </a>
              )}
              {grant.contactEmail && (
                <a
                  href={`mailto:${grant.contactEmail}`}
                  className="px-4 py-2 text-sm border border-[var(--card-border)] rounded-lg text-[var(--slate-dark)] hover:border-[var(--gold)] hover:text-[var(--gold)]"
                  onClick={(e) => e.stopPropagation()}
                >
                  Contact: {grant.contactEmail}
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
