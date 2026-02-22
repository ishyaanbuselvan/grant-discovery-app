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
  location: string; // City, State of organization headquarters
  artsDiscipline: 'Classical Music' | 'General Arts' | 'Humanities' | 'Performing Arts' | 'Music Education';
  fundingType: 'General Operating' | 'Project-Based' | 'Capital' | 'Fellowship' | 'Commissioning';
  funderType: 'Government' | 'Private Foundation' | 'Corporate' | 'Community Foundation' | 'Service Organization';
  eligibility: string;
  overview: string;
  contactEmail?: string;
  applicationUrl?: string;
  isInvitationOnly?: boolean;
  isActive?: boolean; // false if program has closed
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
}

export interface SavedGrantsContextType {
  savedGrants: Grant[];
  addGrant: (grant: Grant) => void;
  removeGrant: (id: string) => void;
  isGrantSaved: (id: string) => boolean;
  clearAllGrants: () => void;
}
