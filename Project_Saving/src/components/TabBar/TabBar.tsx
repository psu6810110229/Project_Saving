import { NavLink } from 'react-router-dom';

interface Tab {
  to: string;
  icon: string;
  label: string;
}

const TABS: Tab[] = [
  { to: '/battle',  icon: '⚔️',  label: 'Battle'  },
  { to: '/profile', icon: '👤', label: 'Profile' },
  { to: '/goal',    icon: '🎯',  label: 'Goal'    },
];

export function TabBar() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-canvas border-t border-border z-40 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-sm mx-auto flex justify-around py-2">
        {TABS.map(tab => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-4 py-1 rounded-lg transition-colors duration-150 ${
                isActive ? 'text-terracotta' : 'text-ink-muted'
              }`
            }
          >
            <span className="text-2xl leading-none" aria-hidden="true">{tab.icon}</span>
            <span className="text-xs font-medium">{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
