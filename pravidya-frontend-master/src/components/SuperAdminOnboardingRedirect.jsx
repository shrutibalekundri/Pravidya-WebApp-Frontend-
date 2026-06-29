import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { superAdminOnboardingPath } from '../constants/institutionIds';

/**
 * Redirects /super-admin → onboarding with institution ID in URL when available (e.g. PRV-F-000018).
 */
export default function SuperAdminOnboardingRedirect() {
  const { user } = useAuth();
  const path = superAdminOnboardingPath(user?.jitofyInstitutionId);
  return <Navigate to={path} replace />;
}
