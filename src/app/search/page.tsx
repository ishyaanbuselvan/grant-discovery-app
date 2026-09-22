'use client';
import { useState, useMemo, useEffect } from 'react';
import { mockGrants } from '@/lib/mockData';
import { FilterState, Grant } from '@/lib/types';
import Filters from '@/components/Filters';
import GrantCard from '@/components/GrantCard';
import { useDiscoveredGrants } from '@/context/DiscoveredGrantsContext';
import { useReceivedGrants } from '@/context/ReceivedGrantsContext';

const initialFilters: FilterState = {
  search: '',
  deadlineMonth: '',
  budgetMin: 0,
  budgetMax: 500000,
  location: '',
  artsDiscipline: '',
  fundingType: '',
  funderType: '',
};

type SortOption = 'deadline' | 'amount-high' | 'amount-low' | 'name';

export default function SearchPage() {
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [sortBy, setSortBy] = useState<SortOption>('deadline');
  const [hidePastDeadlines, setHidePastDeadlines] = useState(false);
  const [hideReceivedGrants, setHideReceivedGrants] = useState(false);
  const [showFMMCEligibleOnly, setShowFMMCEligibleOnly] = useState(true); // Default ON per requirements
  const [hideIndividualGrants, setHideIndividualGrants] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const { discoveredGrants } = useDiscoveredGrants();
  const { isGrantReceived } = useReceivedGrants();

  // Check if a grant is FMMC-eligible (Organization, DC/MD/VA or National)
  const isFMMCEligible = (grant: Grant): boolean => {
    // Check applicant type - must accept organizations
    const applicantOk = !grant.applicantType || grant.applicantType === 'Organization' || grant.applicantType === 'Both';
    if (!applicantOk) return false;

    // Check geography from explicit field first
    const geo = grant.eligibleGeography?.toLowerCase() || '';
    if (geo) {
      return geo.includes('national') ||
             geo.includes('dc') ||
             geo.includes('maryland') ||
             geo.includes('virginia') ||
             geo.includes('mid-atlantic');
    }

    // No explicit geography - check eligibility text for state restrictions
    const eligText = grant.eligibility?.toLowerCase() || '';
    const orgName = grant.organizationName?.toLowerCase() || '';
    const loc = grant.location?.toLowerCase() || '';

    // List of states that would exclude FMMC (DC-based org)
    const otherStates = [
      'california', 'new york state', 'ny-based', 'new york-based', 'nyc-based',
      'texas', 'ohio', 'pennsylvania', 'pa-based', 'illinois', 'chicago',
      'massachusetts', 'boston', 'michigan', 'detroit', 'florida', 'georgia', 'atlanta',
      'north carolina', 'south carolina', 'alabama', 'louisiana', 'mississippi',
      'tennessee', 'kentucky', 'arizona', 'colorado', 'oregon', 'seattle', 'washington state',
      'minnesota', 'new jersey', 'connecticut', 'new england', 'philadelphia',
      'staten island', 'brooklyn', 'queens', 'bronx', 'manhattan-based',
      'pittsburgh', 'cleveland', 'indianapolis', 'houston', 'miami', 'denver',
      'san francisco', 'los angeles', 'southern arts', 'south arts'
    ];

    // Check if eligibility text mentions a specific non-DC state requirement
    for (const state of otherStates) {
      if (eligText.includes(state + '-based') ||
          eligText.includes(state + ' based') ||
          eligText.includes(state + '-incorporated') ||
          eligText.includes('based in ' + state) ||
          eligText.includes('located in ' + state) ||
          eligText.includes(state + ' organizations') ||
          eligText.includes(state + ' nonprofits') ||
          eligText.includes(state + ' artists')) {
        return false;
      }
    }

    // Check org name for state-specific councils/foundations
    const stateSpecificOrgs = [
      'california arts', 'new york state council', 'nysca', 'pennsylvania council',
      'ohio arts', 'texas commission', 'michigan arts', 'minnesota state arts',
      'colorado creative', 'arizona commission', 'georgia council', 'florida division',
      'massachusetts cultural', 'connecticut office', 'oregon arts', 'illinois arts',
      'new jersey state', 'north carolina arts', 'south carolina arts',
      'brooklyn arts', 'queens council', 'staten island', 'bronx council',
      'lower manhattan', 'seattle office', 'san francisco arts', 'denver arts',
      'houston arts', 'miami-dade', 'atlanta office', 'indianapolis',
      'cleveland foundation', 'boston foundation', 'pittsburgh', 'detroit',
      'south arts', 'new england foundation', 'arts midwest', 'westaf', 'western states'
    ];

    for (const org of stateSpecificOrgs) {
      if (orgName.includes(org)) {
        return false;
      }
    }

    // DC/MD/VA area funders or national funders - FMMC eligible
    const dcAreaIndicators = ['washington', 'dc', 'd.c.', 'maryland', 'virginia', 'baltimore', 'mid atlantic', 'mid-atlantic'];
    const isLocalFunder = dcAreaIndicators.some(ind => loc.includes(ind));

    // National funders (NEA, major foundations) or DC-area funders are eligible
    const nationalIndicators = ['national', 'us-based', 'u.s.-based', 'nationwide', 'united states'];
    const isNational = nationalIndicators.some(ind => eligText.includes(ind)) ||
                       orgName.includes('national endowment') ||
                       orgName.includes('nea ') ||
                       grant.funderType === 'Private Foundation'; // Most private foundations fund nationally

    return isLocalFunder || isNational;
  };

  // Load filter preferences from localStorage on mount
  useEffect(() => {
    const savedHidePast = localStorage.getItem('luminarts-hide-past-deadlines');
    const savedHideReceived = localStorage.getItem('luminarts-hide-received');
    const savedFMMCOnly = localStorage.getItem('luminarts-fmmc-eligible-only');
    const savedHideIndividual = localStorage.getItem('luminarts-hide-individual');
    if (savedHidePast !== null) setHidePastDeadlines(savedHidePast === 'true');
    if (savedHideReceived !== null) setHideReceivedGrants(savedHideReceived === 'true');
    if (savedFMMCOnly !== null) setShowFMMCEligibleOnly(savedFMMCOnly === 'true');
    if (savedHideIndividual !== null) setHideIndividualGrants(savedHideIndividual === 'true');
    setIsLoaded(true);
  }, []);

  // Save filter preferences to localStorage when they change
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('luminarts-hide-past-deadlines', String(hidePastDeadlines));
      localStorage.setItem('luminarts-hide-received', String(hideReceivedGrants));
      localStorage.setItem('luminarts-fmmc-eligible-only', String(showFMMCEligibleOnly));
      localStorage.setItem('luminarts-hide-individual', String(hideIndividualGrants));
    }
  }, [hidePastDeadlines, hideReceivedGrants, showFMMCEligibleOnly, hideIndividualGrants, isLoaded]);

  // Combine mockGrants with discovered grants (user-analyzed)
  const allGrants = useMemo(() => {
    const combined = [...mockGrants];
    // Add discovered grants that aren't duplicates
    discoveredGrants.forEach(dg => {
      const normalizeUrl = (url: string) => {
        try {
          return new URL(url).hostname.replace('www.', '').toLowerCase();
        } catch {
          return url.toLowerCase();
        }
      };
      const dgNormalized = normalizeUrl(dg.website);
      const isDuplicate = combined.some(g => normalizeUrl(g.website) === dgNormalized);
      if (!isDuplicate) {
        combined.push(dg);
      }
    });
    return combined;
  }, [discoveredGrants]);

  const filteredAndSortedGrants = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset to start of day for accurate comparison

    // First filter
    const filtered = allGrants.filter((grant) => {
      // Hide received grants filter
      if (hideReceivedGrants && isGrantReceived(grant.id)) {
        return false;
      }

      // Hide past deadlines filter
      if (hidePastDeadlines && grant.deadline) {
        const deadlineDate = new Date(grant.deadline);
        if (deadlineDate < today) return false;
      }

      // FMMC-eligible only filter
      if (showFMMCEligibleOnly && !isFMMCEligible(grant)) {
        return false;
      }

      // Hide individual artist grants (show only org-eligible)
      if (hideIndividualGrants && grant.applicantType === 'Individual') {
        return false;
      }

      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch =
          grant.organizationName.toLowerCase().includes(searchLower) ||
          grant.overview.toLowerCase().includes(searchLower) ||
          grant.eligibility.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Deadline month filter
      if (filters.deadlineMonth) {
        if (!grant.deadline) return false;
        const grantDate = new Date(grant.deadline);
        const grantMonth = grantDate.toLocaleString('en-US', { month: 'long' });
        if (grantMonth !== filters.deadlineMonth) return false;
      }

      // Budget filter
      if (grant.budgetMax < filters.budgetMin || grant.budgetMin > filters.budgetMax) {
        return false;
      }

      // Location filter
      if (filters.location && grant.location !== filters.location) {
        return false;
      }

      // Arts discipline filter
      if (filters.artsDiscipline && grant.artsDiscipline !== filters.artsDiscipline) {
        return false;
      }

      // Funding type filter
      if (filters.fundingType && grant.fundingType !== filters.fundingType) {
        return false;
      }

      // Funder type filter
      if (filters.funderType && grant.funderType !== filters.funderType) {
        return false;
      }

      return true;
    });

    // Then sort
    const sorted = [...filtered].sort((a: Grant, b: Grant) => {
      switch (sortBy) {
        case 'deadline':
          // Put grants with no deadline at the end
          if (!a.deadline && !b.deadline) return 0;
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        case 'amount-high':
          return b.budgetMax - a.budgetMax;
        case 'amount-low':
          return a.budgetMin - b.budgetMin;
        case 'name':
          return a.organizationName.localeCompare(b.organizationName);
        default:
          return 0;
      }
    });

    return sorted;
  }, [filters, sortBy, allGrants, hidePastDeadlines, hideReceivedGrants, showFMMCEligibleOnly, hideIndividualGrants, isGrantReceived, isFMMCEligible]);

  const resetFilters = () => setFilters(initialFilters);

  const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
    if (key === 'budgetMin') return value !== 0;
    if (key === 'budgetMax') return value !== 500000;
    return value !== '';
  });

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortBy(e.target.value as SortOption);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[var(--midnight)] mb-2" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
          Grant Discovery
        </h1>
        <p className="text-[var(--slate)]">
          Explore funding opportunities for classical music and performing arts organizations
        </p>
      </div>

      {/* Quick Filter Toggles */}
      <div className="mb-6 flex flex-wrap gap-3">
        <button
          onClick={() => setShowFMMCEligibleOnly(!showFMMCEligibleOnly)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            showFMMCEligibleOnly
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-white border border-[var(--card-border)] text-[var(--midnight)] hover:border-blue-500'
          }`}
          title="Show only grants that FMMC can apply to (organizations, DC/MD/VA or National)"
        >
          {showFMMCEligibleOnly ? '✓ FMMC Eligible Only' : 'Show All Grants'}
        </button>
        <button
          onClick={() => setHidePastDeadlines(!hidePastDeadlines)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            hidePastDeadlines
              ? 'bg-[var(--gold)] text-white hover:bg-[var(--gold-dark)]'
              : 'bg-white border border-[var(--card-border)] text-[var(--midnight)] hover:border-[var(--gold)]'
          }`}
        >
          {hidePastDeadlines ? '✓ Hiding Past Deadlines' : 'Hide Past Deadlines'}
        </button>
        <button
          onClick={() => setHideReceivedGrants(!hideReceivedGrants)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            hideReceivedGrants
              ? 'bg-emerald-500 text-white hover:bg-emerald-600'
              : 'bg-white border border-[var(--card-border)] text-[var(--midnight)] hover:border-emerald-500'
          }`}
        >
          {hideReceivedGrants ? '✓ Hiding Already Received' : 'Hide Already Received'}
        </button>
        <button
          onClick={() => setHideIndividualGrants(!hideIndividualGrants)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            hideIndividualGrants
              ? 'bg-purple-600 text-white hover:bg-purple-700'
              : 'bg-white border border-[var(--card-border)] text-[var(--midnight)] hover:border-purple-500'
          }`}
          title="Hide grants for individual artists only"
        >
          {hideIndividualGrants ? '✓ Organizations Only' : 'Include Individual Grants'}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Filters Sidebar */}
        <div className="lg:w-80 flex-shrink-0">
          <div className="lg:sticky lg:top-8">
            <Filters filters={filters} setFilters={setFilters} onReset={resetFilters} />
          </div>
        </div>

        {/* Results */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-[var(--slate)]">
              {filteredAndSortedGrants.length} grant{filteredAndSortedGrants.length !== 1 ? 's' : ''} found
              {hasActiveFilters && ' (filtered)'}
            </p>
            <select
              className="px-3 py-1.5 text-sm border border-[var(--card-border)] rounded-lg focus:outline-none focus:border-[var(--gold)]"
              value={sortBy}
              onChange={handleSortChange}
            >
              <option value="deadline">Sort by Deadline</option>
              <option value="amount-high">Amount: High to Low</option>
              <option value="amount-low">Amount: Low to High</option>
              <option value="name">Organization Name</option>
            </select>
          </div>

          {filteredAndSortedGrants.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-4">&#9835;</div>
              <h3 className="text-lg font-medium text-[var(--midnight)] mb-2">No grants found</h3>
              <p className="text-[var(--slate)] mb-4">Try adjusting your filters to see more results</p>
              <button onClick={resetFilters} className="btn-primary">
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAndSortedGrants.map((grant) => (
                <GrantCard key={grant.id} grant={grant} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
