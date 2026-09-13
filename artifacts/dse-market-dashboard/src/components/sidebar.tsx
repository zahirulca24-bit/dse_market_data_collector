import { useEffect, useState } from 'react';
import { Activity, Database, LineChart, PieChart, X } from 'lucide-react';
import { useLocation } from 'wouter';

type ActivePage = 'overview' | 'historical' | 'sectors' | 'ingestion';

const navigation = [
  { id: 'overview' as const, href: '/', label: 'Live overview', icon: Activity },
  { id: 'historical' as const, href: '/historical', label: 'Historical explorer', icon: LineChart },
  { id: 'sectors' as const, href: '/sectors', label: 'Sector mapping', icon: PieChart },
  { id: 'ingestion' as const, href: '/ingestion', label: 'Ingestion monitor', icon: Database },
];

function SidebarContent({ active, onNavigate }: { active: ActivePage; onNavigate?: () => void }) {
  const [, navigate] = useLocation();

  const go = (href: string) => {
    navigate(href);
    onNavigate?.();
  };

  return <>
    <div className="flex h-[70px] items-center gap-3 border-b border-[#364150] px-5">
      <div className="grid size-8 place-items-center rounded bg-[#f4c95d] text-[#18212c]"><BarChartIcon /></div>
      <div><p className="font-mono text-[10px] font-medium uppercase tracking-[.18em] text-[#f4c95d]">DSE</p><p className="text-sm font-semibold text-white">Market ops</p></div>
    </div>
    <div className="px-3 py-6">
      <p className="px-2 font-mono text-[9px] uppercase tracking-[.18em] text-slate-500">Workspace</p>
      <nav className="mt-3 space-y-1" aria-label="Dashboard pages">
        {navigation.map((item) => {
          const Icon = item.icon;
          const selected = item.id === active;
          return <button
            key={item.id}
            type="button"
            onClick={() => go(item.href)}
            aria-current={selected ? 'page' : undefined}
            className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-xs transition-colors ${selected ? 'bg-[#2a3542] font-semibold text-white' : 'text-slate-400 hover:bg-[#222d39] hover:text-white'}`}
          >
            <Icon size={15} className={selected ? 'text-[#f4c95d]' : undefined} /> {item.label}
          </button>;
        })}
      </nav>
    </div>
  </>;
}

export function Sidebar({ active }: { active: ActivePage }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const openSidebar = () => setMobileOpen(true);
    window.addEventListener('dse-open-mobile-sidebar', openSidebar);
    return () => window.removeEventListener('dse-open-mobile-sidebar', openSidebar);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileOpen]);

  return <>
    <aside className="hidden w-[224px] shrink-0 flex-col border-r border-[#364150] bg-[#18212c] text-slate-300 md:flex">
      <SidebarContent active={active} />
    </aside>

    {mobileOpen ? <div className="fixed inset-0 z-50 md:hidden">
      <button
        type="button"
        aria-label="Close navigation"
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-[1px]"
        onClick={() => setMobileOpen(false)}
      />
      <aside className="relative z-10 flex h-full w-[min(82vw,300px)] flex-col border-r border-[#364150] bg-[#18212c] text-slate-300 shadow-2xl">
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
          className="absolute right-3 top-3 z-20 grid size-9 place-items-center rounded-md border border-slate-600/60 bg-[#222d39] text-slate-200 hover:bg-[#2a3542]"
        >
          <X size={18} />
        </button>
        <SidebarContent active={active} onNavigate={() => setMobileOpen(false)} />
      </aside>
    </div> : null}
  </>;
}

function BarChartIcon() { return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M3 3v18h18" /><path d="M7 16v-5M12 16V7M17 16v-3" /></svg>; }
