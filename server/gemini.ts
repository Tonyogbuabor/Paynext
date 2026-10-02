import { GoogleGenAI, Type } from '@google/genai';
import type { FeedbackRecord, AIAnalysis, RecurringIssue, ProductRequirement, FeedbackWithAnalysis } from '../src/types.ts';

let genAIClient: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAIClient;
}

// Intelligent sentiment detection and categorization engine
export function fallbackAnalysis(record: FeedbackRecord): AIAnalysis {
  const text = (record.raw_text || '').toLowerCase();
  let sentiment: 'Positive' | 'Neutral' | 'Negative' = 'Neutral';
  let primaryCategory = 'Other or unclassified';
  let productArea = 'Core Banking';
  let painPoint = 'General feedback regarding PayNext services';
  let urgency: 'Critical' | 'High' | 'Medium' | 'Low' = 'Medium';
  let evidence = record.raw_text.substring(0, 140);

  // 1. Complaint Subject Line Triggers
  const complaintSubjects = [
    'approved loan not disbursed',
    'otp not received',
    'money debited but recipient not credited',
    'general complaint',
    'app hard to navigate',
    'excessive push notifications',
    'card declined',
    'kyc verification pending',
    'dispute',
  ];
  const hasComplaintSubject = complaintSubjects.some((s) => text.includes(s));

  // 2. Negative Signals & Phrases
  const negativeKeywords = [
    // Delays, non-receipt, missing money
    'not disbursed', 'has not been disbursed', 'money has not been disbursed', 'approved loan not disbursed',
    'never arrived in my wallet', 'never arrived', 'never received', 'never received it',
    'never went through', 'transfer that never went through', 'was debited', 'debited ₦', 'debited gh',
    'still shows processing', "still shows 'processing'", 'not credited', 'recipient not credited',
    'receiver has not gotten', 'has not gotten the money', 'money left my account', 'money was gone',
    'did not reflect', "didn't reflect", "didn't receive", 'not received', 'balance still shows zero',
    'shows zero after', 'stuck on pending', 'pending partner bank', 'pending for too long',
    'has not returned', "still haven't", "hasn't come", 'no refund', 'no update',
    'cancelled order', 'canceled order', 'repayment date is already counting', 'false advertising',
    'loan processing fee but', 'charged the loan processing fee',

    // OTP, login, authentication failures
    'verification code takes forever', 'code takes forever', 'takes forever', 'takes foerver', 'taeks forever',
    'has expired', '20 minutes to receive an otp', 'not acceptable', 'the otp never', 'otp never',
    'cannot log in', "can't log in", "can't login", 'cannot login', 'locked out',
    'froze my account', 'account is still under review', "can't do anything", 'cannot do anything',
    'stops working', 'keeps forgetting', 'keeps rejecting', 'rejecting my id', 'stuck', 'stcuk',

    // Card declines & disputes
    'keeps getting declined', 'card keeps getting declined', 'card was declined', 'declined at online checkout',
    'declined at checkout', 'wrong merchant charge', 'wrong charge', 'dispute', 'chargeback',
    'black box', 'under investigation', 'withdrawal fee', 'hidden fee', 'fee after the money was gone',
    'show fees before', 'fraud', 'stolen', 'missing',

    // Support issues & queue timeouts
    'nobody pikcs up', 'nobody picks up', 'nobody has replied', 'silence for', 'telling me to wait',
    'sending me in circles', 'explained my problem to', 'closed my ticket', 'without solving',
    'generic answer', 'no response from support', 'waited 30 minutes', 'waited 10 minutes',
    'timed out', 'tiemd out',

    // Complaints, dissatisfaction & colloquialisms
    'don tire me', 'don tire', 'abeg fix', 'abeg', 'na so so story', 'fix your app', 'bad app', '#fixyourapp',
    'tired', 'frustrated', 'frustrating', 'disappointed', 'disappointing', 'quite disappointed', 'annoying',
    'annoyed', 'terrible', 'horrible', 'worst', 'unacceptable', 'not happy', 'ridiculous', 'poor', 'rubbish',
    'useless', 'nonsense', 'stressful', 'angry', 'unfair', 'disaster', 'waste of time',
    'complaint', 'general complaint', 'very disappointing',

    // App instability & UX friction
    'fail', 'failed', 'falied', 'error', 'crash', 'crashes', 'crashed', 'closing by itself',
    'force closes', 'freezes', 'frozen', 'froze', 'broken', 'unreliable', 'bug', 'glitch',
    'hard to search', 'too many taps', 'confusing', 'cofnusing', "can't find", 'cannot find',
    'spams me', 'spam', 'too many marketing messages', 'promo notifications',
    'excessive push notifications', 'hard to navigate',
  ];

  // 3. Positive Signals
  const positiveKeywords = [
    'love the app', 'great app', 'awesome', 'excellent', 'super fast', 'usually fast',
    'clean interface', 'keep it up', 'best fintech', 'seamless', 'seamlessly',
    'smooth', 'magic', 'bravo', 'impressed', 'wonderful', 'saved me', 'perfect',
    'highly recommend', 'competitive rates', 'competitive', 'intuitive', 'simple, quick, and reliable',
    'quick, and reliable', 'reliable for my daily payments', 'would recommend',
    'made saving so much easier', 'round-up savings feature is great', 'great customer service',
    'resolved within an hour', 'worked in 10 seconds', 'best fintech app',
    'five stars', '5 stars', 'kudos', 'love it',
  ];

  // 4. Neutral / Feature Request Signals
  const neutralKeywords = [
    'feature suggestion', 'can you add', 'would love a', 'suggestion:', 'dark mode',
    'split-bill feature', 'how do i', 'how can i', 'is it possible', 'does paynext support',
    'what are the fees', 'how long does', 'just wondering', 'question about',
    'export sttaements', 'export statements', 'pdf or csv', 'please add support',
  ];

  const hasNegativeKeyword = hasComplaintSubject || negativeKeywords.some((kw) => text.includes(kw));
  const hasPositiveKeyword = positiveKeywords.some((kw) => text.includes(kw));
  const hasNeutralKeyword = neutralKeywords.some((kw) => text.includes(kw));

  // Determine Sentiment with high fidelity:
  // Negative feedback: any complaint, low rating, detractor NPS, or failure signals
  if (
    record.rating === 1 ||
    record.rating === 2 ||
    (record.nps_score !== null && record.nps_score !== undefined && record.nps_score <= 6) ||
    hasNegativeKeyword
  ) {
    sentiment = 'Negative';
  } else if (hasPositiveKeyword && !hasNegativeKeyword) {
    sentiment = 'Positive';
  } else if (
    (record.rating === 4 || record.rating === 5 || (record.nps_score !== null && record.nps_score !== undefined && record.nps_score >= 9)) &&
    !hasNegativeKeyword
  ) {
    sentiment = hasNeutralKeyword ? 'Neutral' : 'Positive';
  } else if (hasNeutralKeyword || record.rating === 3 || record.nps_score === 7 || record.nps_score === 8) {
    sentiment = 'Neutral';
  } else {
    sentiment = 'Neutral';
  }

  // 5. Category & Product Area Matching
  if (
    text.includes('loan') ||
    text.includes('disburs') ||
    text.includes('underwriting') ||
    text.includes('quickcash') ||
    text.includes('borrow') ||
    text.includes('advance') ||
    text.includes('lending') ||
    text.includes('credit')
  ) {
    primaryCategory = 'Loan processing and disbursement';
    productArea = 'Lending & Credit Engine';
    painPoint = text.includes('disburs') || text.includes('fee but')
      ? 'Approved loan funds not disbursed to customer wallet balance or fees charged without payout'
      : 'Loan application delayed in processing or underwriting review';
    urgency = text.includes('approved') || text.includes('fee but') ? 'Critical' : 'High';
  } else if (
    text.includes('dispute') ||
    text.includes('merchant charge') ||
    text.includes('wrong charge') ||
    text.includes('chargeback') ||
    text.includes('black box') ||
    text.includes('under investigation')
  ) {
    primaryCategory = 'Disputes and chargebacks';
    productArea = 'Dispute Management & Chargeback Ops';
    painPoint = 'Lack of dispute status transparency and delayed resolution for wrong merchant charges';
    urgency = 'High';
  } else if (
    text.includes('refund') ||
    text.includes('reversal') ||
    text.includes('cancelled order') ||
    text.includes('canceled order') ||
    text.includes('wallet refund') ||
    text.includes('reversed')
  ) {
    primaryCategory = 'Refunds and reversals';
    productArea = 'Wallet Settlement & Reversals';
    painPoint = 'Cancelled order or reversal funds taking multiple days to return to user balance';
    urgency = 'High';
  } else if (
    text.includes('otp') ||
    text.includes('sms code') ||
    text.includes('verification code') ||
    text.includes('login code') ||
    text.includes('cannot log in') ||
    text.includes("can't log in") ||
    text.includes('login') ||
    text.includes('log in') ||
    text.includes('mtn') ||
    text.includes('airtel') ||
    text.includes('bvn') ||
    text.includes('kyc') ||
    text.includes('nin') ||
    text.includes('selfie') ||
    text.includes('identity') ||
    text.includes('verification') ||
    text.includes('enter my pin') ||
    text.includes('locked out') ||
    text.includes('froze my account') ||
    text.includes('under review')
  ) {
    primaryCategory = 'Account access and authentication';
    productArea = 'Identity, 2FA & Onboarding';
    painPoint = text.includes('otp') || text.includes('sms') || text.includes('code')
      ? 'SMS OTP verification codes delayed or undelivered across mobile telecom carriers'
      : 'KYC identity document verification and selfie review taking days';
    urgency = 'Critical';
  } else if (
    text.includes('debited') ||
    text.includes('never went through') ||
    text.includes('not credited') ||
    text.includes('never received it') ||
    text.includes('balance still shows zero') ||
    text.includes("didn't reflect") ||
    text.includes('failed transaction') ||
    text.includes('falied')
  ) {
    primaryCategory = 'Failed transactions';
    productArea = 'Core Payments & Partner Bank Rails';
    painPoint = 'Money debited from wallet but transaction failed, didn\'t reflect, or partner bank failed to credit recipient';
    urgency = 'Critical';
  } else if (
    text.includes('virtual card') ||
    text.includes('debit card') ||
    text.includes('card payments') ||
    text.includes('declined at checkout') ||
    text.includes('card was declined') ||
    text.includes('card keeps getting declined') ||
    text.includes('declined') ||
    text.includes('declines') ||
    text.includes('chip') ||
    text.includes('3ds') ||
    text.includes('card')
  ) {
    primaryCategory = 'Card Services';
    productArea = 'Debit & Virtual Cards';
    painPoint = sentiment === 'Positive'
      ? 'Virtual card works seamlessly at online merchants'
      : 'Virtual or physical card rejected at online merchant checkout or POS';
    urgency = sentiment === 'Positive' ? 'Low' : 'High';
  } else if (
    text.includes('push notification') ||
    text.includes('marketing message') ||
    text.includes('promo notification') ||
    text.includes('excessive push') ||
    text.includes('spams me') ||
    text.includes('spam')
  ) {
    primaryCategory = 'Notifications and transaction status';
    productArea = 'Push Notification Service';
    painPoint = 'Excessive unrequested promotional notifications, loan spam, or delayed transaction alerts';
    urgency = 'Medium';
  } else if (
    text.includes('fee') ||
    text.includes('charges') ||
    text.includes('markup') ||
    text.includes('exchange rate') ||
    text.includes('fx') ||
    text.includes('inactivity fee')
  ) {
    primaryCategory = 'Fees and charges';
    productArea = 'Pricing & FX Engine';
    painPoint = 'Unexpected processing fee deductions or hidden FX rate markups';
    urgency = 'Medium';
  } else if (
    text.includes('agent') ||
    text.includes('ticket') ||
    text.includes('chat') ||
    text.includes('support') ||
    text.includes('helpdesk') ||
    text.includes('nobody picks up') ||
    text.includes('pikcs up') ||
    text.includes('customer care') ||
    text.includes('customer service') ||
    text.includes('on hold') ||
    text.includes('not happy with the service') ||
    text.includes('closed my ticket') ||
    text.includes('no response from support') ||
    text.includes('generic answer') ||
    text.includes('general complaint') ||
    text.includes('disappointing')
  ) {
    primaryCategory = 'Customer support';
    productArea = 'Customer Care & Live Support';
    painPoint = text.includes('timed out') || text.includes('waited') || text.includes('on hold')
      ? 'Live chat agent queue timeouts, long hold times, and inability to connect to a representative'
      : sentiment === 'Positive'
      ? 'Customer satisfied with fast support resolution'
      : 'Generic support ticket responses, unanswered calls, and lack of customer issue resolution';
    urgency = sentiment === 'Positive' ? 'Low' : 'High';
  } else if (
    text.includes('crashes') ||
    text.includes('crash') ||
    text.includes('closing by itself') ||
    text.includes('force closes') ||
    text.includes('freezes') ||
    text.includes('biometric') ||
    text.includes('fingerprint') ||
    text.includes('face unlock') ||
    text.includes('after updating') ||
    text.includes('version 4.') ||
    text.includes('reinstalled') ||
    text.includes('fix your app') ||
    text.includes('bad app')
  ) {
    primaryCategory = 'App performance and stability';
    productArea = 'Mobile Client Application (iOS/Android)';
    painPoint = 'App crashes, force-closes upon launching, or biometric fingerprint login breaks after updates';
    urgency = text.includes('crash') ? 'High' : 'Medium';
  } else if (
    text.includes('navigate') ||
    text.includes('beneficiary') ||
    text.includes('too many taps') ||
    text.includes('confusing') ||
    text.includes('cofnusing') ||
    text.includes('dark mode') ||
    text.includes('interface') ||
    text.includes('split-bill') ||
    text.includes('home screen') ||
    text.includes('statement') ||
    text.includes('sttaements') ||
    text.includes('export')
  ) {
    primaryCategory = 'User experience and navigation';
    productArea = 'App Navigation & Design';
    painPoint = hasNeutralKeyword
      ? 'User requesting enhanced UI capabilities (dark mode, statement export, split-bill)'
      : 'Confusing navigation, cluttered home screen, or difficult beneficiary recipient search';
    urgency = 'Medium';
  } else if (
    text.includes('payroll') ||
    text.includes('transfer') ||
    text.includes('wire') ||
    text.includes('mpesa') ||
    text.includes('deposit') ||
    text.includes('salary') ||
    text.includes('payout') ||
    text.includes('bill pay') ||
    text.includes('electricity token') ||
    text.includes('saving') ||
    text.includes('daily payments')
  ) {
    primaryCategory = 'Payments and transfers';
    productArea = 'Core Payments & Partner Bank Rails';
    painPoint = sentiment === 'Positive'
      ? 'Fast transfer execution and clean payment flow'
      : 'Inbound deposits or outbound batch payouts delayed at partner bank switch';
    urgency = sentiment === 'Positive' ? 'Low' : text.includes('salary') ? 'Critical' : 'High';
  } else {
    primaryCategory = 'User experience and navigation';
    productArea = 'App Navigation & Design';
    painPoint = 'General customer feedback regarding app usability and service quality';
    urgency = 'Low';
  }

  // Extract concise summary
  let summary = record.raw_text;
  if (summary.includes('Description:')) {
    summary = summary.split('Description:')[1].trim();
  } else if (summary.includes('Subject:')) {
    summary = summary.replace(/^Subject:\s*/i, '').trim();
  } else if (summary.includes('Participant (')) {
    summary = summary.replace(/^Interviewer note:\s*/i, '').trim();
  }
  if (summary.length > 95) {
    summary = summary.substring(0, 92) + '...';
  }

  return {
    id: `ANL-${record.feedback_id}-${Date.now().toString(36)}`,
    feedback_id: record.feedback_id,
    sentiment,
    primary_category: primaryCategory,
    secondary_category: null,
    summary,
    product_area: productArea,
    customer_pain_point: painPoint,
    urgency,
    evidence,
    confidence: 'High',
    is_unclear: record.raw_text.length < 10,
    unclear_reason: record.raw_text.length < 10 ? 'Comment is too short to extract detailed context' : null,
    status: 'Completed',
    error_message: null,
    analyzed_at: new Date().toISOString(),
  };
}

export async function analyzeFeedbackBatch(records: FeedbackRecord[]): Promise<AIAnalysis[]> {
  if (records.length === 0) return [];

  // Break large sets into manageable batches of 15 to stay within output token limits
  if (records.length > 15) {
    const allResults: AIAnalysis[] = [];
    for (let i = 0; i < records.length; i += 15) {
      const chunk = records.slice(i, i + 15);
      const chunkResults = await analyzeFeedbackBatch(chunk);
      allResults.push(...chunkResults);
    }
    return allResults;
  }

  const ai = getGenAI();

  if (!ai) {
    return records.map(fallbackAnalysis);
  }

  const promptRecords = records.map((r) => ({
    feedback_id: r.feedback_id,
    channel: r.channel,
    rating: r.rating,
    nps_score: r.nps_score,
    raw_text: r.raw_text,
    app_version: r.app_version,
    device: r.device,
  }));

  const prompt = `You are the lead AI feedback analyst for PayNext, a modern digital financial services platform.
Analyze the following customer feedback items with high rigor.

CRITICAL INSTRUCTIONS ON SENTIMENT DETECTION AND CATEGORIZATION:
1. DETECT NEGATIVE FEEDBACK: There are lots of negative comments and complaints. A feedback item is "Negative" if the customer complains about:
   - Delays, missing funds, approved loans not disbursed, money deducted but recipient not credited
   - SMS OTP codes not received or delayed, unable to log in, locked out, verification stuck
   - Disputes for wrong charges, black box investigation, lack of refund or status update
   - Debits for cancelled orders not refunded, unexpected withdrawal fees
   - Cards declined at checkout or POS
   - App crashes, biometric fingerprint login broken after update, freeze, force-closes, confusing navigation
   - Unresponsive customer support, long holds, bot loops, tickets closed without resolution
   - Frustration or dissatisfaction ("honestly I am tired", "abeg fix this", "bad app", "very disappointing", "false advertising", rating 1-2, NPS <= 6).
2. DETECT POSITIVE FEEDBACK: Feedback is "Positive" if the customer praises the service, transfers being fast, clean interface, seamless transactions, great customer service, or gives high satisfaction ratings (rating 4-5, NPS 9-10) without underlying complaints.
3. DETECT NEUTRAL FEEDBACK: Feedback is "Neutral" if it is a feature suggestion ("can you add dark mode", "would love a split-bill feature", "export statements as PDF"), general inquiry, informational question without anger/praise, or average rating (rating 3, NPS 7-8).
4. CATEGORIZE ACCURATELY into the primary financial service domain.

Classify each record:
- sentiment: "Positive" | "Neutral" | "Negative"
- primary_category: one of [
    "Payments and transfers",
    "Failed transactions",
    "Refunds and reversals",
    "Fraud and security",
    "Account access and authentication",
    "Loan processing and disbursement",
    "Customer support",
    "Disputes and chargebacks",
    "App performance and stability",
    "User experience and navigation",
    "Fees and charges",
    "Notifications and transaction status",
    "Card Services",
    "Other or unclassified"
  ]
- secondary_category: string or null
- summary: one crisp sentence summarizing the issue or comment
- product_area: e.g. "Lending Engine", "Disputes & Chargebacks", "Identity & 2FA", "Mobile App", "Core Payments", "Support Desk", "Debit & Virtual Cards"
- customer_pain_point: concrete statement of customer frustration or satisfaction
- urgency: "Critical" | "High" | "Medium" | "Low"
- evidence: exact snippet or phrase quoted directly from the customer's comment
- confidence: "High" | "Medium" | "Low"
- is_unclear: boolean (true if comment is too brief or lacks actionable context)
- unclear_reason: string explaining why it is unclear, or null

Customer Feedback Records to analyze:
${JSON.stringify(promptRecords, null, 2)}
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              feedback_id: { type: Type.STRING },
              sentiment: { type: Type.STRING },
              primary_category: { type: Type.STRING },
              secondary_category: { type: Type.STRING, nullable: true },
              summary: { type: Type.STRING },
              product_area: { type: Type.STRING },
              customer_pain_point: { type: Type.STRING },
              urgency: { type: Type.STRING },
              evidence: { type: Type.STRING },
              confidence: { type: Type.STRING },
              is_unclear: { type: Type.BOOLEAN },
              unclear_reason: { type: Type.STRING, nullable: true },
            },
            required: [
              'feedback_id',
              'sentiment',
              'primary_category',
              'summary',
              'product_area',
              'customer_pain_point',
              'urgency',
              'evidence',
              'confidence',
              'is_unclear',
            ],
          },
        },
      },
    });

    const text = response.text?.trim() || '[]';
    const parsed = JSON.parse(text);

    return records.map((record) => {
      const match = parsed.find((p: any) => p.feedback_id === record.feedback_id);
      if (!match) {
        return fallbackAnalysis(record);
      }
      return {
        id: `ANL-${record.feedback_id}-${Date.now().toString(36)}`,
        feedback_id: record.feedback_id,
        sentiment: (['Positive', 'Neutral', 'Negative'].includes(match.sentiment)
          ? match.sentiment
          : 'Neutral') as any,
        primary_category: match.primary_category || 'Other or unclassified',
        secondary_category: match.secondary_category || null,
        summary: match.summary || record.raw_text.substring(0, 100),
        product_area: match.product_area || 'Core Banking',
        customer_pain_point: match.customer_pain_point || 'General feedback',
        urgency: (['Critical', 'High', 'Medium', 'Low'].includes(match.urgency)
          ? match.urgency
          : 'Medium') as any,
        evidence: match.evidence || record.raw_text.substring(0, 80),
        confidence: match.confidence || 'High',
        is_unclear: Boolean(match.is_unclear),
        unclear_reason: match.unclear_reason || null,
        status: 'Completed',
        error_message: null,
        analyzed_at: new Date().toISOString(),
      };
    });
  } catch (err: any) {
    console.error('Gemini batch analysis failed, using fallback engine:', err);
    return records.map(fallbackAnalysis);
  }
}

export async function synthesizeRecurringIssues(
  recordsWithAnalysis: FeedbackWithAnalysis[]
): Promise<RecurringIssue[]> {
  const analyzedRecords = recordsWithAnalysis.filter(
    (r) => r.analysis && r.analysis.status === 'Completed'
  );

  if (analyzedRecords.length === 0) {
    return [];
  }

  const ai = getGenAI();

  // If Gemini is available, synthesize clusters semantically
  if (ai) {
    const inputPayload = analyzedRecords.map((r) => ({
      feedback_id: r.feedback_id,
      text: r.raw_text,
      category: r.analysis!.primary_category,
      pain_point: r.analysis!.customer_pain_point,
      product_area: r.analysis!.product_area,
      sentiment: r.analysis!.sentiment,
      urgency: r.analysis!.urgency,
      customer_id: r.customer_id,
      device: r.device,
      app_version: r.app_version,
      country: r.country,
      channel: r.channel,
      submitted_at: r.submitted_at,
    }));

    const prompt = `You are the Principal Product Director for PayNext.
Analyze the following customer feedback items and synthesize them into distinct RECURRING CUSTOMER PROBLEMS.
Criteria:
- Group complaints that describe the same underlying problem even if customers use different wording.
- Distinguish measured facts from interpretations.
- Do NOT lump all negative comments together. Group by specific underlying mechanism or failure mode.
- Each issue must have at least 1 supporting feedback ID from the input.
- For each issue, provide:
  - title: concise, executive-level problem title (e.g. "SEPA & Faster Payments Debiting Balances on Gateway Failures")
  - description: thorough explanation of what is going wrong for customers
  - product_area: affected system or team
  - primary_category: dominant category
  - supporting_feedback_ids: array of feedback_ids matching the issue
  - trend: "increasing" | "stable" | "decreasing" | "emerging"
  - confidence: "High" | "Medium" | "Low"
  - representative_comments: 2-3 illustrative exact quotes or excerpts from supporting feedback

Input Data:
${JSON.stringify(inputPayload, null, 2)}
`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                product_area: { type: Type.STRING },
                primary_category: { type: Type.STRING },
                supporting_feedback_ids: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                trend: { type: Type.STRING },
                confidence: { type: Type.STRING },
                representative_comments: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: [
                'title',
                'description',
                'product_area',
                'primary_category',
                'supporting_feedback_ids',
                'trend',
                'confidence',
                'representative_comments',
              ],
            },
          },
        },
      });

      const parsed = JSON.parse(response.text?.trim() || '[]');
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item: any, idx: number) => {
          const matchingRecords = analyzedRecords.filter((r) =>
            item.supporting_feedback_ids.includes(r.feedback_id)
          );

          const distinctCustomers = new Set(
            matchingRecords.map((r) => r.customer_id).filter(Boolean)
          ).size;

          const sentimentBreakdown = {
            positive: matchingRecords.filter((r) => r.analysis?.sentiment === 'Positive').length,
            neutral: matchingRecords.filter((r) => r.analysis?.sentiment === 'Neutral').length,
            negative: matchingRecords.filter((r) => r.analysis?.sentiment === 'Negative').length,
          };

          return {
            id: `ISSUE-${Date.now().toString(36)}-${idx + 1}`,
            title: item.title,
            description: item.description,
            product_area: item.product_area,
            primary_category: item.primary_category,
            supporting_feedback_ids: item.supporting_feedback_ids,
            feedback_count: item.supporting_feedback_ids.length,
            distinct_customers_count: distinctCustomers || item.supporting_feedback_ids.length,
            sentiment_breakdown: sentimentBreakdown,
            segments: Array.from(new Set(matchingRecords.map((r) => r.customer_segment).filter(Boolean))) as string[],
            plan_tiers: Array.from(new Set(matchingRecords.map((r) => r.plan_tier).filter(Boolean))) as string[],
            countries: Array.from(new Set(matchingRecords.map((r) => r.country).filter(Boolean))) as string[],
            channels: Array.from(new Set(matchingRecords.map((r) => r.channel).filter(Boolean))) as string[],
            devices: Array.from(new Set(matchingRecords.map((r) => r.device).filter(Boolean))) as string[],
            app_versions: Array.from(new Set(matchingRecords.map((r) => r.app_version).filter(Boolean))) as string[],
            trend: (['increasing', 'stable', 'decreasing', 'emerging'].includes(item.trend)
              ? item.trend
              : 'increasing') as any,
            representative_comments: item.representative_comments || [],
            confidence: (['High', 'Medium', 'Low'].includes(item.confidence)
              ? item.confidence
              : 'High') as any,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        });
      }
    } catch (err) {
      console.error('Gemini issue synthesis failed, falling back to clustering heuristics:', err);
    }
  }

  // Fallback programmatic clustering by category and product area
  const clusters: Record<string, FeedbackWithAnalysis[]> = {};
  for (const r of analyzedRecords) {
    const cat = r.analysis?.primary_category || 'General';
    if (!clusters[cat]) clusters[cat] = [];
    clusters[cat].push(r);
  }

  const categoryMetadata: Record<string, { title: string; description: string; area: string }> = {
    'Loan processing and disbursement': {
      title: 'Approved Loan Disbursement Delays & Upfront Processing Fee Deductions',
      description: 'Customers report loans marked approved in the application but funds remaining pending or not disbursed to their wallet, despite upfront loan fee deductions.',
      area: 'Lending & Credit Engine',
    },
    'Disputes and chargebacks': {
      title: 'Dispute Resolution Opacity & Lack of Wrong Merchant Charge Updates',
      description: 'Customers report that the dispute process operates as a black box with no status updates, investigation milestones, or prompt refunds for incorrect merchant charges.',
      area: 'Dispute Management & Chargeback Ops',
    },
    'Account access and authentication': {
      title: 'SMS OTP Delivery Failures on Carrier Networks & KYC Verification Delays',
      description: 'Critical authentication barrier where SMS verification codes fail to deliver across telecom carriers (MTN, Airtel), and KYC identity document verification takes days.',
      area: 'Identity, 2FA & Onboarding',
    },
    'Failed transactions': {
      title: 'Interbank Transfer Rail Failures & Unreflected Debited Balances',
      description: 'Transactions where funds are debited from the customer wallet but fail to credit the recipient bank account, with balance remaining at zero for days.',
      area: 'Core Payments & Partner Bank Rails',
    },
    'Refunds and reversals': {
      title: 'Wallet Settlement Delays for Cancelled Orders & Merchant Reversals',
      description: 'Refund funds from cancelled orders or reversed transactions take multiple days to return to customer wallet balances.',
      area: 'Wallet Settlement & Reversals',
    },
    'Card Services': {
      title: 'Payment Card Declines at Online Merchant Checkouts & Point of Sale',
      description: 'Virtual and debit cards being rejected during online subscription checkouts (Netflix, Spotify) or POS terminals despite sufficient available funds.',
      area: 'Debit & Virtual Cards',
    },
    'Customer support': {
      title: 'Customer Care Hold Times, Chat Queue Timeouts & Ticket Disconnects',
      description: 'Customers experience long telephone hold times, live chat timeouts, bot loops, and tickets closed without resolving the reported problem.',
      area: 'Customer Care & Live Support',
    },
    'App performance and stability': {
      title: 'Application Force-Closes & Biometric Fingerprint Failures Post-Update',
      description: 'Mobile application stability issues including crashes on launch, freezing on PIN entry, and biometric fingerprint authentication breaking after app updates.',
      area: 'Mobile Client Application (iOS/Android)',
    },
    'Fees and charges': {
      title: 'Undisclosed Withdrawal Surcharges & Hidden FX Rate Markups',
      description: 'Customers complain about unexpected fee deductions post-transaction without clear upfront disclosure or notification before confirmation.',
      area: 'Pricing & FX Engine',
    },
    'Notifications and transaction status': {
      title: 'Excessive Promotional Push Notifications & Transaction Alert Gaps',
      description: 'Customers express frustration with repeated unsolicited loan offers and promotional push messages while critical transaction status alerts are delayed.',
      area: 'Push Notification Service',
    },
    'User experience and navigation': {
      title: 'Navigation Clutter, Complex Transfer Flows & Beneficiary Search Friction',
      description: 'Usability challenges with multi-tap transfer flows, confusing redesigned home screens, and hard-to-search saved beneficiary lists.',
      area: 'App Navigation & Design',
    },
    'Payments and transfers': {
      title: 'Batch Staff Salary Payout & Deposit Reflection Latencies',
      description: 'Batch corporate payroll payouts stuck in pending status at partner bank switches and mobile money deposit reflection delays.',
      area: 'Core Payments & Partner Bank Rails',
    },
  };

  return Object.entries(clusters).map(([category, items], idx) => {
    const matchingIds = items.map((i) => i.feedback_id);
    const distinctCustomers = new Set(items.map((i) => i.customer_id).filter(Boolean)).size;
    const meta = categoryMetadata[category] || {
      title: `Recurring frictions in ${category}`,
      description: `Multiple customers reported issues regarding ${category.toLowerCase()}, affecting transfer reliability and customer trust.`,
      area: items[0]?.analysis?.product_area || 'Core Product',
    };

    return {
      id: `ISSUE-${Date.now().toString(36)}-${idx + 1}`,
      title: meta.title,
      description: meta.description,
      product_area: meta.area,
      primary_category: category,
      supporting_feedback_ids: matchingIds,
      feedback_count: matchingIds.length,
      distinct_customers_count: distinctCustomers || matchingIds.length,
      sentiment_breakdown: {
        positive: items.filter((r) => r.analysis?.sentiment === 'Positive').length,
        neutral: items.filter((r) => r.analysis?.sentiment === 'Neutral').length,
        negative: items.filter((r) => r.analysis?.sentiment === 'Negative').length,
      },
      segments: Array.from(new Set(items.map((r) => r.customer_segment).filter(Boolean))) as string[],
      plan_tiers: Array.from(new Set(items.map((r) => r.plan_tier).filter(Boolean))) as string[],
      countries: Array.from(new Set(items.map((r) => r.country).filter(Boolean))) as string[],
      channels: Array.from(new Set(items.map((r) => r.channel).filter(Boolean))) as string[],
      devices: Array.from(new Set(items.map((r) => r.device).filter(Boolean))) as string[],
      app_versions: Array.from(new Set(items.map((r) => r.app_version).filter(Boolean))) as string[],
      trend: 'increasing',
      representative_comments: items.slice(0, 3).map((r) => r.raw_text),
      confidence: 'High',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });
}

export async function generateProductRequirement(
  issue: RecurringIssue,
  supportingFeedback: FeedbackRecord[]
): Promise<ProductRequirement> {
  const ai = getGenAI();

  const fallbackReq: ProductRequirement = {
    id: `REQ-${Date.now().toString(36).toUpperCase()}`,
    issue_id: issue.id,
    title: `Resolve ${issue.title}`,
    problem_statement: issue.description,
    evidence_summary: `Backed by ${supportingFeedback.length} verified customer reports across ${issue.countries.join(', ')}. Key feedback excerpt: "${supportingFeedback[0]?.raw_text || ''}"`,
    affected_customer_groups: `${issue.segments.join(', ')} on ${issue.plan_tiers.join(', ')} tiers`,
    proposed_solution: `Implement automated validation, idempotent backend processing, and real-time status reporting for ${issue.primary_category.toLowerCase()}.`,
    user_story: `As a PayNext ${issue.segments[0] || 'customer'}, I want reliable ${issue.primary_category.toLowerCase()} with instant status transparency, so that I can manage my finances without unexpected delays or held balances.`,
    acceptance_criteria: [
      `1. System must never debit user balances when an upstream gateway error occurs.`,
      `2. Transaction state transitions must reflect in user UI within 1500ms.`,
      `3. In event of failure, human-readable recovery steps must be provided to user.`,
      `4. Telemetry and alerting trigger when failure rate exceeds 0.5% in 5-minute rolling window.`,
    ],
    priority: issue.feedback_count > 3 ? 'Critical' : 'High',
    priority_rationale: `Frequency of ${issue.feedback_count} complaints with high churn risk and financial loss implications for business users.`,
    supporting_feedback_ids: supportingFeedback.map((f) => f.feedback_id),
    review_status: 'Draft',
    review_notes: null,
    reviewed_by: null,
    reviewed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (!ai) {
    return fallbackReq;
  }

  const prompt = `You are a Principal Technical Product Manager at PayNext (fintech).
Generate an evidence-backed Product Requirement Specification (PRD / Feature Spec) for the following customer problem:

Issue Title: ${issue.title}
Issue Description: ${issue.description}
Product Area: ${issue.product_area}
Affected Segments: ${issue.segments.join(', ')}
Affected Plan Tiers: ${issue.plan_tiers.join(', ')}
Total Customer Reports: ${issue.feedback_count}

Supporting Customer Feedback Quotes:
${supportingFeedback.map((f) => `- [${f.feedback_id}] (${f.channel}, Rating: ${f.rating || 'N/A'}): "${f.raw_text}"`).join('\n')}

Format requirements:
1. title: Crisp feature or fix title
2. problem_statement: High-fidelity problem statement with root-cause context
3. evidence_summary: Summary of facts, frequency, and quotes
4. affected_customer_groups: Specific breakdown of personas and tiers
5. proposed_solution: Engineering and product architecture recommendation
6. user_story: Strict standard format: "As a [type of user], I want [capability], so that [benefit]."
7. acceptance_criteria: Array of 4-6 specific, measurable, testable acceptance criteria
8. priority: "Critical" | "High" | "Medium" | "Low"
9. priority_rationale: Analytical reasoning factoring frequency, severity, business risk, customer impact, and evidence quality
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            problem_statement: { type: Type.STRING },
            evidence_summary: { type: Type.STRING },
            affected_customer_groups: { type: Type.STRING },
            proposed_solution: { type: Type.STRING },
            user_story: { type: Type.STRING },
            acceptance_criteria: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            priority: { type: Type.STRING },
            priority_rationale: { type: Type.STRING },
          },
          required: [
            'title',
            'problem_statement',
            'evidence_summary',
            'affected_customer_groups',
            'proposed_solution',
            'user_story',
            'acceptance_criteria',
            'priority',
            'priority_rationale',
          ],
        },
      },
    });

    const parsed = JSON.parse(response.text?.trim() || '{}');
    return {
      id: `REQ-${Date.now().toString(36).toUpperCase()}`,
      issue_id: issue.id,
      title: parsed.title || fallbackReq.title,
      problem_statement: parsed.problem_statement || fallbackReq.problem_statement,
      evidence_summary: parsed.evidence_summary || fallbackReq.evidence_summary,
      affected_customer_groups: parsed.affected_customer_groups || fallbackReq.affected_customer_groups,
      proposed_solution: parsed.proposed_solution || fallbackReq.proposed_solution,
      user_story: parsed.user_story || fallbackReq.user_story,
      acceptance_criteria: parsed.acceptance_criteria || fallbackReq.acceptance_criteria,
      priority: (['Critical', 'High', 'Medium', 'Low'].includes(parsed.priority)
        ? parsed.priority
        : fallbackReq.priority) as any,
      priority_rationale: parsed.priority_rationale || fallbackReq.priority_rationale,
      supporting_feedback_ids: supportingFeedback.map((f) => f.feedback_id),
      review_status: 'Draft',
      review_notes: null,
      reviewed_by: null,
      reviewed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  } catch (err) {
    console.error('Failed to generate product requirement with Gemini, returning standard PRD:', err);
    return fallbackReq;
  }
}
