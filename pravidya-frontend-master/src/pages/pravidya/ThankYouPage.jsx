import { Link, useParams } from 'react-router-dom';

const ThankYouPage = () => {
  const { domain, academySlug } = useParams();
  const base = `/pravidya/${domain || 'acme'}/${academySlug}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-xl p-8 text-center">
        <span className="text-6xl mb-4 block">✅</span>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Thank You!</h1>
        <p className="text-gray-600 mb-6">
          Your enquiry has been submitted successfully. We will contact you soon.
        </p>
        <Link
          to={base}
          className="inline-block px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
};

export default ThankYouPage;
