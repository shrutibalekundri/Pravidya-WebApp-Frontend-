import React from 'react';

export default function LicenseBanner({ license }) {
  if (!license) return null;
  const { schoolName, daysRemaining, renewalLink } = license;

  return (
    <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 space-y-1">
      <p className="text-sm text-slate-700">
        <span className="font-semibold">School Name:</span> {schoolName}
      </p>
      <p className="text-sm text-slate-700">
        Your plan expires in{' '}
        <span className="font-semibold">
          {daysRemaining} day{daysRemaining === 1 ? '' : 's'}
        </span>
      </p>
      <a
        href={renewalLink}
        target="_blank"
        rel="noreferrer"
        className="inline-flex mt-1 text-xs font-medium text-sky-700 hover:text-sky-900"
      >
        Renew Plan →
      </a>
    </div>
  );
}

