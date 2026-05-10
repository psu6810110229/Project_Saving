import { NavLink } from 'react-router-dom';

interface Tab {
  to: string;
  label: string;
  icon: (active: boolean) => JSX.Element;
}

const TABS: Tab[] = [
  { 
    to: '/battle',  
    label: 'Battle',
    icon: (active) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? "2.5" : "2"} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    )
  },
  { 
    to: '/profile', 
    label: 'Profile',
    icon: (active) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? "2.5" : "2"} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    )
  },
  { 
    to: '/goal',    
    label: 'Goal',
    icon: (active) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? "2.5" : "2"} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    )
  },
];

export function TabBar() {
  return (
    <div className="fixed bottom-8 left-0 right-0 z-40 px-6 flex justify-center pointer-events-none">
      <nav className="pointer-events-auto bg-white/10 backdrop-blur-2xl border border-white/20 rounded-full px-2 py-2 flex items-center gap-1 shadow-2xl">
        {TABS.map(tab => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end
            className={({ isActive }) =>
              `flex items-center gap-2 px-6 py-3 rounded-full transition-all duration-300 ${
                isActive 
                  ? 'bg-terracotta text-white shadow-lg scale-105' 
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className="shrink-0">{tab.icon(isActive)}</span>
                <span className={`text-sm font-bold tracking-tight transition-all duration-300 ${isActive ? 'max-w-[100px] opacity-100' : 'max-w-0 opacity-0 overflow-hidden'}`}>
                  {tab.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
