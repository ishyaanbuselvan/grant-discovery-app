'use client';
import { useState, useMemo } from 'react';
import { mockGrants } from '@/lib/mockData';
import { FilterState, Grant } from '@/lib/types';
import Filters from '@/components/Filters';
import GrantCard from '@/components/GrantCard';

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

  const filteredAndSortedGrants = useMemo(() => {
    // First filter
    const filtered = mockGrants.filter((grant) => {
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
  }, [filters, sortBy]);

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
