import React, { useState, useEffect } from 'react';
import {
  Star,
  ShieldAlert,
  CheckCircle2,
  Send,
  Globe,
  RefreshCw,
  User,
  Mail,
  MapPin,
  Laptop,
} from 'lucide-react';
import { api } from '../../services/api';
import type { FormConfig } from '../../types';

const COUNTRIES = [
  'Nigeria',
  'Kenya',
  'Ghana',
  'South Africa',
  'United Kingdom',
  'United States',
  'Canada',
  'Germany',
  'France',
  'Egypt',
  'Uganda',
  'Rwanda',
  'Other',
];

const CUSTOMER_SEGMENTS = [
  { value: 'Retail', label: 'Retail (Personal Banking)' },
  { value: 'SME', label: 'SME (Small & Medium Business)' },
  { value: 'Business', label: 'Corporate / Business Banking' },
  { value: 'Freelancer', label: 'Freelancer / Creator' },
];

const PLAN_TIERS = [
  { value: 'Standard', label: 'Standard Tier' },
  { value: 'Plus', label: 'Plus Tier' },
  { value: 'Premium', label: 'Premium Tier' },
  { value: 'Business Pro', label: 'Business Pro Tier' },
];

const TENURE_OPTIONS = [
  { value: 2, label: 'Less than 3 months' },
  { value: 6, label: '3 to 6 months' },
  { value: 12, label: '6 to 12 months' },
  { value: 24, label: '1 to 2 years' },
  { value: 36, label: 'Over 2 years' },
];

const CATEGORIES = [
  'Transfers & Instant Payments',
  'Cards & Virtual Cards',
  'Account Verification & KYC',
  'Loan & Credit Facilities',
  'Mobile App Performance & Stability',
  'Customer Support & Dispute Resolution',
  'Product Feature Request',
  'General Feedback',
];

export const CustomerFeedbackForm: React.FC = () => {
  const [config, setConfig] = useState<FormConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // Customer Profile Inputs
  const [customerName, setCustomerName] = useState('');
  const [email, setEmail] = useState('');
  const [customerSegment, setCustomerSegment] = useState('Retail');
  const [planTier, setPlanTier] = useState('Standard');
  const [accountTenure, setAccountTenure] = useState<number>(12);

  // Geographic Details
  const [country, setCountry] = useState('Nigeria');
  const [city, setCity] = useState('');

  // Feedback Details
  const [category, setCategory] = useState('Transfers & Instant Payments');
  const [rawText, setRawText] = useState('');
  const [rating, setRating] = useState<number | null>(4);
  const [npsScore, setNpsScore] = useState<number | null>(8);

  // Technical Environment (auto-detect where possible)
  const [device, setDevice] = useState('');
  const [os, setOs] = useState('');
  const [appVersion, setAppVersion] = useState('Web Portal v2.4');

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [submittedSummary, setSubmittedSummary] = useState<any>(null);

  // Auto-detect browser/OS on mount
  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent;
      let detectedDevice = 'Desktop Web';
      let detectedOs = navigator.platform || 'Unknown OS';

      if (/iPhone|iPad|iPod/i.test(ua)) {
        detectedDevice = 'Apple iOS Device';
        detectedOs = 'iOS';
      } else if (/Android/i.test(ua)) {
        detectedDevice = 'Android Smartphone';
        detectedOs = 'Android';
      } else if (/Macintosh|Mac OS X/i.test(ua)) {
        detectedDevice = 'Apple Mac';
        detectedOs = 'macOS';
      } else if (/Windows/i.test(ua)) {
        detectedDevice = 'Windows PC';
        detectedOs = 'Windows';
      } else if (/Linux/i.test(ua)) {
        detectedDevice = 'Linux Workstation';
        detectedOs = 'Linux';
      }

      setDevice(detectedDevice);
      setOs(detectedOs);
    }

    api
      .getPublicFormConfig()
      .then((cfg) => setConfig(cfg))
      .catch((err) => {
        console.warn('Could not load dynamic form config, using defaults', err);
      })
      .finally(() => setLoadingConfig(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!rawText.trim() || rawText.trim().length < 5) {
      setErrorMsg('Please share your detailed feedback (at least 5 characters).');
      return;
    }

    if (!country.trim()) {
      setErrorMsg('Please select or specify your country.');
      return;
    }

    try {
      setSubmitting(true);
      const generatedCustId = `CUST-WEB-${Date.now().toString(36).toUpperCase().slice(-5)}`;
      const payload = {
        customer_name: customerName.trim() || 'Verified Customer',
        email: email.trim() || undefined,
        customer_id: generatedCustId,
        customer_segment: customerSegment,
        plan_tier: planTier,
        account_tenure_months: accountTenure,
        country: country.trim(),
        city: city.trim() || undefined,
        channel: 'Web Feedback Form',
        raw_text: rawText.trim(),
        rating: rating !== null ? rating : undefined,
        nps_score: npsScore !== null ? npsScore : undefined,
        device: device.trim() || 'Web Browser',
        os: os.trim() || 'Web',
        app_version: appVersion.trim() || 'Web Portal v2.4',
      };

      const res = await api.submitPublicFeedback(payload);

      setSubmittedId(res.feedback_id);
      setSubmittedSummary({
        feedback_id: res.feedback_id,
        customer_name: payload.customer_name,
        email: payload.email || 'None provided',
        customer_id: payload.customer_id,
        customer_segment: payload.customer_segment,
        plan_tier: payload.plan_tier,
        country: payload.country,
        city: payload.city || 'Unspecified',
        category,
        rating,
        nps_score: npsScore,
        submitted_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setCustomerName('');
    setEmail('');
    setCountry('Nigeria');
    setCity('');
    setRawText('');
    setRating(4);
    setNpsScore(8);
    setErrorMsg(null);
    setSubmittedId(null);
    setSubmittedSummary(null);
  };

  if (submittedId && submittedSummary) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] p-8 max-w-xl w-full text-center">
          <div className="w-16 h-16 bg-green-50 text-[#16A34A] rounded-full flex items-center justify-center mx-auto mb-4 border border-green-200">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-[#1F2937] mb-2">Thank you, {submittedSummary.customer_name}!</h2>
          <p className="text-sm text-gray-600 mb-6 leading-relaxed">
            Your feedback has been submitted successfully and will be resolved by our support and product operations team. We truly appreciate your time in helping us improve PayNext.
          </p>

          {/* Submission Details Card */}
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 text-left mb-6 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <div>
                <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold block">Submission Reference</span>
                <span className="font-mono text-sm font-bold text-[#1F2937]">{submittedSummary.feedback_id}</span>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-green-100 text-green-700 border border-green-200 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-green-600" />
                Submitted Successfully
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-gray-400 block text-[10px] uppercase">Customer Name</span>
                <span className="font-semibold text-gray-800">{submittedSummary.customer_name}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase">Email</span>
                <span className="font-semibold text-gray-800 truncate block">{submittedSummary.email}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase">Account Segment</span>
                <span className="font-semibold text-[#F97316]">{submittedSummary.customer_segment} &bull; {submittedSummary.plan_tier}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase">Location</span>
                <span className="font-semibold text-gray-800">{submittedSummary.country} {submittedSummary.city ? `(${submittedSummary.city})` : ''}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase">Rating / NPS</span>
                <span className="font-semibold text-gray-800">{submittedSummary.rating} ★ &bull; NPS {submittedSummary.nps_score}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase">Channel</span>
                <span className="font-semibold text-gray-800">Web Feedback Form</span>
              </div>
            </div>
          </div>

          <div>
            <button
              onClick={handleReset}
              className="w-full py-3.5 px-4 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Submit Another Feedback
            </button>
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-gray-400">
          PayNext Financial Technologies Ltd. &bull; Customer Care & Operations
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Top Header Information */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-semibold text-gray-700">PayNext Customer Voice Portal</span>
          </div>
          <span className="text-[11px] text-gray-400 font-mono">Public Feedback Channel</span>
        </div>

        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#F97316] text-white font-bold text-xl shadow-md mb-3">
            PN
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1F2937] tracking-tight">
            {config?.title || 'PayNext Customer Feedback'}
          </h1>
          <p className="mt-2 text-sm text-gray-600 max-w-md mx-auto">
            {config?.description ||
              'Help us build the next generation of financial services. Share your thoughts, report issues, or tell us how we can improve.'}
          </p>
        </div>

        {/* Feedback Form Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] p-6 sm:p-8">
          {errorMsg && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 flex-shrink-0 text-red-600 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 1. Customer Identification Section */}
            <div className="bg-orange-50/40 p-4 rounded-xl border border-orange-100 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-[#F97316] uppercase tracking-wider">
                <User className="w-4 h-4" />
                <span>Customer Profile Details</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#1F2937] mb-1">
                    Your Full Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g. Tony Ogbuabor"
                      className="w-full pl-9 pr-3 py-2 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#F97316]/50 text-xs text-[#1F2937]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1F2937] mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. tony.ogbuabor@example.com"
                      className="w-full pl-9 pr-3 py-2 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#F97316]/50 text-xs text-[#1F2937]"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Customer Segment</label>
                  <select
                    value={customerSegment}
                    onChange={(e) => setCustomerSegment(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-gray-300 text-xs text-[#1F2937] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                  >
                    {CUSTOMER_SEGMENTS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Account Plan Tier</label>
                  <select
                    value={planTier}
                    onChange={(e) => setPlanTier(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-gray-300 text-xs text-[#1F2937] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                  >
                    {PLAN_TIERS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Tenure with PayNext</label>
                  <select
                    value={accountTenure}
                    onChange={(e) => setAccountTenure(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-gray-300 text-xs text-[#1F2937] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                  >
                    {TENURE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 2. Location (Country & City) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#1F2937] mb-1.5">
                  Country of Residence <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Globe className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    required
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#F97316]/50 focus:border-[#F97316] text-xs text-[#1F2937] bg-white"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1F2937] mb-1.5">
                  City / State (Optional)
                </label>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Lagos, Abuja, London, Nairobi"
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#F97316]/50 focus:border-[#F97316] text-xs text-[#1F2937]"
                  />
                </div>
              </div>
            </div>

            {/* 3. Feedback Category */}
            <div>
              <label className="block text-xs font-semibold text-[#1F2937] mb-1.5">
                Feedback Topic / Service Area
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#F97316]/50 text-xs text-[#1F2937] bg-white"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Verbatim Customer Feedback */}
            <div>
              <label className="block text-xs font-semibold text-[#1F2937] mb-1">
                Your Feedback Description <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-gray-500 mb-2">
                What went well, what friction occurred, or what product feature would make your financial operations seamless?
              </p>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                required
                rows={5}
                placeholder="Example: When I initiated an instant bank transfer from my business account to a vendor yesterday, the payment status was stuck on 'Processing' for over 4 hours with no reference tracking..."
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#F97316]/50 focus:border-[#F97316] text-xs text-[#1F2937] transition-all leading-relaxed"
              />
            </div>

            {/* 5. Experience Rating (1 to 5 Stars) */}
            <div className="pt-2 border-t border-gray-100">
              <label className="block text-xs font-semibold text-[#1F2937] mb-1">
                Overall Experience Rating
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(rating === star ? null : star)}
                    className="p-1 text-gray-300 hover:text-amber-400 focus:outline-none transition-transform hover:scale-110 cursor-pointer"
                    title={`${star} Star${star > 1 ? 's' : ''}`}
                  >
                    <Star
                      className={`w-7 h-7 ${
                        rating !== null && star <= rating
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-gray-300'
                      }`}
                    />
                  </button>
                ))}
                {rating !== null && (
                  <span className="text-xs font-bold text-gray-700 ml-2">
                    {rating === 1 && '1 Star — Very Poor'}
                    {rating === 2 && '2 Stars — Needs Improvement'}
                    {rating === 3 && '3 Stars — Average'}
                    {rating === 4 && '4 Stars — Good Experience'}
                    {rating === 5 && '5 Stars — Excellent'}
                  </span>
                )}
              </div>
            </div>

            {/* 6. NPS Recommendation Score (0 to 10) */}
            <div className="pt-2 border-t border-gray-100">
              <label className="block text-xs font-semibold text-[#1F2937] mb-1">
                How likely are you to recommend PayNext to colleagues or peers?
              </label>
              <p className="text-[11px] text-gray-500 mb-2">0 = Not at all likely, 10 = Extremely likely</p>
              <div className="grid grid-cols-11 gap-1 sm:gap-1.5">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => {
                  const isSelected = npsScore === score;
                  let bgClass = 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-200';
                  if (isSelected) {
                    if (score <= 6) bgClass = 'bg-red-600 text-white border-red-700 shadow-sm';
                    else if (score <= 8) bgClass = 'bg-amber-500 text-white border-amber-600 shadow-sm';
                    else bgClass = 'bg-green-600 text-white border-green-700 shadow-sm';
                  }

                  return (
                    <button
                      key={score}
                      type="button"
                      onClick={() => setNpsScore(isSelected ? null : score)}
                      className={`py-2 text-xs font-bold rounded-lg border transition-all text-center cursor-pointer ${bgClass}`}
                    >
                      {score}
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-between text-[10px] text-gray-400 mt-1.5 px-0.5 font-medium">
                <span className="text-red-600">0 - 6 (Detractor)</span>
                <span className="text-amber-600">7 - 8 (Passive)</span>
                <span className="text-green-600">9 - 10 (Promoter)</span>
              </div>
            </div>

            {/* 7. Technical Environment */}
            <div className="pt-2 border-t border-gray-100">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5">
                <Laptop className="w-3.5 h-3.5" />
                <span>Technical Context (Detected Automatically)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Device Model</label>
                  <input
                    type="text"
                    value={device}
                    onChange={(e) => setDevice(e.target.value)}
                    placeholder="e.g. MacBook Pro, iPhone 15"
                    className="w-full px-3 py-1.5 rounded-lg border border-gray-300 text-xs text-[#1F2937]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Operating System</label>
                  <input
                    type="text"
                    value={os}
                    onChange={(e) => setOs(e.target.value)}
                    placeholder="e.g. macOS, Windows 11"
                    className="w-full px-3 py-1.5 rounded-lg border border-gray-300 text-xs text-[#1F2937]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">App / Portal Version</label>
                  <input
                    type="text"
                    value={appVersion}
                    onChange={(e) => setAppVersion(e.target.value)}
                    placeholder="e.g. Web Portal v2.4"
                    className="w-full px-3 py-1.5 rounded-lg border border-gray-300 text-xs text-[#1F2937]"
                  />
                </div>
              </div>
            </div>

            {/* Privacy Notice */}
            <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
              <ShieldAlert className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Security & Privacy Guarantee: </span>
                {config?.custom_privacy_note ||
                  'PayNext values your feedback to enhance our financial products and services. We will never ask for your passwords, PINs, card numbers, or OTPs.'}
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 px-6 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Submitting Feedback...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Submit Feedback to PayNext
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        <div className="mt-8 text-center text-xs text-gray-400">
          PayNext Financial Services &bull; Customer Intelligence Gateway &bull; Privacy Protected
        </div>
      </div>
    </div>
  );
};
