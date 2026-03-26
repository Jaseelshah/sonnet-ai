'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { TenantSelector } from './TenantSelector';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  /** When true, active state requires an exact pathname match. */
  exact?: boolean;
}

export interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2.25l7.5 3v6c0 4.556-3.075 8.608-7.5 9.75C7.575 19.858 4.5 15.806 4.5 11.25v-6L12 2.25z" />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  );
}

function ReportIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function ExecutiveReportIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
    </svg>
  );
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: <DashboardIcon /> },
  { label: 'Alerts Feed', href: '/alerts', icon: <AlertIcon /> },
  { label: 'Reports', href: '/reports', icon: <ReportIcon />, exact: true },
  { label: 'Executive Report', href: '/reports/executive', icon: <ExecutiveReportIcon /> },
  { label: 'Settings', href: '/settings', icon: <SettingsIcon /> },
];

export function Sidebar({ open = false, onClose = () => {} }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Proceed to login even if the request fails
    }
    router.push('/login');
  }

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-[#07090F] border-r border-gray-800 transition-transform duration-200',
        'md:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      {/* Logo / Brand */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-800">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#00FFB2]/10 text-[#00FFB2]">
          <ShieldIcon />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-white tracking-wide">SONNET</p>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest">AI SOC Platform</p>
        </div>
        {/* Mobile close button */}
        <button
          onClick={onClose}
          aria-label="Close navigation menu"
          className="md:hidden p-1 rounded text-gray-500 hover:text-white"
        >
          <CloseIcon />
        </button>
      </div>

      {/* Status indicator */}
      <div className="mx-4 mt-4 mb-2 flex items-center gap-2 rounded-lg bg-[#00FFB2]/5 border border-[#00FFB2]/15 px-3 py-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00FFB2] opacity-60" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00FFB2]" />
        </span>
        <span className="text-xs text-[#00FFB2] font-medium">System Online</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-0.5">
        <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-gray-600">
          Navigation
        </p>
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === '/' || item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-[#00FFB2]/10 text-[#00FFB2] border border-[#00FFB2]/20'
                  : 'text-gray-400 hover:bg-gray-800/60 hover:text-white border border-transparent'
              )}
            >
              <span className={cn(isActive ? 'text-[#00FFB2]' : 'text-gray-500')}>
                {item.icon}
              </span>
              {item.label}
              {isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#00FFB2]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Tenant selector */}
      <div className="border-t border-gray-800">
        <TenantSelector />
      </div>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-gray-800 space-y-3">
        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 w-full rounded-lg px-3 py-2.5 text-sm font-medium text-gray-400 hover:bg-gray-800/60 hover:text-white border border-transparent transition-all duration-150"
        >
          <span className="text-gray-500">
            <LogoutIcon />
          </span>
          Sign Out
        </button>
        <p className="text-[10px] text-gray-600 text-center">
          Sonnet AI v1.0.0
        </p>
      </div>
    </aside>
  );
}
