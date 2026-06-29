import HistoricalAdmissionsAnalyticsSection from '../../components/analytics/HistoricalAdmissionsAnalyticsSection';
import { counselorAPI } from '../../services/api';

export default function CounselorHistoricalAnalytics() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Historical Admissions Analytics</h1>
        <p className="text-gray-600 mt-1">Your institution&apos;s historical admission trends (verified records only)</p>
      </div>
      <HistoricalAdmissionsAnalyticsSection
        api={counselorAPI}
        institutions={[]}
        showFilters={false}
        compact={false}
      />
    </div>
  );
}
