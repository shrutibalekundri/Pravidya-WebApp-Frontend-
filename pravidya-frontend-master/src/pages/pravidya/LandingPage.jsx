import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Shield, Users, BookOpen } from 'lucide-react';
import { pravidyaAcademyAPI } from '../../services/pravidyaApi';

const getMockAcademy = (slug) => {
  const baseName = (slug || 'academy')
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
  const name = slug === 'veeman' ? 'Veman Academy' : baseName;
  return {
    name,
    description: 'Quality education for your child. Expert faculty, modern curriculum, and a nurturing environment for academic excellence.',
    logoUrl: '/logo-veman-academy.png',
    contactEmail: 'contact@veemanacademy.com',
    contactPhone: '+91 98765 43210',
  };
};

const LandingPage = () => {
  const { domain, academySlug } = useParams();
  const [academy, setAcademy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!academySlug) {
      setError('Invalid URL');
      setLoading(false);
      return;
    }
    pravidyaAcademyAPI
      .getBySlug(academySlug)
      .then((r) => {
        setAcademy(r?.data?.data?.academy || null);
      })
      .catch((err) => {
        if (err.response?.status === 404 || err.code === 'ERR_NETWORK') {
          setAcademy(getMockAcademy(academySlug));
          setError(null);
        } else {
          setError(err.response?.status === 404 ? 'Academy not found' : 'Failed to load. Ensure backend is running.');
        }
      })
      .finally(() => setLoading(false));
  }, [academySlug]);

  const bgColor = '#18253B';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bgColor }}>
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-white/30 border-t-white" />
      </div>
    );
  }

  if (error || !academy) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bgColor }}>
        <div className="text-center text-white">
          <h1 className="text-3xl font-bold mb-2">404 - Academy Not Found</h1>
          <p className="mb-4 opacity-90">{error || 'The academy you are looking for does not exist.'}</p>
          <Link to="/" className="text-white underline hover:opacity-90">Go Home</Link>
        </div>
      </div>
    );
  }

  const base = `/pravidya/${domain || 'acme'}/${academySlug}`;
  const logoUrl = academy.logoUrl || '/logo-veman-academy.png';
  const rawName = (academy.name || '').trim();
  const isVemanSlug = (academySlug || '').toLowerCase() === 'veeman' || (academySlug || '').toLowerCase() === 'veman';
  const displayName = rawName.replace(/Veeman/g, 'Veman');
  const nameParts = displayName.split(/\s+/).filter(Boolean);
  const hasAcademyWord = nameParts.length > 1 || nameParts[0]?.toLowerCase() === 'academy';
  const brandName = hasAcademyWord && nameParts.length > 1
    ? nameParts.slice(0, -1).join(' ')
    : isVemanSlug
      ? 'Veman'
      : nameParts[0] ? nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1).toLowerCase() : displayName;
  const nameLast = hasAcademyWord && nameParts.length > 1
    ? nameParts[nameParts.length - 1]
    : isVemanSlug
      ? 'Academy'
      : '';

  const scrollToPortal = () => {
    document.getElementById('secure-portal')?.scrollIntoView({ behavior: 'smooth' });
  };

  const staffPortalCards = [
    { id: 'ADMIN', title: 'Administrator', desc: 'Complete academy management, user control, and system configuration', Icon: Shield, color: '#387FFF' },
    { id: 'COUNSELOR', title: 'Counselor', desc: 'Student lead management, follow-ups, and enrollment tracking', Icon: Users, color: '#28A745' },
    { id: 'MANAGEMENT', title: 'Management', desc: 'Analytics dashboard, reports, and operational oversight', Icon: BookOpen, color: '#FF8A00' },
  ];

  return (
    <div className="w-full min-h-screen" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header - #2C3A4F bg, "Veman" + POWERED BY PRAVIDYA */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between border-b border-white/5"
        style={{
          backgroundColor: bgColor,
          paddingLeft: '5vw',
          paddingRight: '5vw',
          paddingTop: '1rem',
          paddingBottom: '1rem',
          height: '72px',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex-shrink-0 flex items-center justify-center overflow-hidden rounded-[5px] bg-white"
            style={{ width: '32px', height: '32px' }}
          >
            <img src={logoUrl} alt="" className="h-6 w-auto object-contain" />
          </div>
          <div className="flex flex-col pl-0.5">
            <p className="font-bold truncate max-w-[240px] sm:max-w-none" style={{ fontSize: '1.25rem' }}>
              <span className="text-white">{brandName}</span>
              {nameLast && <span style={{ color: '#FF8C00' }}> {nameLast}</span>}
            </p>
            <p className="uppercase tracking-wider" style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>
              POWERED BY PRAVIDYA
            </p>
          </div>
        </div>
        <button
          onClick={scrollToPortal}
          className="text-white hover:opacity-90 transition-opacity"
          style={{ fontSize: '1rem', fontWeight: 400 }}
        >
          Staff Login
        </button>
      </header>

      {/* Hero - deep dark blue, subtle line art upper right */}
      <section
        className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
        style={{
          backgroundColor: bgColor,
          paddingTop: '72px',
        }}
      >
        {/* Abstract line art - partial circle + angular lines, upper right */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <svg
            className="absolute -top-4 right-[5%] w-[320px] h-[320px] opacity-90"
            viewBox="0 0 160 160"
            fill="none"
            stroke="rgba(255,255,255,0.14)"
            strokeWidth="0.6"
          >
            <path d="M 80 20 A 60 60 0 0 1 140 80" strokeLinecap="round" />
            <path d="M 20 40 L 60 80 L 20 120" strokeLinejoin="round" />
            <path d="M 100 40 L 140 80 L 100 120" strokeLinejoin="round" />
            <path d="M 40 60 L 80 100 L 120 60" strokeLinejoin="round" />
          </svg>
        </div>

        <div className="relative flex flex-col items-center text-center w-full px-4 sm:px-6" style={{ maxWidth: '800px' }}>
          {/* Central logo - white rounded card */}
          <div
            className="flex items-center justify-center rounded-2xl bg-white overflow-hidden mb-8"
            style={{
              width: '130px',
              height: '130px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            }}
          >
            <img src={logoUrl} alt={displayName} className="h-[95px] w-auto object-contain" />
          </div>

          {/* Trust badge - dark grey rounded rectangle, gold star */}
          <div
            className="inline-flex items-center gap-2.5 text-white mb-8 rounded-lg"
            style={{
              backgroundColor: '#2d3548',
              padding: '0.6rem 1.75rem',
              fontSize: '1rem',
              fontWeight: 400,
            }}
          >
            <span style={{ color: '#F6E05E', fontSize: '1.15rem' }}>★</span>
            Trusted by 500+ students &amp; families
          </div>

          {/* Main title - brand white + "Academy" orange (#FF8C00) */}
          <h1
            className="mb-6"
            style={{
              fontSize: 'clamp(2.75rem, 6vw, 4rem)',
              fontWeight: 800,
              lineHeight: 1.1,
            }}
          >
            <span className="text-white">{brandName}</span>
            {nameLast && <span style={{ color: '#FF8C00', fontWeight: 800 }}> {nameLast}</span>}
          </h1>

          {/* Tagline - white, centered */}
          <p
            className="text-white"
            style={{
              fontSize: '1.125rem',
              fontWeight: 400,
              lineHeight: 1.6,
              maxWidth: '520px',
            }}
          >
            {academy.description || 'Quality education for your child. Expert faculty, modern curriculum, and a nurturing environment for academic excellence.'}
          </p>
        </div>
      </section>

      {/* Staff Portal - light grey/white strip below hero */}
      <section id="secure-portal" className="min-h-screen py-16 lg:py-20 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: '#F0F2F5' }}>
        <div className="max-w-4xl 2xl:max-w-5xl mx-auto">
          <p className="text-center text-sm uppercase tracking-widest mb-1" style={{ color: '#EA6D20' }}>Staff Portal</p>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center mb-2" style={{ color: '#333E4F' }}>
            Secure <span style={{ color: '#387FFF' }}>Portal</span> Access
          </h2>
          <p className="text-center mb-12" style={{ color: '#6B7C8C' }}>Sign in to your role-specific dashboard with OTP-verified secure authentication</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {staffPortalCards.map(({ id, title, desc, Icon, color }) => (
              <Link
                key={id}
                to={`${base}/login?role=${id}`}
                className="block bg-white rounded-xl shadow-md p-6 hover:shadow-xl transition-all border-t-4"
                style={{ borderTopColor: color }}
              >
                <div
                  className="w-14 h-14 rounded-lg flex items-center justify-center mb-4"
                  style={{ backgroundColor: color }}
                >
                  <Icon className="w-7 h-7 text-white" strokeWidth={2} />
                </div>
                <h3 className="text-lg font-bold mb-2" style={{ color: '#333E4F' }}>{title}</h3>
                <p className="text-sm mb-4" style={{ color: '#6B7C8C' }}>{desc}</p>
                <span className="font-medium text-sm" style={{ color: '#387FFF' }}>Sign In →</span>
              </Link>
            ))}
          </div>
          <div className="mt-12 text-center text-sm" style={{ color: '#6B7C8C' }}>
            {academy.contactEmail && <span>{academy.contactEmail}</span>}
            {academy.contactEmail && academy.contactPhone && <span className="mx-2">•</span>}
            {academy.contactPhone && <span>{academy.contactPhone}</span>}
            {!academy.contactEmail && !academy.contactPhone && <span>contact@veemanacademy.com • +91 98765 43210</span>}
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
