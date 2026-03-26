'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'sonnet-ai-tenant';

export function TenantSelector() {
  const [tenants, setTenants] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>('');

  // Load persisted selection and fetch tenant list on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) ?? '';
    setSelected(stored);

    fetch('/api/tenants')
      .then((r) => r.json())
      .then((data: { tenants: string[] }) => setTenants(data.tenants))
      .catch(() => {
        // Silently degrade — selector just shows "All Clients" with no options
      });
  }, []);

  function handleChange(value: string) {
    setSelected(value);
    localStorage.setItem(STORAGE_KEY, value);
    window.dispatchEvent(new CustomEvent('tenant-changed', { detail: { tenant: value } }));
  }

  // Don't render until we know how many tenants exist (avoids flash of empty list)
  if (tenants.length === 0) return null;

  return (
    <div className="px-4 py-3">
      <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1.5">Client</p>
      <select
        value={selected}
        onChange={(e) => handleChange(e.target.value)}
        aria-label="Select client tenant"
        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white
                   focus:outline-none focus:border-[#00FFB2] focus:ring-1 focus:ring-[#00FFB2]/30
                   transition-colors duration-150 cursor-pointer"
      >
        <option value="">All Clients</option>
        {tenants.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    </div>
  );
}
