'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSavedGrants } from '@/context/SavedGrantsContext';

export default function Navigation() {
  const pathname = usePathname();
  const { savedGrants } = useSavedGrants();

  const navItems = [
    { href: '/search', label: 'Search Grants', icon: '♪' },
    { href: '/analyze', label: 'Analyze Links', icon: '✦' },
    { href: '/saved', label: 'Saved Grants', icon: '♡', count: savedGrants.length },
  ];

  return (
    <nav className="bg-[var(--midnight)] text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center space-x-3">
            <span className="text-[var(--gold)] text-2xl">♫</span>
            <div>
              <h1 className="text-xl font-semibold tracking-wide" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                Luminarts
              </h1>
              <p className="text-xs text-[var(--slate-light)] -mt-1">Friday Morning Music Club</p>
            </div>
          </Link>

          <div className="flex items-center space-x-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center space-x-2
                    ${isActive
                      ? 'bg-[var(--gold)] text-[var(--midnight-dark)]'
                      : 'text-white/80 hover:bg-[var(--midnight-light)] hover:text-white'
                    }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                  {item.count !== undefined && item.count > 0 && (
                    <span className={`ml-1 px-2 py-0.5 text-xs rounded-full ${
                      isActive ? 'bg-[var(--midnight)] text-white' : 'bg-[var(--gold)] text-[var(--midnight)]'
                    }`}>
                      {item.count}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
