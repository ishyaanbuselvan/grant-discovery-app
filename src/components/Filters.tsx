'use client';
import { FilterState } from '@/lib/types';
import { artsDisciplines, fundingTypes, funderTypes, locations } from '@/lib/mockData';

interface FiltersProps {
  filters: FilterState;
  setFilters: (filters: FilterState) => void;
  onReset: () => void;
}

export default function Filters({ filters, setFilters, onReset }: FiltersProps) {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handleTodayClick = () => {
    const today = new Date();
    const threeMonthsLater = new Date(today);
    threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);
    const monthIndex = threeMonthsLater.getMonth();
    setFilters({ ...filters, deadlineMonth: months[monthIndex] });
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount}`;
  };

  return (
    <div className="bg-white rounded-xl border border-[var(--card-border)] p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--midnight)]" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
          Filter Grants
        </h2>
        <button
          onClick={onReset}
          className="text-sm text-[var(--slate)] hover:text-[var(--gold)]"
        >
          Reset All
        </button>
      </div>

      {/* Search */}
      <div>
        <label className="block text-sm font-medium text-[var(--slate-dark)] mb-1.5">Search</label>
        <input
          type="text"
          placeholder="Organization name or keyword..."
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          className="w-full px-3 py-2 border border-[var(--card-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--gold)] focus:ring-1 focus:ring-[var(--gold)]"
        />
      </div>

      {/* Deadline */}
      <div>
        <label className="block text-sm font-medium text-[var(--slate-dark)] mb-1.5">Deadline</label>
        <div className="flex gap-2">
          <select
            value={filters.deadlineMonth}
            onChange={(e) => setFilters({ ...filters, deadlineMonth: e.target.value })}
            className="flex-1 px-3 py-2 border border-[var(--card-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--gold)]"
          >
            <option value="">Any month</option>
            {months.map((month) => (
              <option key={month} value={month}>{month}</option>
            ))}
          </select>
          <button
            onClick={handleTodayClick}
            className="px-3 py-2 text-xs bg-[var(--background-alt)] border border-[var(--card-border)] rounded-lg hover:border-[var(--gold)] hover:text-[var(--gold)]"
            title="Set to 3 months from today"
          >
            +3mo
          </button>
        </div>
      </div>

      {/* Budget Range */}
      <div>
        <label className="block text-sm font-medium text-[var(--slate-dark)] mb-1.5">
          Award Amount: {formatCurrency(filters.budgetMin)} - {formatCurrency(filters.budgetMax)}
        </label>
        <div className="space-y-3">
          <div>
            <span className="text-xs text-[var(--slate)]">Minimum</span>
            <input
              type="range"
              min={0}
              max={500000}
              step={1000}
              value={filters.budgetMin}
              onChange={(e) => setFilters({ ...filters, budgetMin: Number(e.target.value) })}
              className="w-full"
            />
          </div>
          <div>
            <span className="text-xs text-[var(--slate)]">Maximum</span>
            <input
              type="range"
              min={0}
              max={500000}
              step={1000}
              value={filters.budgetMax}
              onChange={(e) => setFilters({ ...filters, budgetMax: Number(e.target.value) })}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Location */}
      <div>
        <label className="block text-sm font-medium text-[var(--slate-dark)] mb-1.5">Location</label>
        <select
          value={filters.location}
          onChange={(e) => setFilters({ ...filters, location: e.target.value })}
          className="w-full px-3 py-2 border border-[var(--card-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--gold)]"
        >
          <option value="">Any location</option>
          {locations.map((loc) => (
            <option key={loc} value={loc}>{loc}</option>
          ))}
        </select>
      </div>

      {/* Arts Discipline */}
      <div>
        <label className="block text-sm font-medium text-[var(--slate-dark)] mb-1.5">Arts Discipline</label>
        <select
          value={filters.artsDiscipline}
          onChange={(e) => setFilters({ ...filters, artsDiscipline: e.target.value })}
          className="w-full px-3 py-2 border border-[var(--card-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--gold)]"
        >
          <option value="">All disciplines</option>
          {artsDisciplines.map((disc) => (
            <option key={disc} value={disc}>{disc}</option>
          ))}
        </select>
      </div>

      {/* Funding Type */}
      <div>
        <label className="block text-sm font-medium text-[var(--slate-dark)] mb-1.5">Funding Type</label>
        <select
          value={filters.fundingType}
          onChange={(e) => setFilters({ ...filters, fundingType: e.target.value })}
          className="w-full px-3 py-2 border border-[var(--card-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--gold)]"
        >
          <option value="">All types</option>
          {fundingTypes.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>

      {/* Funder Type */}
      <div>
        <label className="block text-sm font-medium text-[var(--slate-dark)] mb-1.5">Funder Type</label>
        <select
          value={filters.funderType}
          onChange={(e) => setFilters({ ...filters, funderType: e.target.value })}
          className="w-full px-3 py-2 border border-[var(--card-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--gold)]"
        >
          <option value="">All funders</option>
          {funderTypes.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
