import { useLocation, Link } from 'react-router-dom';

const ThankYou = () => {
  const location = useLocation();
  const leadId = location.state?.leadId;

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-2xl w-full card text-center">
        <div className="mb-6">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Thank You!</h1>
          <p className="text-xl text-gray-600 mb-4">
            Your admission enquiry has been submitted successfully.
          </p>
          {leadId && (
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-600 mb-1">Your Lead ID:</p>
              <p className="text-2xl font-bold text-primary-700">{leadId}</p>
              <p className="text-xs text-gray-500 mt-2">
                Please save this ID for future reference
              </p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <p className="text-gray-700">
            Our team will review your application and a counselor will contact you shortly.
          </p>
          <p className="text-sm text-gray-500">
            You will receive updates via email and SMS on the provided contact details.
          </p>
          
          <div className="pt-6 border-t">
            <Link
              to="/"
              className="btn-primary inline-block"
            >
              Submit Another Form
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThankYou;
