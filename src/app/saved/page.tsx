'use client';
import { useSavedGrants } from '@/context/SavedGrantsContext';
import GrantCard from '@/components/GrantCard';
import * as XLSX from 'xlsx';

export default function SavedPage() {
  const { savedGrants, clearAllGrants } = useSavedGrants();

  const exportToExcel = () => {
    if (savedGrants.length === 0) {
      alert('No grants to export');
      return;
    }

    const worksheetData = savedGrants.map((grant) => ({
      'Organization Name': grant.organizationName,
      'Website': grant.website,
      'Budget Min': grant.budgetMin,
      'Budget Max': grant.budgetMax,
      'Deadline': grant.deadline,
      'Location': grant.location,
      'Arts Discipline': grant.artsDiscipline,
      'Funding Type': grant.fundingType,
      'Eligibility': grant.eligibility,
      'Overview': grant.overview,
      'Contact Email': grant.contactEmail || '',
      'Application URL': grant.applicationUrl || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Saved Grants');

    // Auto-size columns
    const columnWidths = [
      { wch: 35 }, // Organization Name
      { wch: 40 }, // Website
      { wch: 12 }, // Budget Min
      { wch: 12 }, // Budget Max
      { wch: 12 }, // Deadline
      { wch: 18 }, // Location
      { wch: 18 }, // Arts Discipline
      { wch: 18 }, // Funding Type
      { wch: 50 }, // Eligibility
      { wch: 80 }, // Overview
      { wch: 30 }, // Contact Email
      { wch: 50 }, // Application URL
    ];
    worksheet['!cols'] = columnWidths;

    const today = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `luminarts-grants-${today}.xlsx`);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[var(--midnight)] mb-2" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
            Saved Grants
          </h1>
          <p className="text-[var(--slate)]">
            {savedGrants.length} grant{savedGrants.length !== 1 ? 's' : ''} saved for review
          </p>
        </div>

        {savedGrants.length > 0 && (
          <div className="flex items-center space-x-3">
            <button
              onClick={clearAllGrants}
              className="px-4 py-2 text-sm border border-[var(--card-border)] rounded-lg text-[var(--slate-dark)] hover:border-red-300 hover:text-red-600"
            >
              Clear All
            </button>
            <button
              onClick={exportToExcel}
              className="btn-primary px-6 py-2.5 flex items-center space-x-2"
            >
              <span>&#128196;</span>
              <span>Export to Excel</span>
            </button>
          </div>
        )}
      </div>

      {savedGrants.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4 opacity-20">&#9825;</div>
          <h3 className="text-xl font-medium text-[var(--midnight)] mb-2" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
            No saved grants yet
          </h3>
          <p className="text-[var(--slate)] mb-6 max-w-md mx-auto">
            Browse the Grant Discovery page or use the AI Link Analyzer to find grants,
            then click the heart icon to save them here.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href="/search" className="btn-primary px-6 py-2.5">
              Search Grants
            </a>
            <a href="/analyze" className="btn-secondary px-6 py-2.5">
              Analyze Links
            </a>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {savedGrants.map((grant) => (
            <GrantCard key={grant.id} grant={grant} />
          ))}

          <div className="mt-8 p-6 bg-[var(--background-alt)] rounded-xl text-center">
            <p className="text-[var(--slate-dark)] mb-4">
              Ready to export your research? Download all saved grants as an Excel spreadsheet.
            </p>
            <button
              onClick={exportToExcel}
              className="btn-primary px-8 py-3 text-lg flex items-center space-x-2 mx-auto"
            >
              <span>&#128196;</span>
              <span>Export {savedGrants.length} Grant{savedGrants.length !== 1 ? 's' : ''} to Excel</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
