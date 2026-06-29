import { Link, useNavigate } from 'react-router-dom';
import VoiceCallLeadUpdateWizard from '../../components/counselor/VoiceCallLeadUpdateWizard';

export default function VoiceCallLeadUpdatePage() {
  const navigate = useNavigate();

  const handleClose = () => {
    navigate('/counselor/sessions');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/counselor/sessions"
            className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block"
          >
            ← Back to Sessions
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Voice Call Lead Update</h1>
          <p className="text-gray-600 mt-1">Record and update details from your voice calls with leads</p>
        </div>
      </div>

      <VoiceCallLeadUpdateWizard onClose={handleClose} />
    </div>
  );
}
