/** Veman Academy / platform-scoped Jitofy IDs (must match backend utils/institutionIds.js) */
export const VEMAN_JITOFY_INSTITUTION_ID = 'PRV-F-000018';
export const LEGACY_PLATFORM_JITOFY_ID = 'PLATFORM';

export function isPlatformScopeJitofyId(jitofyInstitutionId) {
  const j = (jitofyInstitutionId || '').trim().toUpperCase();
  return j === LEGACY_PLATFORM_JITOFY_ID || j === VEMAN_JITOFY_INSTITUTION_ID.toUpperCase();
}

/** Onboarding URL scoped by institution (venam login redirect target) */
export function superAdminOnboardingPath(institutionJitofyId) {
  const id = (institutionJitofyId || '').trim();
  if (!id) return '/super-admin/onboarding';
  return `/super-admin/onboarding/${encodeURIComponent(id)}`;
}
