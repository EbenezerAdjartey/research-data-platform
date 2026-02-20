import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { billing } from '@rdp/api-client';
import { useAuth } from '@/context/AuthContext';
import {
  CheckCircle, CreditCard, BarChart3, Database,
  FileText, Zap, ShieldCheck, Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';

const FEATURES = [
  { icon: BarChart3,   label: '50+ statistical analysis methods' },
  { icon: Database,    label: 'Unlimited dataset uploads (CSV, Excel, SPSS, SAS, Stata)' },
  { icon: FileText,    label: 'PDF & DOCX report export' },
  { icon: Zap,         label: 'Real-time analysis with live progress updates' },
  { icon: ShieldCheck, label: 'Secure, encrypted data storage' },
  { icon: Clock,       label: 'Full analysis history & reproducibility' },
];

export default function BillingPage() {
  const [searchParams] = useSearchParams();
  const success  = searchParams.get('success')  === '1';
  const canceled = searchParams.get('canceled') === '1';
  const { user, refreshUser } = useAuth();
  const isActive = user?.subscription_status === 'active';

  // Poll until subscription activates after a successful checkout
  useQuery({
    queryKey: ['billing-status'],
    queryFn: () => billing.status(),
    refetchInterval: success && !isActive ? 2000 : false,
    enabled: success && !isActive,
  });

  // Refresh user profile once when coming back from a successful checkout
  useEffect(() => {
    if (success) refreshUser();
  }, [success]); // eslint-disable-line react-hooks/exhaustive-deps

  const checkoutMutation = useMutation({
    mutationFn: () => billing.checkout(),
    onSuccess: (data) => { window.location.href = data.url; },
    onError: () => toast.error('Could not start checkout. Please try again.'),
  });

  const portalMutation = useMutation({
    mutationFn: () => billing.portal(),
    onSuccess: (data) => { window.location.href = data.url; },
    onError: () => toast.error('Could not open billing portal. Please try again.'),
  });

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Subscription</h1>
      <p className="text-gray-500 text-sm mb-8">Manage your Research Data Platform plan.</p>

      {/* Success banner */}
      {success && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-green-800">Payment successful — welcome aboard!</p>
            <p className="text-xs text-green-600 mt-0.5">Your subscription is now active.</p>
          </div>
        </div>
      )}

      {/* Canceled banner */}
      {canceled && !success && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-yellow-800">Checkout was canceled. You can try again below.</p>
        </div>
      )}

      {/* Plan card */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-br from-primary-600 to-primary-800 p-6 text-white">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary-200 mb-1">Plan</p>
              <h2 className="text-2xl font-bold">Research Pro</h2>
              <p className="text-primary-200 text-sm mt-1">Full access · Cancel any time</p>
            </div>
            {isActive && (
              <span className="bg-green-400 text-white text-xs font-bold px-3 py-1 rounded-full mt-1">
                ACTIVE
              </span>
            )}
          </div>
        </div>

        {/* Features */}
        <div className="p-6 border-b">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-4">What's included</p>
          <ul className="space-y-3">
            {FEATURES.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3 text-sm text-gray-700">
                <div className="w-7 h-7 rounded-lg bg-primary-50 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-primary-600" />
                </div>
                {label}
              </li>
            ))}
          </ul>
        </div>

        {/* CTA */}
        <div className="p-6">
          {isActive ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">
                Your subscription is active. Use the billing portal to update payment details,
                view invoices, or cancel your plan.
              </p>
              <button
                onClick={() => portalMutation.mutate()}
                disabled={portalMutation.isPending}
                className="inline-flex items-center gap-2 px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                <CreditCard className="w-4 h-4" />
                {portalMutation.isPending ? 'Opening portal…' : 'Manage Billing'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">
                Subscribe to unlock full access to all analysis tools and features.
              </p>
              <button
                onClick={() => checkoutMutation.mutate()}
                disabled={checkoutMutation.isPending}
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                <CreditCard className="w-4 h-4" />
                {checkoutMutation.isPending ? 'Redirecting to checkout…' : 'Subscribe Now'}
              </button>
              <p className="text-xs text-gray-400">Secured by Stripe · No hidden fees</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
