import PublicHeader from '@/components/public-header';
import ReportForm from './report-form';

export const metadata = { title: 'Report a problem' };

export default function ReportPage() {
  return (
    <>
      <PublicHeader />
      <main id="main"><div className="wrap stack" style={{ maxWidth: 760 }}>
        <h1>Report a problem in your community</h1>
        <ReportForm siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || null} />
      </div></main>
    </>
  );
}
