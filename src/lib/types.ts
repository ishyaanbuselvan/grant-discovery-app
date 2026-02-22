export interface Grant {
  id: string;
  organizationName: string;
  website: string;
  budgetMin: number;
  budgetMax: number;
  deadline: string;
  deadlineNotes?: string; // For rolling deadlines, multiple cycles, or special notes
  location: string;
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
