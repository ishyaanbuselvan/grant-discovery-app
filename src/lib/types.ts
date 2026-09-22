export interface Grant {
  id: string;
  organizationName: string;
  website: string;
  budgetMin: number;
  budgetMax: number;
  deadline: string; // Next upcoming deadline in YYYY-MM-DD format, or empty if invitation-only
  deadlineType?: 'fixed' | 'rolling' | 'invitation_only';
  rollingDates?: string; // For rolling: "Jan 30, Apr 30, Jul 30, Oct 30" or "Quarterly" etc.
  deadlineNotes?: string; // Additional notes about deadlines
  location: string; // City, State (kept for backward compatibility)
  funderHq?: string; // City, State where the foundation is headquartered (display only)
  eligibleGeography?: string; // Who can apply: "National", "DC-MD-VA", "DC", "Virginia", etc.
  artsDiscipline: 'Classical Music' | 'General Arts' | 'Humanities' | 'Performing Arts' | 'Music Education';
  fundingType: 'General Operating' | 'Project-Based' | 'Capital' | 'Fellowship' | 'Commissioning';
  funderType: 'Government' | 'Private Foundation' | 'Corporate' | 'Community Foundation' | 'Service Organization';
  applicantType?: 'Organization' | 'Individual' | 'Both'; // Who can apply
  eligibility: string;
  overview: string;
  contactEmail?: string;
  applicationUrl?: string;
  sourceUrl?: string; // Primary source for grant information
  isInvitationOnly?: boolean;
  isActive?: boolean; // false if program has closed
  lastVerified?: string; // YYYY-MM-DD when this entry was last verified against primary source
  isAIGenerated?: boolean; // true if extracted by AI analyzer, false/undefined if human-curated
  // Pipeline tracking (for saved grants)
  pipelineStatus?: 'not_reviewed' | 'shortlisted' | 'drafting' | 'submitted' | 'awarded' | 'declined';
  pipelineOwner?: string; // Committee member name
  pipelineNotes?: string; // Free-text notes
}

export interface FilterState {
  search: string;
  deadlineMonth: string;
  budgetMin: number;
  budgetMax: number;
  location: string;
  artsDiscipline: string;
  fundingType: string;
  funderType: string;
  applicantType?: string;
  eligibleGeography?: string;
  showFMMCEligibleOnly?: boolean;
  hidePastDeadlines?: boolean;
}

export interface SavedGrantsContextType {
  savedGrants: Grant[];
  addGrant: (grant: Grant) => void;
  removeGrant: (id: string) => void;
  isGrantSaved: (id: string) => boolean;
  clearAllGrants: () => void;
  updateGrantStatus?: (id: string, status: Grant['pipelineStatus']) => void;
  updateGrantOwner?: (id: string, owner: string) => void;
  updateGrantNotes?: (id: string, notes: string) => void;
}
