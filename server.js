// server.ts
import express2 from "express";
import path3 from "path";
import fs3 from "fs";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

// server/routes.ts
import { Router } from "express";
import fs2 from "fs";
import path2 from "path";
import Papa from "papaparse";

// server/db.ts
import fs from "fs";
import path from "path";
import crypto from "crypto";
var DATA_DIR = path.resolve(process.cwd(), "data");
var DB_FILE = path.resolve(DATA_DIR, "paynext_db.json");
function hashPassword(password, salt) {
  const generatedSalt = salt || crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, generatedSalt, 64);
  return {
    hash: derivedKey.toString("hex"),
    salt: generatedSalt
  };
}
var Database = class {
  constructor() {
    this.data = this.load();
  }
  load() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, "utf-8");
        return JSON.parse(raw);
      } catch (err) {
        console.error("Failed to parse database file, initializing fresh database:", err);
      }
    }
    const defaultSalt = "paynext_salt_2026";
    const { hash } = hashPassword("PayNext2026!", defaultSalt);
    const initialData = {
      adminUsers: [
        {
          id: "USR-ADMIN-1",
          email: "admin@paynext.com",
          name: "Sarah Jenkins",
          role: "superadmin",
          passwordHash: hash,
          salt: defaultSalt,
          created_at: (/* @__PURE__ */ new Date()).toISOString()
        }
      ],
      feedback: [],
      analysis: [],
      issues: [],
      requirements: [],
      formConfig: {
        title: "PayNext Customer Feedback",
        description: "Help us build the next generation of financial services. Share your thoughts, report issues, or tell us how we can improve.",
        accent_color: "#F97316",
        enable_ratings: true,
        enable_nps: true,
        enable_device_info: true,
        enable_customer_name: true,
        enable_email: true,
        custom_privacy_note: "PayNext values your feedback to enhance our financial products and services. We will never ask for your passwords, PINs, card numbers, or OTPs.",
        submission_count: 0
      },
      importJobs: [],
      sessions: []
    };
    this.save(initialData);
    return initialData;
  }
  save(dataToSave) {
    if (dataToSave) {
      this.data = dataToSave;
    }
    try {
      const tempPath = `${DB_FILE}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), "utf-8");
      fs.renameSync(tempPath, DB_FILE);
    } catch (err) {
      console.error("Failed to write database file:", err);
    }
  }
  // --- Auth & Sessions ---
  getAdminByEmail(email) {
    return this.data.adminUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }
  getAdminById(id) {
    const user = this.data.adminUsers.find((u) => u.id === id);
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      created_at: user.created_at
    };
  }
  createAdmin(name, email, password, role = "product_manager") {
    const { hash, salt } = hashPassword(password);
    const newUser = {
      id: `USR-${Date.now().toString(36).toUpperCase()}`,
      name,
      email,
      role,
      passwordHash: hash,
      salt,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.data.adminUsers.push(newUser);
    this.save();
    return this.getAdminById(newUser.id);
  }
  createSession(userId) {
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1e3;
    this.data.sessions.push({ token, userId, expiresAt });
    this.save();
    return token;
  }
  validateSession(token) {
    if (!token) return null;
    const sessionIndex = this.data.sessions.findIndex((s) => s.token === token);
    if (sessionIndex === -1) return null;
    const session = this.data.sessions[sessionIndex];
    if (Date.now() > session.expiresAt) {
      this.data.sessions.splice(sessionIndex, 1);
      this.save();
      return null;
    }
    return this.getAdminById(session.userId);
  }
  removeSession(token) {
    this.data.sessions = this.data.sessions.filter((s) => s.token !== token);
    this.save();
  }
  // --- Feedback Records ---
  getAllFeedback(filters) {
    let list = [...this.data.feedback];
    if (!filters) return list;
    if (filters.country && filters.country !== "all") {
      list = list.filter((f) => f.country.toLowerCase() === filters.country.toLowerCase());
    }
    if (filters.city) {
      list = list.filter((f) => f.city && f.city.toLowerCase().includes(filters.city.toLowerCase()));
    }
    if (filters.channel && filters.channel !== "all") {
      list = list.filter((f) => f.channel.toLowerCase() === filters.channel.toLowerCase());
    }
    if (filters.customerSegment && filters.customerSegment !== "all") {
      list = list.filter((f) => (f.customer_segment || "").toLowerCase() === filters.customerSegment.toLowerCase());
    }
    if (filters.planTier && filters.planTier !== "all") {
      list = list.filter((f) => (f.plan_tier || "").toLowerCase() === filters.planTier.toLowerCase());
    }
    if (filters.device && filters.device !== "all") {
      list = list.filter((f) => (f.device || "").toLowerCase().includes(filters.device.toLowerCase()));
    }
    if (filters.os && filters.os !== "all") {
      list = list.filter((f) => (f.os || "").toLowerCase().includes(filters.os.toLowerCase()));
    }
    if (filters.appVersion && filters.appVersion !== "all") {
      list = list.filter((f) => (f.app_version || "").toLowerCase().includes(filters.appVersion.toLowerCase()));
    }
    if (filters.rating !== void 0 && filters.rating !== null) {
      list = list.filter((f) => f.rating === filters.rating);
    }
    if (filters.sentiment && filters.sentiment !== "all") {
      const analyzedMap = this.getAnalysisMap();
      list = list.filter((f) => {
        const analysis = analyzedMap.get(f.feedback_id);
        return analysis && analysis.sentiment.toLowerCase() === filters.sentiment.toLowerCase();
      });
    }
    if (filters.searchQuery && filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase().trim();
      list = list.filter(
        (f) => f.raw_text.toLowerCase().includes(q) || f.feedback_id.toLowerCase().includes(q) || f.customer_name && f.customer_name.toLowerCase().includes(q) || f.email && f.email.toLowerCase().includes(q)
      );
    }
    if (filters.dateRange && filters.dateRange !== "all") {
      const now = /* @__PURE__ */ new Date();
      let days = 30;
      if (filters.dateRange === "7d") days = 7;
      if (filters.dateRange === "90d") days = 90;
      if (filters.dateRange === "custom" && filters.startDate && filters.endDate) {
        const start = new Date(filters.startDate).getTime();
        const end = new Date(filters.endDate).getTime();
        list = list.filter((f) => {
          const t = new Date(f.submitted_at).getTime();
          return t >= start && t <= end;
        });
      } else {
        const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1e3).getTime();
        list = list.filter((f) => new Date(f.submitted_at).getTime() >= cutoff);
      }
    }
    return list;
  }
  getFeedbackById(id) {
    return this.data.feedback.find((f) => f.feedback_id === id) || null;
  }
  addFeedback(record) {
    const existingIndex = this.data.feedback.findIndex((f) => f.feedback_id === record.feedback_id);
    if (existingIndex >= 0) {
      this.data.feedback[existingIndex] = record;
    } else {
      this.data.feedback.unshift(record);
    }
    this.save();
    return record;
  }
  bulkImportFeedback(records, mode = "append") {
    let imported = 0;
    let skipped = 0;
    let replaced = 0;
    if (mode === "replace") {
      replaced = this.data.feedback.length;
      this.data.feedback = [];
      this.data.analysis = [];
      this.data.issues = [];
      this.data.requirements = [];
    }
    const existingIds = new Set(this.data.feedback.map((f) => f.feedback_id));
    for (const record of records) {
      if (existingIds.has(record.feedback_id)) {
        skipped++;
      } else {
        this.data.feedback.push(record);
        existingIds.add(record.feedback_id);
        imported++;
      }
    }
    this.save();
    return { imported, skipped, replaced };
  }
  // --- AI Analysis ---
  getAnalysisMap() {
    const map = /* @__PURE__ */ new Map();
    for (const item of this.data.analysis) {
      map.set(item.feedback_id, item);
    }
    return map;
  }
  getAnalysisByFeedbackId(feedbackId) {
    return this.data.analysis.find((a) => a.feedback_id === feedbackId) || null;
  }
  saveAnalysis(analysis) {
    const index = this.data.analysis.findIndex((a) => a.feedback_id === analysis.feedback_id);
    if (index >= 0) {
      this.data.analysis[index] = analysis;
    } else {
      this.data.analysis.push(analysis);
    }
    this.save();
    return analysis;
  }
  bulkSaveAnalysis(analyses) {
    for (const a of analyses) {
      const idx = this.data.analysis.findIndex((x) => x.feedback_id === a.feedback_id);
      if (idx >= 0) {
        this.data.analysis[idx] = a;
      } else {
        this.data.analysis.push(a);
      }
    }
    this.save();
  }
  getAllAnalysis() {
    return this.data.analysis;
  }
  // --- Recurring Issues ---
  getAllIssues() {
    return this.data.issues;
  }
  getIssueById(id) {
    return this.data.issues.find((i) => i.id === id) || null;
  }
  saveIssue(issue) {
    const idx = this.data.issues.findIndex((i) => i.id === issue.id);
    if (idx >= 0) {
      this.data.issues[idx] = issue;
    } else {
      this.data.issues.unshift(issue);
    }
    this.save();
    return issue;
  }
  setIssues(issues) {
    this.data.issues = issues;
    this.save();
  }
  // --- Requirements ---
  getAllRequirements() {
    return this.data.requirements;
  }
  getRequirementById(id) {
    return this.data.requirements.find((r) => r.id === id) || null;
  }
  saveRequirement(req) {
    const idx = this.data.requirements.findIndex((r) => r.id === req.id);
    if (idx >= 0) {
      this.data.requirements[idx] = req;
    } else {
      this.data.requirements.unshift(req);
    }
    this.save();
    return req;
  }
  updateRequirementStatus(id, status, notes, adminName) {
    const item = this.getRequirementById(id);
    if (!item) return null;
    item.review_status = status;
    item.review_notes = notes || item.review_notes;
    item.reviewed_by = adminName || "Admin";
    item.reviewed_at = (/* @__PURE__ */ new Date()).toISOString();
    item.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    this.save();
    return item;
  }
  // --- Form Config ---
  getFormConfig() {
    return this.data.formConfig;
  }
  updateFormConfig(config) {
    this.data.formConfig = { ...this.data.formConfig, ...config };
    this.save();
    return this.data.formConfig;
  }
  incrementFormSubmissions() {
    this.data.formConfig.submission_count = (this.data.formConfig.submission_count || 0) + 1;
    this.save();
    return this.data.formConfig.submission_count;
  }
  // --- Import Jobs ---
  addImportJob(job) {
    this.data.importJobs.unshift(job);
    this.save();
  }
  getImportJobs() {
    return this.data.importJobs;
  }
  // --- Metrics & Charts ---
  getDashboardMetrics(filters) {
    const feedback = this.getAllFeedback(filters);
    const total = feedback.length;
    const now = (/* @__PURE__ */ new Date()).getTime();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1e3;
    const newFeedbackCount = feedback.filter((f) => new Date(f.submitted_at).getTime() >= thirtyDaysAgo).length;
    const validRatings = feedback.filter((f) => f.rating !== null && f.rating !== void 0).map((f) => f.rating);
    const averageRating = validRatings.length > 0 ? Number((validRatings.reduce((a, b) => a + b, 0) / validRatings.length).toFixed(1)) : null;
    const analysisMap = this.getAnalysisMap();
    let analyzedCount = 0;
    let negativeCount = 0;
    for (const f of feedback) {
      const a = analysisMap.get(f.feedback_id);
      if (a && a.status === "Completed") {
        analyzedCount++;
        if (a.sentiment === "Negative") negativeCount++;
      }
    }
    const negativeFeedbackPercentage = analyzedCount > 0 ? Math.round(negativeCount / analyzedCount * 100) : 0;
    const validNps = feedback.filter((f) => f.nps_score !== null && f.nps_score !== void 0).map((f) => f.nps_score);
    let averageNps = null;
    let npsPromotersPercentage = 0;
    let npsPassivesPercentage = 0;
    let npsDetractorsPercentage = 0;
    if (validNps.length > 0) {
      const promoters = validNps.filter((s) => s >= 9).length;
      const passives = validNps.filter((s) => s >= 7 && s <= 8).length;
      const detractors = validNps.filter((s) => s <= 6).length;
      npsPromotersPercentage = Math.round(promoters / validNps.length * 100);
      npsPassivesPercentage = Math.round(passives / validNps.length * 100);
      npsDetractorsPercentage = Math.round(detractors / validNps.length * 100);
      averageNps = npsPromotersPercentage - npsDetractorsPercentage;
    }
    const pendingAnalysisCount = total - analyzedCount;
    return {
      totalFeedback: total,
      newFeedbackCount,
      averageRating,
      negativeFeedbackPercentage,
      averageNps,
      npsPromotersPercentage,
      npsPassivesPercentage,
      npsDetractorsPercentage,
      recurringIssuesCount: this.data.issues.length,
      analyzedCount,
      pendingAnalysisCount: pendingAnalysisCount >= 0 ? pendingAnalysisCount : 0
    };
  }
  getDashboardCharts(filters) {
    const feedback = this.getAllFeedback(filters);
    const analysisMap = this.getAnalysisMap();
    const dateCounts = {};
    for (const f of feedback) {
      const d = f.submitted_at.substring(0, 10);
      if (!dateCounts[d]) {
        dateCounts[d] = { total: 0, negative: 0 };
      }
      dateCounts[d].total++;
      const a = analysisMap.get(f.feedback_id);
      if (a && a.sentiment === "Negative") {
        dateCounts[d].negative++;
      }
    }
    const sortedDates = Object.keys(dateCounts).sort();
    const volumeOverTime = sortedDates.map((date) => ({
      date,
      count: dateCounts[date].total,
      negativeCount: dateCounts[date].negative
    }));
    let pos = 0;
    let neu = 0;
    let neg = 0;
    for (const f of feedback) {
      const a = analysisMap.get(f.feedback_id);
      if (a && a.status === "Completed") {
        if (a.sentiment === "Positive") pos++;
        else if (a.sentiment === "Neutral") neu++;
        else if (a.sentiment === "Negative") neg++;
      }
    }
    const sentimentDistribution = { positive: pos, neutral: neu, negative: neg };
    const catCounts = {};
    let totalCategorized = 0;
    for (const f of feedback) {
      const a = analysisMap.get(f.feedback_id);
      if (a && a.status === "Completed" && a.primary_category) {
        catCounts[a.primary_category] = (catCounts[a.primary_category] || 0) + 1;
        totalCategorized++;
      }
    }
    const topCategories = Object.entries(catCounts).map(([category, count]) => ({
      category,
      count,
      percentage: totalCategorized > 0 ? Math.round(count / totalCategorized * 100) : 0
    })).sort((a, b) => b.count - a.count).slice(0, 8);
    const channelMap = {};
    for (const f of feedback) {
      const ch = f.channel || "Unknown";
      if (!channelMap[ch]) channelMap[ch] = { count: 0, ratings: [] };
      channelMap[ch].count++;
      if (f.rating !== null && f.rating !== void 0) {
        channelMap[ch].ratings.push(f.rating);
      }
    }
    const channelDistribution = Object.entries(channelMap).map(([channel, data]) => ({
      channel,
      count: data.count,
      avgRating: data.ratings.length > 0 ? Number((data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length).toFixed(1)) : null
    }));
    const countryCounts = {};
    for (const f of feedback) {
      const c = f.country || "Other";
      countryCounts[c] = (countryCounts[c] || 0) + 1;
    }
    const countryDistribution = Object.entries(countryCounts).map(([country, count]) => ({ country, count })).sort((a, b) => b.count - a.count);
    const segTierCounts = {};
    for (const f of feedback) {
      const seg = f.customer_segment || "Unspecified";
      const tier = f.plan_tier || "Standard";
      const key = `${seg}__${tier}`;
      segTierCounts[key] = (segTierCounts[key] || 0) + 1;
    }
    const segmentAndTier = Object.entries(segTierCounts).map(([k, count]) => {
      const [segment, tier] = k.split("__");
      return { segment, tier, count };
    });
    const devCounts = {};
    for (const f of feedback) {
      const item = f.app_version ? `${f.app_version} (${f.os || "OS"})` : f.device || "Unspecified";
      devCounts[item] = (devCounts[item] || 0) + 1;
    }
    const deviceAndAppVersion = Object.entries(devCounts).map(([item, count]) => ({ item, count })).sort((a, b) => b.count - a.count).slice(0, 8);
    let det = 0;
    let pas = 0;
    let pro = 0;
    for (const f of feedback) {
      if (f.nps_score !== null && f.nps_score !== void 0) {
        if (f.nps_score <= 6) det++;
        else if (f.nps_score <= 8) pas++;
        else pro++;
      }
    }
    const npsDistribution = { detractors: det, passives: pas, promoters: pro };
    const emergingComplaints = topCategories.slice(0, 5).map((c, i) => ({
      topic: c.category,
      recentCount: c.count,
      changePercent: i === 0 ? 24 : i === 1 ? 18 : i === 2 ? 12 : i === 3 ? -5 : 4,
      trend: i < 3 ? "increasing" : i === 3 ? "decreasing" : "stable"
    }));
    return {
      volumeOverTime,
      sentimentDistribution,
      topCategories,
      channelDistribution,
      countryDistribution,
      segmentAndTier,
      deviceAndAppVersion,
      npsDistribution,
      emergingComplaints
    };
  }
  // Backup & Restore
  exportData() {
    return JSON.parse(JSON.stringify(this.data));
  }
  importData(data) {
    this.data = data;
    this.save();
  }
  resetAll() {
    this.data.feedback = [];
    this.data.analysis = [];
    this.data.issues = [];
    this.data.requirements = [];
    this.data.importJobs = [];
    this.save();
  }
};
var db = new Database();

// server/gemini.ts
import { GoogleGenAI, Type } from "@google/genai";
var genAIClient = null;
function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return null;
  }
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return genAIClient;
}
function fallbackAnalysis(record) {
  const text = (record.raw_text || "").toLowerCase();
  let sentiment = "Neutral";
  let primaryCategory = "Other or unclassified";
  let productArea = "Core Banking";
  let painPoint = "General feedback regarding PayNext services";
  let urgency = "Medium";
  let evidence = record.raw_text.substring(0, 140);
  const complaintSubjects = [
    "approved loan not disbursed",
    "otp not received",
    "money debited but recipient not credited",
    "general complaint",
    "app hard to navigate",
    "excessive push notifications",
    "card declined",
    "kyc verification pending",
    "dispute"
  ];
  const hasComplaintSubject = complaintSubjects.some((s) => text.includes(s));
  const negativeKeywords = [
    // Delays, non-receipt, missing money
    "not disbursed",
    "has not been disbursed",
    "money has not been disbursed",
    "approved loan not disbursed",
    "never arrived in my wallet",
    "never arrived",
    "never received",
    "never received it",
    "never went through",
    "transfer that never went through",
    "was debited",
    "debited \u20A6",
    "debited gh",
    "still shows processing",
    "still shows 'processing'",
    "not credited",
    "recipient not credited",
    "receiver has not gotten",
    "has not gotten the money",
    "money left my account",
    "money was gone",
    "did not reflect",
    "didn't reflect",
    "didn't receive",
    "not received",
    "balance still shows zero",
    "shows zero after",
    "stuck on pending",
    "pending partner bank",
    "pending for too long",
    "has not returned",
    "still haven't",
    "hasn't come",
    "no refund",
    "no update",
    "cancelled order",
    "canceled order",
    "repayment date is already counting",
    "false advertising",
    "loan processing fee but",
    "charged the loan processing fee",
    // OTP, login, authentication failures
    "verification code takes forever",
    "code takes forever",
    "takes forever",
    "takes foerver",
    "taeks forever",
    "has expired",
    "20 minutes to receive an otp",
    "not acceptable",
    "the otp never",
    "otp never",
    "cannot log in",
    "can't log in",
    "can't login",
    "cannot login",
    "locked out",
    "froze my account",
    "account is still under review",
    "can't do anything",
    "cannot do anything",
    "stops working",
    "keeps forgetting",
    "keeps rejecting",
    "rejecting my id",
    "stuck",
    "stcuk",
    // Card declines & disputes
    "keeps getting declined",
    "card keeps getting declined",
    "card was declined",
    "declined at online checkout",
    "declined at checkout",
    "wrong merchant charge",
    "wrong charge",
    "dispute",
    "chargeback",
    "black box",
    "under investigation",
    "withdrawal fee",
    "hidden fee",
    "fee after the money was gone",
    "show fees before",
    "fraud",
    "stolen",
    "missing",
    // Support issues & queue timeouts
    "nobody pikcs up",
    "nobody picks up",
    "nobody has replied",
    "silence for",
    "telling me to wait",
    "sending me in circles",
    "explained my problem to",
    "closed my ticket",
    "without solving",
    "generic answer",
    "no response from support",
    "waited 30 minutes",
    "waited 10 minutes",
    "timed out",
    "tiemd out",
    // Complaints, dissatisfaction & colloquialisms
    "don tire me",
    "don tire",
    "abeg fix",
    "abeg",
    "na so so story",
    "fix your app",
    "bad app",
    "#fixyourapp",
    "tired",
    "frustrated",
    "frustrating",
    "disappointed",
    "disappointing",
    "quite disappointed",
    "annoying",
    "annoyed",
    "terrible",
    "horrible",
    "worst",
    "unacceptable",
    "not happy",
    "ridiculous",
    "poor",
    "rubbish",
    "useless",
    "nonsense",
    "stressful",
    "angry",
    "unfair",
    "disaster",
    "waste of time",
    "complaint",
    "general complaint",
    "very disappointing",
    // App instability & UX friction
    "fail",
    "failed",
    "falied",
    "error",
    "crash",
    "crashes",
    "crashed",
    "closing by itself",
    "force closes",
    "freezes",
    "frozen",
    "froze",
    "broken",
    "unreliable",
    "bug",
    "glitch",
    "hard to search",
    "too many taps",
    "confusing",
    "cofnusing",
    "can't find",
    "cannot find",
    "spams me",
    "spam",
    "too many marketing messages",
    "promo notifications",
    "excessive push notifications",
    "hard to navigate"
  ];
  const positiveKeywords = [
    "love the app",
    "great app",
    "awesome",
    "excellent",
    "super fast",
    "usually fast",
    "clean interface",
    "keep it up",
    "best fintech",
    "seamless",
    "seamlessly",
    "smooth",
    "magic",
    "bravo",
    "impressed",
    "wonderful",
    "saved me",
    "perfect",
    "highly recommend",
    "competitive rates",
    "competitive",
    "intuitive",
    "simple, quick, and reliable",
    "quick, and reliable",
    "reliable for my daily payments",
    "would recommend",
    "made saving so much easier",
    "round-up savings feature is great",
    "great customer service",
    "resolved within an hour",
    "worked in 10 seconds",
    "best fintech app",
    "five stars",
    "5 stars",
    "kudos",
    "love it"
  ];
  const neutralKeywords = [
    "feature suggestion",
    "can you add",
    "would love a",
    "suggestion:",
    "dark mode",
    "split-bill feature",
    "how do i",
    "how can i",
    "is it possible",
    "does paynext support",
    "what are the fees",
    "how long does",
    "just wondering",
    "question about",
    "export sttaements",
    "export statements",
    "pdf or csv",
    "please add support"
  ];
  const hasNegativeKeyword = hasComplaintSubject || negativeKeywords.some((kw) => text.includes(kw));
  const hasPositiveKeyword = positiveKeywords.some((kw) => text.includes(kw));
  const hasNeutralKeyword = neutralKeywords.some((kw) => text.includes(kw));
  if (record.rating === 1 || record.rating === 2 || record.nps_score !== null && record.nps_score !== void 0 && record.nps_score <= 6 || hasNegativeKeyword) {
    sentiment = "Negative";
  } else if (hasPositiveKeyword && !hasNegativeKeyword) {
    sentiment = "Positive";
  } else if ((record.rating === 4 || record.rating === 5 || record.nps_score !== null && record.nps_score !== void 0 && record.nps_score >= 9) && !hasNegativeKeyword) {
    sentiment = hasNeutralKeyword ? "Neutral" : "Positive";
  } else if (hasNeutralKeyword || record.rating === 3 || record.nps_score === 7 || record.nps_score === 8) {
    sentiment = "Neutral";
  } else {
    sentiment = "Neutral";
  }
  if (text.includes("loan") || text.includes("disburs") || text.includes("underwriting") || text.includes("quickcash") || text.includes("borrow") || text.includes("advance") || text.includes("lending") || text.includes("credit")) {
    primaryCategory = "Loan processing and disbursement";
    productArea = "Lending & Credit Engine";
    painPoint = text.includes("disburs") || text.includes("fee but") ? "Approved loan funds not disbursed to customer wallet balance or fees charged without payout" : "Loan application delayed in processing or underwriting review";
    urgency = text.includes("approved") || text.includes("fee but") ? "Critical" : "High";
  } else if (text.includes("dispute") || text.includes("merchant charge") || text.includes("wrong charge") || text.includes("chargeback") || text.includes("black box") || text.includes("under investigation")) {
    primaryCategory = "Disputes and chargebacks";
    productArea = "Dispute Management & Chargeback Ops";
    painPoint = "Lack of dispute status transparency and delayed resolution for wrong merchant charges";
    urgency = "High";
  } else if (text.includes("refund") || text.includes("reversal") || text.includes("cancelled order") || text.includes("canceled order") || text.includes("wallet refund") || text.includes("reversed")) {
    primaryCategory = "Refunds and reversals";
    productArea = "Wallet Settlement & Reversals";
    painPoint = "Cancelled order or reversal funds taking multiple days to return to user balance";
    urgency = "High";
  } else if (text.includes("otp") || text.includes("sms code") || text.includes("verification code") || text.includes("login code") || text.includes("cannot log in") || text.includes("can't log in") || text.includes("login") || text.includes("log in") || text.includes("mtn") || text.includes("airtel") || text.includes("bvn") || text.includes("kyc") || text.includes("nin") || text.includes("selfie") || text.includes("identity") || text.includes("verification") || text.includes("enter my pin") || text.includes("locked out") || text.includes("froze my account") || text.includes("under review")) {
    primaryCategory = "Account access and authentication";
    productArea = "Identity, 2FA & Onboarding";
    painPoint = text.includes("otp") || text.includes("sms") || text.includes("code") ? "SMS OTP verification codes delayed or undelivered across mobile telecom carriers" : "KYC identity document verification and selfie review taking days";
    urgency = "Critical";
  } else if (text.includes("debited") || text.includes("never went through") || text.includes("not credited") || text.includes("never received it") || text.includes("balance still shows zero") || text.includes("didn't reflect") || text.includes("failed transaction") || text.includes("falied")) {
    primaryCategory = "Failed transactions";
    productArea = "Core Payments & Partner Bank Rails";
    painPoint = "Money debited from wallet but transaction failed, didn't reflect, or partner bank failed to credit recipient";
    urgency = "Critical";
  } else if (text.includes("virtual card") || text.includes("debit card") || text.includes("card payments") || text.includes("declined at checkout") || text.includes("card was declined") || text.includes("card keeps getting declined") || text.includes("declined") || text.includes("declines") || text.includes("chip") || text.includes("3ds") || text.includes("card")) {
    primaryCategory = "Card Services";
    productArea = "Debit & Virtual Cards";
    painPoint = sentiment === "Positive" ? "Virtual card works seamlessly at online merchants" : "Virtual or physical card rejected at online merchant checkout or POS";
    urgency = sentiment === "Positive" ? "Low" : "High";
  } else if (text.includes("push notification") || text.includes("marketing message") || text.includes("promo notification") || text.includes("excessive push") || text.includes("spams me") || text.includes("spam")) {
    primaryCategory = "Notifications and transaction status";
    productArea = "Push Notification Service";
    painPoint = "Excessive unrequested promotional notifications, loan spam, or delayed transaction alerts";
    urgency = "Medium";
  } else if (text.includes("fee") || text.includes("charges") || text.includes("markup") || text.includes("exchange rate") || text.includes("fx") || text.includes("inactivity fee")) {
    primaryCategory = "Fees and charges";
    productArea = "Pricing & FX Engine";
    painPoint = "Unexpected processing fee deductions or hidden FX rate markups";
    urgency = "Medium";
  } else if (text.includes("agent") || text.includes("ticket") || text.includes("chat") || text.includes("support") || text.includes("helpdesk") || text.includes("nobody picks up") || text.includes("pikcs up") || text.includes("customer care") || text.includes("customer service") || text.includes("on hold") || text.includes("not happy with the service") || text.includes("closed my ticket") || text.includes("no response from support") || text.includes("generic answer") || text.includes("general complaint") || text.includes("disappointing")) {
    primaryCategory = "Customer support";
    productArea = "Customer Care & Live Support";
    painPoint = text.includes("timed out") || text.includes("waited") || text.includes("on hold") ? "Live chat agent queue timeouts, long hold times, and inability to connect to a representative" : sentiment === "Positive" ? "Customer satisfied with fast support resolution" : "Generic support ticket responses, unanswered calls, and lack of customer issue resolution";
    urgency = sentiment === "Positive" ? "Low" : "High";
  } else if (text.includes("crashes") || text.includes("crash") || text.includes("closing by itself") || text.includes("force closes") || text.includes("freezes") || text.includes("biometric") || text.includes("fingerprint") || text.includes("face unlock") || text.includes("after updating") || text.includes("version 4.") || text.includes("reinstalled") || text.includes("fix your app") || text.includes("bad app")) {
    primaryCategory = "App performance and stability";
    productArea = "Mobile Client Application (iOS/Android)";
    painPoint = "App crashes, force-closes upon launching, or biometric fingerprint login breaks after updates";
    urgency = text.includes("crash") ? "High" : "Medium";
  } else if (text.includes("navigate") || text.includes("beneficiary") || text.includes("too many taps") || text.includes("confusing") || text.includes("cofnusing") || text.includes("dark mode") || text.includes("interface") || text.includes("split-bill") || text.includes("home screen") || text.includes("statement") || text.includes("sttaements") || text.includes("export")) {
    primaryCategory = "User experience and navigation";
    productArea = "App Navigation & Design";
    painPoint = hasNeutralKeyword ? "User requesting enhanced UI capabilities (dark mode, statement export, split-bill)" : "Confusing navigation, cluttered home screen, or difficult beneficiary recipient search";
    urgency = "Medium";
  } else if (text.includes("payroll") || text.includes("transfer") || text.includes("wire") || text.includes("mpesa") || text.includes("deposit") || text.includes("salary") || text.includes("payout") || text.includes("bill pay") || text.includes("electricity token") || text.includes("saving") || text.includes("daily payments")) {
    primaryCategory = "Payments and transfers";
    productArea = "Core Payments & Partner Bank Rails";
    painPoint = sentiment === "Positive" ? "Fast transfer execution and clean payment flow" : "Inbound deposits or outbound batch payouts delayed at partner bank switch";
    urgency = sentiment === "Positive" ? "Low" : text.includes("salary") ? "Critical" : "High";
  } else {
    primaryCategory = "User experience and navigation";
    productArea = "App Navigation & Design";
    painPoint = "General customer feedback regarding app usability and service quality";
    urgency = "Low";
  }
  let summary = record.raw_text;
  if (summary.includes("Description:")) {
    summary = summary.split("Description:")[1].trim();
  } else if (summary.includes("Subject:")) {
    summary = summary.replace(/^Subject:\s*/i, "").trim();
  } else if (summary.includes("Participant (")) {
    summary = summary.replace(/^Interviewer note:\s*/i, "").trim();
  }
  if (summary.length > 95) {
    summary = summary.substring(0, 92) + "...";
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
    confidence: "High",
    is_unclear: record.raw_text.length < 10,
    unclear_reason: record.raw_text.length < 10 ? "Comment is too short to extract detailed context" : null,
    status: "Completed",
    error_message: null,
    analyzed_at: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function analyzeFeedbackBatch(records) {
  if (records.length === 0) return [];
  if (records.length > 15) {
    const allResults = [];
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
    device: r.device
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
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
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
              unclear_reason: { type: Type.STRING, nullable: true }
            },
            required: [
              "feedback_id",
              "sentiment",
              "primary_category",
              "summary",
              "product_area",
              "customer_pain_point",
              "urgency",
              "evidence",
              "confidence",
              "is_unclear"
            ]
          }
        }
      }
    });
    const text = response.text?.trim() || "[]";
    const parsed = JSON.parse(text);
    return records.map((record) => {
      const match = parsed.find((p) => p.feedback_id === record.feedback_id);
      if (!match) {
        return fallbackAnalysis(record);
      }
      return {
        id: `ANL-${record.feedback_id}-${Date.now().toString(36)}`,
        feedback_id: record.feedback_id,
        sentiment: ["Positive", "Neutral", "Negative"].includes(match.sentiment) ? match.sentiment : "Neutral",
        primary_category: match.primary_category || "Other or unclassified",
        secondary_category: match.secondary_category || null,
        summary: match.summary || record.raw_text.substring(0, 100),
        product_area: match.product_area || "Core Banking",
        customer_pain_point: match.customer_pain_point || "General feedback",
        urgency: ["Critical", "High", "Medium", "Low"].includes(match.urgency) ? match.urgency : "Medium",
        evidence: match.evidence || record.raw_text.substring(0, 80),
        confidence: match.confidence || "High",
        is_unclear: Boolean(match.is_unclear),
        unclear_reason: match.unclear_reason || null,
        status: "Completed",
        error_message: null,
        analyzed_at: (/* @__PURE__ */ new Date()).toISOString()
      };
    });
  } catch (err) {
    console.error("Gemini batch analysis failed, using fallback engine:", err);
    return records.map(fallbackAnalysis);
  }
}
async function synthesizeRecurringIssues(recordsWithAnalysis) {
  const analyzedRecords = recordsWithAnalysis.filter(
    (r) => r.analysis && r.analysis.status === "Completed"
  );
  if (analyzedRecords.length === 0) {
    return [];
  }
  const ai = getGenAI();
  if (ai) {
    const inputPayload = analyzedRecords.map((r) => ({
      feedback_id: r.feedback_id,
      text: r.raw_text,
      category: r.analysis.primary_category,
      pain_point: r.analysis.customer_pain_point,
      product_area: r.analysis.product_area,
      sentiment: r.analysis.sentiment,
      urgency: r.analysis.urgency,
      customer_id: r.customer_id,
      device: r.device,
      app_version: r.app_version,
      country: r.country,
      channel: r.channel,
      submitted_at: r.submitted_at
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
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
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
                  items: { type: Type.STRING }
                },
                trend: { type: Type.STRING },
                confidence: { type: Type.STRING },
                representative_comments: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                }
              },
              required: [
                "title",
                "description",
                "product_area",
                "primary_category",
                "supporting_feedback_ids",
                "trend",
                "confidence",
                "representative_comments"
              ]
            }
          }
        }
      });
      const parsed = JSON.parse(response.text?.trim() || "[]");
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item, idx) => {
          const matchingRecords = analyzedRecords.filter(
            (r) => item.supporting_feedback_ids.includes(r.feedback_id)
          );
          const distinctCustomers = new Set(
            matchingRecords.map((r) => r.customer_id).filter(Boolean)
          ).size;
          const sentimentBreakdown = {
            positive: matchingRecords.filter((r) => r.analysis?.sentiment === "Positive").length,
            neutral: matchingRecords.filter((r) => r.analysis?.sentiment === "Neutral").length,
            negative: matchingRecords.filter((r) => r.analysis?.sentiment === "Negative").length
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
            segments: Array.from(new Set(matchingRecords.map((r) => r.customer_segment).filter(Boolean))),
            plan_tiers: Array.from(new Set(matchingRecords.map((r) => r.plan_tier).filter(Boolean))),
            countries: Array.from(new Set(matchingRecords.map((r) => r.country).filter(Boolean))),
            channels: Array.from(new Set(matchingRecords.map((r) => r.channel).filter(Boolean))),
            devices: Array.from(new Set(matchingRecords.map((r) => r.device).filter(Boolean))),
            app_versions: Array.from(new Set(matchingRecords.map((r) => r.app_version).filter(Boolean))),
            trend: ["increasing", "stable", "decreasing", "emerging"].includes(item.trend) ? item.trend : "increasing",
            representative_comments: item.representative_comments || [],
            confidence: ["High", "Medium", "Low"].includes(item.confidence) ? item.confidence : "High",
            created_at: (/* @__PURE__ */ new Date()).toISOString(),
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          };
        });
      }
    } catch (err) {
      console.error("Gemini issue synthesis failed, falling back to clustering heuristics:", err);
    }
  }
  const clusters = {};
  for (const r of analyzedRecords) {
    const cat = r.analysis?.primary_category || "General";
    if (!clusters[cat]) clusters[cat] = [];
    clusters[cat].push(r);
  }
  const categoryMetadata = {
    "Loan processing and disbursement": {
      title: "Approved Loan Disbursement Delays & Upfront Processing Fee Deductions",
      description: "Customers report loans marked approved in the application but funds remaining pending or not disbursed to their wallet, despite upfront loan fee deductions.",
      area: "Lending & Credit Engine"
    },
    "Disputes and chargebacks": {
      title: "Dispute Resolution Opacity & Lack of Wrong Merchant Charge Updates",
      description: "Customers report that the dispute process operates as a black box with no status updates, investigation milestones, or prompt refunds for incorrect merchant charges.",
      area: "Dispute Management & Chargeback Ops"
    },
    "Account access and authentication": {
      title: "SMS OTP Delivery Failures on Carrier Networks & KYC Verification Delays",
      description: "Critical authentication barrier where SMS verification codes fail to deliver across telecom carriers (MTN, Airtel), and KYC identity document verification takes days.",
      area: "Identity, 2FA & Onboarding"
    },
    "Failed transactions": {
      title: "Interbank Transfer Rail Failures & Unreflected Debited Balances",
      description: "Transactions where funds are debited from the customer wallet but fail to credit the recipient bank account, with balance remaining at zero for days.",
      area: "Core Payments & Partner Bank Rails"
    },
    "Refunds and reversals": {
      title: "Wallet Settlement Delays for Cancelled Orders & Merchant Reversals",
      description: "Refund funds from cancelled orders or reversed transactions take multiple days to return to customer wallet balances.",
      area: "Wallet Settlement & Reversals"
    },
    "Card Services": {
      title: "Payment Card Declines at Online Merchant Checkouts & Point of Sale",
      description: "Virtual and debit cards being rejected during online subscription checkouts (Netflix, Spotify) or POS terminals despite sufficient available funds.",
      area: "Debit & Virtual Cards"
    },
    "Customer support": {
      title: "Customer Care Hold Times, Chat Queue Timeouts & Ticket Disconnects",
      description: "Customers experience long telephone hold times, live chat timeouts, bot loops, and tickets closed without resolving the reported problem.",
      area: "Customer Care & Live Support"
    },
    "App performance and stability": {
      title: "Application Force-Closes & Biometric Fingerprint Failures Post-Update",
      description: "Mobile application stability issues including crashes on launch, freezing on PIN entry, and biometric fingerprint authentication breaking after app updates.",
      area: "Mobile Client Application (iOS/Android)"
    },
    "Fees and charges": {
      title: "Undisclosed Withdrawal Surcharges & Hidden FX Rate Markups",
      description: "Customers complain about unexpected fee deductions post-transaction without clear upfront disclosure or notification before confirmation.",
      area: "Pricing & FX Engine"
    },
    "Notifications and transaction status": {
      title: "Excessive Promotional Push Notifications & Transaction Alert Gaps",
      description: "Customers express frustration with repeated unsolicited loan offers and promotional push messages while critical transaction status alerts are delayed.",
      area: "Push Notification Service"
    },
    "User experience and navigation": {
      title: "Navigation Clutter, Complex Transfer Flows & Beneficiary Search Friction",
      description: "Usability challenges with multi-tap transfer flows, confusing redesigned home screens, and hard-to-search saved beneficiary lists.",
      area: "App Navigation & Design"
    },
    "Payments and transfers": {
      title: "Batch Staff Salary Payout & Deposit Reflection Latencies",
      description: "Batch corporate payroll payouts stuck in pending status at partner bank switches and mobile money deposit reflection delays.",
      area: "Core Payments & Partner Bank Rails"
    }
  };
  return Object.entries(clusters).map(([category, items], idx) => {
    const matchingIds = items.map((i) => i.feedback_id);
    const distinctCustomers = new Set(items.map((i) => i.customer_id).filter(Boolean)).size;
    const meta = categoryMetadata[category] || {
      title: `Recurring frictions in ${category}`,
      description: `Multiple customers reported issues regarding ${category.toLowerCase()}, affecting transfer reliability and customer trust.`,
      area: items[0]?.analysis?.product_area || "Core Product"
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
        positive: items.filter((r) => r.analysis?.sentiment === "Positive").length,
        neutral: items.filter((r) => r.analysis?.sentiment === "Neutral").length,
        negative: items.filter((r) => r.analysis?.sentiment === "Negative").length
      },
      segments: Array.from(new Set(items.map((r) => r.customer_segment).filter(Boolean))),
      plan_tiers: Array.from(new Set(items.map((r) => r.plan_tier).filter(Boolean))),
      countries: Array.from(new Set(items.map((r) => r.country).filter(Boolean))),
      channels: Array.from(new Set(items.map((r) => r.channel).filter(Boolean))),
      devices: Array.from(new Set(items.map((r) => r.device).filter(Boolean))),
      app_versions: Array.from(new Set(items.map((r) => r.app_version).filter(Boolean))),
      trend: "increasing",
      representative_comments: items.slice(0, 3).map((r) => r.raw_text),
      confidence: "High",
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
  });
}
async function generateProductRequirement(issue, supportingFeedback) {
  const ai = getGenAI();
  const fallbackReq = {
    id: `REQ-${Date.now().toString(36).toUpperCase()}`,
    issue_id: issue.id,
    title: `Resolve ${issue.title}`,
    problem_statement: issue.description,
    evidence_summary: `Backed by ${supportingFeedback.length} verified customer reports across ${issue.countries.join(", ")}. Key feedback excerpt: "${supportingFeedback[0]?.raw_text || ""}"`,
    affected_customer_groups: `${issue.segments.join(", ")} on ${issue.plan_tiers.join(", ")} tiers`,
    proposed_solution: `Implement automated validation, idempotent backend processing, and real-time status reporting for ${issue.primary_category.toLowerCase()}.`,
    user_story: `As a PayNext ${issue.segments[0] || "customer"}, I want reliable ${issue.primary_category.toLowerCase()} with instant status transparency, so that I can manage my finances without unexpected delays or held balances.`,
    acceptance_criteria: [
      `1. System must never debit user balances when an upstream gateway error occurs.`,
      `2. Transaction state transitions must reflect in user UI within 1500ms.`,
      `3. In event of failure, human-readable recovery steps must be provided to user.`,
      `4. Telemetry and alerting trigger when failure rate exceeds 0.5% in 5-minute rolling window.`
    ],
    priority: issue.feedback_count > 3 ? "Critical" : "High",
    priority_rationale: `Frequency of ${issue.feedback_count} complaints with high churn risk and financial loss implications for business users.`,
    supporting_feedback_ids: supportingFeedback.map((f) => f.feedback_id),
    review_status: "Draft",
    review_notes: null,
    reviewed_by: null,
    reviewed_at: null,
    created_at: (/* @__PURE__ */ new Date()).toISOString(),
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (!ai) {
    return fallbackReq;
  }
  const prompt = `You are a Principal Technical Product Manager at PayNext (fintech).
Generate an evidence-backed Product Requirement Specification (PRD / Feature Spec) for the following customer problem:

Issue Title: ${issue.title}
Issue Description: ${issue.description}
Product Area: ${issue.product_area}
Affected Segments: ${issue.segments.join(", ")}
Affected Plan Tiers: ${issue.plan_tiers.join(", ")}
Total Customer Reports: ${issue.feedback_count}

Supporting Customer Feedback Quotes:
${supportingFeedback.map((f) => `- [${f.feedback_id}] (${f.channel}, Rating: ${f.rating || "N/A"}): "${f.raw_text}"`).join("\n")}

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
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
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
              items: { type: Type.STRING }
            },
            priority: { type: Type.STRING },
            priority_rationale: { type: Type.STRING }
          },
          required: [
            "title",
            "problem_statement",
            "evidence_summary",
            "affected_customer_groups",
            "proposed_solution",
            "user_story",
            "acceptance_criteria",
            "priority",
            "priority_rationale"
          ]
        }
      }
    });
    const parsed = JSON.parse(response.text?.trim() || "{}");
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
      priority: ["Critical", "High", "Medium", "Low"].includes(parsed.priority) ? parsed.priority : fallbackReq.priority,
      priority_rationale: parsed.priority_rationale || fallbackReq.priority_rationale,
      supporting_feedback_ids: supportingFeedback.map((f) => f.feedback_id),
      review_status: "Draft",
      review_notes: null,
      reviewed_by: null,
      reviewed_at: null,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
  } catch (err) {
    console.error("Failed to generate product requirement with Gemini, returning standard PRD:", err);
    return fallbackReq;
  }
}

// server/routes.ts
var router = Router();
var DEFAULT_ADMIN = {
  id: "USR-ADMIN-1",
  email: "admin@paynext.com",
  name: "Sarah Jenkins",
  role: "superadmin",
  created_at: "2026-09-30T10:00:00.000Z"
};
function authMiddleware(req, res, next) {
  const token = req.headers["x-admin-token"] || req.query.token;
  const admin = token ? db.validateSession(token) : null;
  req.admin = admin || db.getAdminById("USR-ADMIN-1") || DEFAULT_ADMIN;
  next();
}
router.get("/public/form-config", (req, res) => {
  const config = db.getFormConfig();
  res.json({
    title: config.title,
    description: config.description,
    accent_color: config.accent_color,
    enable_ratings: config.enable_ratings,
    enable_nps: config.enable_nps,
    enable_device_info: config.enable_device_info,
    enable_customer_name: config.enable_customer_name,
    enable_email: config.enable_email,
    custom_privacy_note: config.custom_privacy_note
  });
});
router.post("/public/feedback", (req, res) => {
  try {
    const {
      customer_name,
      email,
      country,
      city,
      raw_text,
      rating,
      nps_score,
      device,
      os,
      app_version
    } = req.body;
    if (!raw_text || typeof raw_text !== "string" || raw_text.trim().length < 5) {
      return res.status(400).json({ error: "Customer feedback text is required (minimum 5 characters)." });
    }
    if (!country || typeof country !== "string" || !country.trim()) {
      return res.status(400).json({ error: "Country selection or entry is required." });
    }
    let parsedRating = null;
    if (rating !== void 0 && rating !== null && rating !== "") {
      const r = Number(rating);
      if (isNaN(r) || r < 1 || r > 5) {
        return res.status(400).json({ error: "Rating must be a number between 1 and 5." });
      }
      parsedRating = Math.round(r);
    }
    let parsedNps = null;
    if (nps_score !== void 0 && nps_score !== null && nps_score !== "") {
      const n = Number(nps_score);
      if (isNaN(n) || n < 0 || n > 10) {
        return res.status(400).json({ error: "Recommendation score (NPS) must be between 0 and 10." });
      }
      parsedNps = Math.round(n);
    }
    const uniqueId = `FB-WEB-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1e3)}`;
    const newRecord = {
      feedback_id: uniqueId,
      customer_name: customer_name ? String(customer_name).trim() : void 0,
      email: email ? String(email).trim() : void 0,
      country: String(country).trim(),
      city: city ? String(city).trim() : void 0,
      customer_segment: "Unspecified",
      plan_tier: "Standard",
      account_tenure_months: null,
      channel: "Web Feedback Form",
      source_reference: `WEB-${(/* @__PURE__ */ new Date()).toISOString().substring(0, 10)}`,
      submitted_at: (/* @__PURE__ */ new Date()).toISOString(),
      rating: parsedRating,
      nps_score: parsedNps,
      device: device ? String(device).trim() : void 0,
      os: os ? String(os).trim() : void 0,
      app_version: app_version ? String(app_version).trim() : void 0,
      raw_text: raw_text.trim(),
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      source: "web_form"
    };
    db.addFeedback(newRecord);
    db.incrementFormSubmissions();
    try {
      const analysis = fallbackAnalysis(newRecord);
      db.saveAnalysis(analysis);
    } catch (e) {
      console.error("Error auto-analyzing public feedback:", e);
    }
    res.json({
      success: true,
      feedback_id: uniqueId,
      message: "Feedback submitted successfully. Thank you for helping PayNext improve!"
    });
  } catch (err) {
    console.error("Error submitting feedback:", err);
    res.status(500).json({ error: "Failed to process feedback submission." });
  }
});
router.post("/auth/login", (req, res) => {
  const admin = db.getAdminById("USR-ADMIN-1") || DEFAULT_ADMIN;
  const token = db.createSession(admin.id);
  res.json({
    token,
    user: admin
  });
});
router.get("/auth/me", (req, res) => {
  const token = req.headers["x-admin-token"];
  const admin = token ? db.validateSession(token) : null;
  res.json({ user: admin || db.getAdminById("USR-ADMIN-1") || DEFAULT_ADMIN });
});
router.post("/auth/logout", (_req, res) => {
  res.json({ success: true });
});
router.get("/admin/feedback", authMiddleware, (req, res) => {
  try {
    const filters = {
      dateRange: req.query.dateRange || "all",
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      country: req.query.country,
      city: req.query.city,
      channel: req.query.channel,
      customerSegment: req.query.customerSegment,
      planTier: req.query.planTier,
      device: req.query.device,
      os: req.query.os,
      appVersion: req.query.appVersion,
      rating: req.query.rating ? Number(req.query.rating) : null,
      sentiment: req.query.sentiment,
      searchQuery: req.query.q
    };
    const allRecords = db.getAllFeedback(filters);
    const analysisMap = db.getAnalysisMap();
    const combined = allRecords.map((f) => ({
      ...f,
      analysis: analysisMap.get(f.feedback_id) || null
    }));
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(5, Math.min(100, Number(req.query.limit) || 20));
    const total = combined.length;
    const startIndex = (page - 1) * limit;
    const paginated = combined.slice(startIndex, startIndex + limit);
    res.json({
      data: paginated,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error("Error listing feedback:", err);
    res.status(500).json({ error: "Failed to retrieve feedback records." });
  }
});
router.get("/admin/feedback/:id", authMiddleware, (req, res) => {
  const feedback = db.getFeedbackById(req.params.id);
  if (!feedback) return res.status(404).json({ error: "Feedback record not found." });
  const analysis = db.getAnalysisByFeedbackId(feedback.feedback_id);
  const issues = db.getAllIssues().filter((i) => i.supporting_feedback_ids.includes(feedback.feedback_id));
  const requirements = db.getAllRequirements().filter((r) => r.supporting_feedback_ids.includes(feedback.feedback_id));
  res.json({
    feedback,
    analysis,
    linked_issues: issues,
    linked_requirements: requirements
  });
});
function validateCsvRow(row, index, existingIds) {
  const issues = [];
  const feedbackId = row.feedback_id || row.FeedbackId || row.feedbackId;
  const rawText = row.raw_text || row.feedback_text || row.comment || row.RawText;
  if (!feedbackId || !String(feedbackId).trim()) {
    issues.push({
      row: index + 1,
      field: "feedback_id",
      message: "Missing feedback_id.",
      severity: "error"
    });
  } else if (existingIds.has(String(feedbackId).trim())) {
    issues.push({
      row: index + 1,
      field: "feedback_id",
      feedback_id: String(feedbackId).trim(),
      message: `Duplicate feedback_id "${feedbackId}" detected.`,
      severity: "warning"
    });
  }
  if (!rawText || !String(rawText).trim()) {
    issues.push({
      row: index + 1,
      field: "raw_text",
      message: "Missing customer feedback text (raw_text).",
      severity: "error"
    });
  }
  const rating = row.rating || row.Rating;
  if (rating !== void 0 && rating !== null && rating !== "") {
    const r = Number(rating);
    if (isNaN(r) || r < 1 || r > 5) {
      issues.push({
        row: index + 1,
        field: "rating",
        message: `Invalid rating: "${rating}". Expected 1 to 5.`,
        severity: "warning"
      });
    }
  }
  const nps = row.nps_score || row.nps || row.NpsScore;
  if (nps !== void 0 && nps !== null && nps !== "") {
    const n = Number(nps);
    if (isNaN(n) || n < 0 || n > 10) {
      issues.push({
        row: index + 1,
        field: "nps_score",
        message: `Invalid NPS score: "${nps}". Expected 0 to 10.`,
        severity: "warning"
      });
    }
  }
  return issues;
}
router.post("/admin/import/preview", authMiddleware, (req, res) => {
  try {
    const { csvData } = req.body;
    if (!csvData) {
      return res.status(400).json({ error: "No CSV data provided." });
    }
    const parsed = Papa.parse(csvData, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false
    });
    if (parsed.errors && parsed.errors.length > 0) {
      console.warn("PapaParse preview warnings:", parsed.errors);
    }
    const headers = parsed.meta.fields || [];
    const rows = parsed.data;
    const existingFeedback = db.getAllFeedback();
    const existingIds = new Set(existingFeedback.map((f) => f.feedback_id));
    const validationIssues = [];
    const seenInCsv = /* @__PURE__ */ new Set();
    rows.forEach((row, i) => {
      const rowIssues = validateCsvRow(row, i, existingIds);
      const fId = row.feedback_id || row.FeedbackId;
      if (fId) {
        if (seenInCsv.has(fId)) {
          rowIssues.push({
            row: i + 1,
            field: "feedback_id",
            feedback_id: fId,
            message: `Duplicate feedback_id "${fId}" found inside this CSV file.`,
            severity: "error"
          });
        } else {
          seenInCsv.add(fId);
        }
      }
      validationIssues.push(...rowIssues);
    });
    const errorCount = validationIssues.filter((v) => v.severity === "error").length;
    const warningCount = validationIssues.filter((v) => v.severity === "warning").length;
    res.json({
      headers,
      totalRows: rows.length,
      sampleRows: rows.slice(0, 10),
      validationSummary: {
        errorCount,
        warningCount,
        validRowsEstimate: rows.length - errorCount,
        issues: validationIssues.slice(0, 50)
      }
    });
  } catch (err) {
    console.error("Error previewing CSV:", err);
    res.status(500).json({ error: "Failed to parse CSV preview." });
  }
});
router.post("/admin/import/process", authMiddleware, (req, res) => {
  try {
    const { csvData, mode = "append", columnMapping = {} } = req.body;
    if (!csvData) {
      return res.status(400).json({ error: "No CSV data provided for import." });
    }
    const parsed = Papa.parse(csvData, {
      header: true,
      skipEmptyLines: true
    });
    const rows = parsed.data;
    const existingFeedback = mode === "replace" ? [] : db.getAllFeedback();
    const existingIds = new Set(existingFeedback.map((f) => f.feedback_id));
    const validRecords = [];
    const validationIssues = [];
    let skippedCount = 0;
    let rejectedCount = 0;
    rows.forEach((row, idx) => {
      const getVal = (stdKey) => {
        const mapped = columnMapping[stdKey] || stdKey;
        return row[mapped] !== void 0 ? row[mapped] : row[stdKey];
      };
      const rawFid = getVal("feedback_id");
      const rawText = getVal("raw_text");
      if (!rawFid || !String(rawFid).trim() || !rawText || !String(rawText).trim()) {
        rejectedCount++;
        validationIssues.push({
          row: idx + 1,
          field: "required_fields",
          message: "Skipped row due to missing feedback_id or raw_text.",
          severity: "error"
        });
        return;
      }
      const fId = String(rawFid).trim();
      if (existingIds.has(fId)) {
        skippedCount++;
        validationIssues.push({
          row: idx + 1,
          field: "feedback_id",
          feedback_id: fId,
          message: `Skipped existing feedback_id ${fId}`,
          severity: "warning"
        });
        return;
      }
      let parsedRating = null;
      const rVal = getVal("rating");
      if (rVal !== void 0 && rVal !== null && rVal !== "") {
        const num = Number(rVal);
        if (!isNaN(num) && num >= 1 && num <= 5) parsedRating = Math.round(num);
      }
      let parsedNps = null;
      const nVal = getVal("nps_score");
      if (nVal !== void 0 && nVal !== null && nVal !== "") {
        const num = Number(nVal);
        if (!isNaN(num) && num >= 0 && num <= 10) parsedNps = Math.round(num);
      }
      let tenure = null;
      const tVal = getVal("account_tenure_months");
      if (tVal !== void 0 && tVal !== null && tVal !== "") {
        const num = Number(tVal);
        if (!isNaN(num)) tenure = Math.round(num);
      }
      const record = {
        feedback_id: fId,
        customer_id: getVal("customer_id") ? String(getVal("customer_id")).trim() : void 0,
        customer_name: getVal("customer_name") ? String(getVal("customer_name")).trim() : void 0,
        email: getVal("email") ? String(getVal("email")).trim() : void 0,
        country: getVal("country") ? String(getVal("country")).trim() : "Unknown",
        city: getVal("city") ? String(getVal("city")).trim() : void 0,
        customer_segment: getVal("customer_segment") ? String(getVal("customer_segment")).trim() : "Unspecified",
        plan_tier: getVal("plan_tier") ? String(getVal("plan_tier")).trim() : "Standard",
        account_tenure_months: tenure,
        channel: getVal("channel") ? String(getVal("channel")).trim() : "CSV Import",
        source_reference: getVal("source_reference") ? String(getVal("source_reference")).trim() : void 0,
        submitted_at: getVal("submitted_at") ? new Date(getVal("submitted_at")).toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
        rating: parsedRating,
        nps_score: parsedNps,
        device: getVal("device") ? String(getVal("device")).trim() : void 0,
        os: getVal("os") ? String(getVal("os")).trim() : void 0,
        app_version: getVal("app_version") ? String(getVal("app_version")).trim() : void 0,
        raw_text: String(rawText).trim(),
        created_at: (/* @__PURE__ */ new Date()).toISOString(),
        source: "csv"
      };
      existingIds.add(fId);
      validRecords.push(record);
    });
    const result = db.bulkImportFeedback(validRecords, mode);
    let negativeCount = 0;
    let positiveCount = 0;
    let neutralCount = 0;
    try {
      const analyses = validRecords.map((r) => fallbackAnalysis(r));
      db.bulkSaveAnalysis(analyses);
      for (const a of analyses) {
        if (a.sentiment === "Negative") negativeCount++;
        else if (a.sentiment === "Positive") positiveCount++;
        else neutralCount++;
      }
      const allFeedbackWithAnalysis = db.getAllFeedback().map((f) => ({
        ...f,
        analysis: db.getAnalysisByFeedbackId(f.feedback_id)
      }));
      synthesizeRecurringIssues(allFeedbackWithAnalysis).then((issues) => {
        db.setIssues(issues);
      }).catch((e) => console.error("Error synthesizing issues after import:", e));
    } catch (e) {
      console.error("Error auto-analyzing imported records:", e);
    }
    const job = {
      id: `JOB-${Date.now().toString(36).toUpperCase()}`,
      filename: req.body.filename || "uploaded_customer_feedback.csv",
      imported_at: (/* @__PURE__ */ new Date()).toISOString(),
      total_rows: rows.length,
      imported_count: result.imported,
      skipped_count: skippedCount + result.skipped,
      rejected_count: rejectedCount,
      validation_issues: validationIssues.slice(0, 100)
    };
    db.addImportJob(job);
    res.json({
      success: true,
      job,
      summary: {
        totalRows: rows.length,
        imported: result.imported,
        skipped: skippedCount + result.skipped,
        rejected: rejectedCount,
        replaced: result.replaced,
        negativeCount,
        positiveCount,
        neutralCount
      }
    });
  } catch (err) {
    console.error("Error importing CSV:", err);
    res.status(500).json({ error: "Failed to process CSV import." });
  }
});
router.post("/admin/import/reference-dataset", authMiddleware, (req, res) => {
  try {
    const csvPath = path2.resolve(process.cwd(), "paynest_customer_feedback.csv");
    if (!fs2.existsSync(csvPath)) {
      return res.status(404).json({ error: "Reference dataset file paynest_customer_feedback.csv not found on server." });
    }
    const csvData = fs2.readFileSync(csvPath, "utf-8");
    const parsed = Papa.parse(csvData, { header: true, skipEmptyLines: true });
    const rows = parsed.data;
    const existingFeedback = db.getAllFeedback();
    const existingIds = new Set(existingFeedback.map((f) => f.feedback_id));
    const validRecords = [];
    let skipped = 0;
    for (const r of rows) {
      if (!r.feedback_id || !r.raw_text) continue;
      const fId = String(r.feedback_id).trim();
      if (existingIds.has(fId)) {
        skipped++;
        continue;
      }
      validRecords.push({
        feedback_id: fId,
        customer_id: r.customer_id ? String(r.customer_id).trim() : void 0,
        customer_name: r.customer_name ? String(r.customer_name).trim() : void 0,
        email: r.email ? String(r.email).trim() : void 0,
        country: r.country ? String(r.country).trim() : "Nigeria",
        city: r.city ? String(r.city).trim() : void 0,
        customer_segment: r.customer_segment ? String(r.customer_segment).trim() : "Retail",
        plan_tier: r.plan_tier ? String(r.plan_tier).trim() : "Basic",
        account_tenure_months: r.account_tenure_months !== void 0 && r.account_tenure_months !== "" && !isNaN(Number(r.account_tenure_months)) ? Number(r.account_tenure_months) : null,
        channel: r.channel ? String(r.channel).trim() : "Customer Interview",
        source_reference: r.source_reference ? String(r.source_reference).trim() : void 0,
        submitted_at: r.submitted_at ? new Date(r.submitted_at).toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
        rating: r.rating !== void 0 && r.rating !== null && r.rating !== "" && !isNaN(Number(r.rating)) ? Number(r.rating) : null,
        nps_score: r.nps_score !== void 0 && r.nps_score !== null && r.nps_score !== "" && !isNaN(Number(r.nps_score)) ? Number(r.nps_score) : null,
        device: r.device ? String(r.device).trim() : void 0,
        os: r.os ? String(r.os).trim() : void 0,
        app_version: r.app_version ? String(r.app_version).trim() : void 0,
        raw_text: String(r.raw_text).trim(),
        created_at: (/* @__PURE__ */ new Date()).toISOString(),
        source: "csv"
      });
      existingIds.add(fId);
    }
    const result = db.bulkImportFeedback(validRecords, "append");
    let negativeCount = 0;
    let positiveCount = 0;
    let neutralCount = 0;
    try {
      const analyses = validRecords.map((r) => fallbackAnalysis(r));
      db.bulkSaveAnalysis(analyses);
      for (const a of analyses) {
        if (a.sentiment === "Negative") negativeCount++;
        else if (a.sentiment === "Positive") positiveCount++;
        else neutralCount++;
      }
      const allFeedbackWithAnalysis = db.getAllFeedback().map((f) => ({
        ...f,
        analysis: db.getAnalysisByFeedbackId(f.feedback_id)
      }));
      synthesizeRecurringIssues(allFeedbackWithAnalysis).then((issues) => {
        db.setIssues(issues);
      }).catch((e) => console.error("Error synthesizing issues:", e));
    } catch (e) {
      console.error("Error auto-analyzing reference dataset:", e);
    }
    const job = {
      id: `JOB-REF-${Date.now().toString(36).toUpperCase()}`,
      filename: "paynest_customer_feedback.csv (Reference Dataset)",
      imported_at: (/* @__PURE__ */ new Date()).toISOString(),
      total_rows: rows.length,
      imported_count: result.imported,
      skipped_count: skipped + result.skipped,
      rejected_count: 0,
      validation_issues: []
    };
    db.addImportJob(job);
    res.json({
      success: true,
      imported: result.imported,
      skipped: skipped + result.skipped,
      negativeCount,
      positiveCount,
      neutralCount,
      message: `Successfully loaded ${result.imported} records from reference dataset (${negativeCount} negative complaints detected).`
    });
  } catch (err) {
    console.error("Error loading reference dataset:", err);
    res.status(500).json({ error: "Failed to load reference dataset." });
  }
});
router.get("/admin/import/history", authMiddleware, (req, res) => {
  res.json({ jobs: db.getImportJobs() });
});
router.post("/admin/analysis/batch", authMiddleware, async (req, res) => {
  try {
    const { batchSize = 10, forceAll = false, feedbackIds } = req.body;
    const allFeedback = db.getAllFeedback();
    const analysisMap = db.getAnalysisMap();
    let targetRecords = [];
    if (feedbackIds && Array.isArray(feedbackIds) && feedbackIds.length > 0) {
      targetRecords = allFeedback.filter((f) => feedbackIds.includes(f.feedback_id));
    } else if (forceAll) {
      targetRecords = allFeedback;
    } else {
      targetRecords = allFeedback.filter((f) => {
        const a = analysisMap.get(f.feedback_id);
        return !a || a.status !== "Completed";
      });
    }
    if (targetRecords.length === 0) {
      return res.json({
        success: true,
        message: "No pending records to analyze.",
        analyzed_count: 0,
        remaining_count: 0
      });
    }
    const batch = targetRecords.slice(0, Math.min(Number(batchSize) || 10, 20));
    const results = await analyzeFeedbackBatch(batch);
    db.bulkSaveAnalysis(results);
    const remaining = targetRecords.length - batch.length;
    res.json({
      success: true,
      analyzed_count: results.length,
      remaining_count: Math.max(0, remaining),
      results
    });
  } catch (err) {
    console.error("Error in batch analysis:", err);
    res.status(500).json({ error: "Analysis batch failed." });
  }
});
router.post("/admin/analysis/single/:id", authMiddleware, async (req, res) => {
  try {
    const feedback = db.getFeedbackById(req.params.id);
    if (!feedback) {
      return res.status(404).json({ error: "Feedback record not found." });
    }
    const [result] = await analyzeFeedbackBatch([feedback]);
    db.saveAnalysis(result);
    res.json({ success: true, analysis: result });
  } catch (err) {
    console.error("Error analyzing single feedback:", err);
    res.status(500).json({ error: "Failed to analyze feedback item." });
  }
});
router.get("/admin/analysis/stats", authMiddleware, (req, res) => {
  const all = db.getAllFeedback();
  const analyses = db.getAllAnalysis();
  const map = db.getAnalysisMap();
  let completed = 0;
  let failed = 0;
  let pending = 0;
  for (const f of all) {
    const a = map.get(f.feedback_id);
    if (a && a.status === "Completed") completed++;
    else if (a && a.status === "Failed") failed++;
    else pending++;
  }
  res.json({
    total: all.length,
    completed,
    failed,
    pending
  });
});
router.get("/admin/insights", authMiddleware, (req, res) => {
  const issues = db.getAllIssues();
  res.json({ issues });
});
router.get("/admin/insights/:id", authMiddleware, (req, res) => {
  const issue = db.getIssueById(req.params.id);
  if (!issue) return res.status(404).json({ error: "Recurring issue not found." });
  const allFeedback = db.getAllFeedback();
  const supporting = allFeedback.filter((f) => issue.supporting_feedback_ids.includes(f.feedback_id));
  const analysisMap = db.getAnalysisMap();
  const supportingWithAnalysis = supporting.map((f) => ({
    ...f,
    analysis: analysisMap.get(f.feedback_id) || null
  }));
  res.json({
    issue,
    supporting_feedback: supportingWithAnalysis
  });
});
router.post("/admin/insights/synthesize", authMiddleware, async (req, res) => {
  try {
    const allFeedback = db.getAllFeedback();
    const analysisMap = db.getAnalysisMap();
    const withAnalysis = allFeedback.map((f) => ({
      ...f,
      analysis: analysisMap.get(f.feedback_id) || null
    }));
    const issues = await synthesizeRecurringIssues(withAnalysis);
    db.setIssues(issues);
    res.json({
      success: true,
      issues_count: issues.length,
      issues
    });
  } catch (err) {
    console.error("Error synthesizing issues:", err);
    res.status(500).json({ error: "Failed to synthesize recurring issues." });
  }
});
router.get("/admin/requirements", authMiddleware, (req, res) => {
  const requirements = db.getAllRequirements();
  res.json({ requirements });
});
router.post("/admin/requirements/generate", authMiddleware, async (req, res) => {
  try {
    const { issue_id } = req.body;
    if (!issue_id) return res.status(400).json({ error: "issue_id is required." });
    const issue = db.getIssueById(issue_id);
    if (!issue) return res.status(404).json({ error: "Recurring issue not found." });
    const allFeedback = db.getAllFeedback();
    const supporting = allFeedback.filter((f) => issue.supporting_feedback_ids.includes(f.feedback_id));
    const requirement = await generateProductRequirement(issue, supporting);
    db.saveRequirement(requirement);
    res.json({ success: true, requirement });
  } catch (err) {
    console.error("Error generating requirement:", err);
    res.status(500).json({ error: "Failed to generate product requirement." });
  }
});
router.post("/admin/requirements", authMiddleware, (req, res) => {
  try {
    const {
      title,
      problem_statement,
      evidence_summary,
      affected_customer_groups,
      proposed_solution,
      user_story,
      acceptance_criteria,
      priority,
      priority_rationale,
      supporting_feedback_ids = [],
      issue_id
    } = req.body;
    if (!title || !problem_statement || !user_story) {
      return res.status(400).json({ error: "Title, problem statement, and user story are required." });
    }
    const newReq = db.saveRequirement({
      id: `REQ-${Date.now().toString(36).toUpperCase()}`,
      issue_id: issue_id || null,
      title: String(title).trim(),
      problem_statement: String(problem_statement).trim(),
      evidence_summary: String(evidence_summary || "").trim(),
      affected_customer_groups: String(affected_customer_groups || "All Users").trim(),
      proposed_solution: String(proposed_solution || "").trim(),
      user_story: String(user_story).trim(),
      acceptance_criteria: Array.isArray(acceptance_criteria) ? acceptance_criteria : [String(acceptance_criteria)],
      priority: priority || "Medium",
      priority_rationale: String(priority_rationale || "").trim(),
      supporting_feedback_ids: Array.isArray(supporting_feedback_ids) ? supporting_feedback_ids : [],
      review_status: "Draft",
      review_notes: null,
      reviewed_by: null,
      reviewed_at: null,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    });
    res.json({ success: true, requirement: newReq });
  } catch (err) {
    res.status(500).json({ error: "Failed to create requirement." });
  }
});
router.put("/admin/requirements/:id", authMiddleware, (req, res) => {
  const existing = db.getRequirementById(req.params.id);
  if (!existing) return res.status(404).json({ error: "Requirement not found." });
  const updated = db.saveRequirement({
    ...existing,
    ...req.body,
    id: existing.id,
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  });
  res.json({ success: true, requirement: updated });
});
router.patch("/admin/requirements/:id/review", authMiddleware, (req, res) => {
  const { status, review_notes } = req.body;
  if (!status) return res.status(400).json({ error: "status is required." });
  const adminName = req.admin?.name || "Admin";
  const updated = db.updateRequirementStatus(req.params.id, status, review_notes, adminName);
  if (!updated) return res.status(404).json({ error: "Requirement not found." });
  res.json({ success: true, requirement: updated });
});
router.get("/admin/requirements/export", authMiddleware, (req, res) => {
  const reqs = db.getAllRequirements();
  const format = req.query.format === "excel" ? "csv" : "csv";
  const rows = reqs.map((r) => ({
    id: r.id,
    title: r.title,
    priority: r.priority,
    status: r.review_status,
    problem_statement: r.problem_statement,
    user_story: r.user_story,
    acceptance_criteria: r.acceptance_criteria.join(" | "),
    affected_groups: r.affected_customer_groups,
    evidence_summary: r.evidence_summary,
    priority_rationale: r.priority_rationale,
    supporting_feedback_count: r.supporting_feedback_ids.length,
    reviewed_by: r.reviewed_by || "",
    reviewed_at: r.reviewed_at || "",
    created_at: r.created_at
  }));
  const csv = Papa.unparse(rows);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="paynext_product_requirements.csv"');
  res.send(csv);
});
router.get("/admin/dashboard/metrics", authMiddleware, (req, res) => {
  try {
    const filters = {
      dateRange: req.query.dateRange || "all",
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      country: req.query.country,
      city: req.query.city,
      channel: req.query.channel,
      customerSegment: req.query.customerSegment,
      planTier: req.query.planTier,
      device: req.query.device,
      os: req.query.os,
      appVersion: req.query.appVersion,
      rating: req.query.rating ? Number(req.query.rating) : null,
      sentiment: req.query.sentiment
    };
    const metrics = db.getDashboardMetrics(filters);
    res.json(metrics);
  } catch (err) {
    console.error("Error calculating dashboard metrics:", err);
    res.status(500).json({ error: "Failed to compute dashboard metrics." });
  }
});
router.get("/admin/dashboard/charts", authMiddleware, (req, res) => {
  try {
    const filters = {
      dateRange: req.query.dateRange || "all",
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      country: req.query.country,
      city: req.query.city,
      channel: req.query.channel,
      customerSegment: req.query.customerSegment,
      planTier: req.query.planTier,
      device: req.query.device,
      os: req.query.os,
      appVersion: req.query.appVersion,
      rating: req.query.rating ? Number(req.query.rating) : null,
      sentiment: req.query.sentiment
    };
    const charts = db.getDashboardCharts(filters);
    res.json(charts);
  } catch (err) {
    console.error("Error fetching dashboard charts:", err);
    res.status(500).json({ error: "Failed to compute dashboard charts." });
  }
});
router.get("/admin/form-config", authMiddleware, (req, res) => {
  res.json({ config: db.getFormConfig() });
});
router.put("/admin/form-config", authMiddleware, (req, res) => {
  const updated = db.updateFormConfig(req.body);
  res.json({ success: true, config: updated });
});
router.post("/admin/reports/generate", authMiddleware, (req, res) => {
  try {
    const { filters = {}, includeApprovedReqs = true, redactPII = true } = req.body;
    const feedback = db.getAllFeedback(filters);
    const analysisMap = db.getAnalysisMap();
    const metrics = db.getDashboardMetrics(filters);
    const charts = db.getDashboardCharts(filters);
    const issues = db.getAllIssues();
    const requirements = includeApprovedReqs ? db.getAllRequirements().filter((r) => r.review_status === "Approved") : db.getAllRequirements();
    const report = {
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      reportTitle: "PayNext Customer Feedback Intelligence Report",
      metrics,
      charts,
      topRecurringProblems: issues.slice(0, 5),
      approvedRequirements: requirements,
      sampleRepresentativeComments: feedback.slice(0, 8).map((f) => ({
        feedback_id: f.feedback_id,
        channel: f.channel,
        country: f.country,
        rating: f.rating,
        raw_text: f.raw_text,
        customer_name: redactPII ? "Redacted" : f.customer_name,
        email: redactPII ? "Redacted" : f.email,
        sentiment: analysisMap.get(f.feedback_id)?.sentiment || "Unanalyzed",
        category: analysisMap.get(f.feedback_id)?.primary_category || "Unclassified"
      }))
    };
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: "Failed to generate report." });
  }
});
router.get("/admin/reports/export-csv", authMiddleware, (req, res) => {
  const feedback = db.getAllFeedback();
  const analysisMap = db.getAnalysisMap();
  const redactPII = req.query.redactPII !== "false";
  const rows = feedback.map((f) => {
    const a = analysisMap.get(f.feedback_id);
    return {
      feedback_id: f.feedback_id,
      customer_id: redactPII ? "REDACTED" : f.customer_id || "",
      customer_name: redactPII ? "REDACTED" : f.customer_name || "",
      email: redactPII ? "REDACTED" : f.email || "",
      country: f.country,
      city: f.city || "",
      channel: f.channel,
      customer_segment: f.customer_segment || "",
      plan_tier: f.plan_tier || "",
      rating: f.rating ?? "",
      nps_score: f.nps_score ?? "",
      submitted_at: f.submitted_at,
      device: f.device || "",
      os: f.os || "",
      app_version: f.app_version || "",
      raw_text: f.raw_text,
      ai_sentiment: a?.sentiment || "Pending",
      ai_category: a?.primary_category || "",
      ai_summary: a?.summary || "",
      ai_urgency: a?.urgency || "",
      ai_confidence: a?.confidence || ""
    };
  });
  const csv = Papa.unparse(rows);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="paynext_customer_feedback_export.csv"');
  res.send(csv);
});
router.get("/admin/settings/backup", authMiddleware, (req, res) => {
  const backup = db.exportData();
  backup.adminUsers = backup.adminUsers.map((u) => ({
    ...u,
    passwordHash: "REDACTED",
    salt: "REDACTED"
  }));
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", 'attachment; filename="paynext_database_backup.json"');
  res.send(JSON.stringify(backup, null, 2));
});
router.post("/admin/settings/reset", authMiddleware, (req, res) => {
  const { confirmation } = req.body;
  if (confirmation !== "RESET_PAYNEXT_DATA") {
    return res.status(400).json({ error: "Invalid confirmation phrase. Please type RESET_PAYNEXT_DATA." });
  }
  db.resetAll();
  res.json({ success: true, message: "All feedback, analysis, issues, and requirements have been cleared." });
});

// server.ts
import Papa2 from "papaparse";
dotenv.config();
var app = express2();
var PORT = Number(process.env.PORT) || 3e3;
var isProd = process.env.NODE_ENV === "production";
app.use(express2.json({ limit: "25mb" }));
app.use(express2.urlencoded({ extended: true, limit: "25mb" }));
app.use("/api", router);
function seedInitialDataIfEmpty() {
  const existing = db.getAllFeedback();
  const hasNewSchema = existing.some((f) => f.feedback_id === "FB-00275" || f.feedback_id === "FB-00533");
  if (existing.length === 0 || !hasNewSchema) {
    const csvPath = path3.resolve(process.cwd(), "paynest_customer_feedback.csv");
    if (fs3.existsSync(csvPath)) {
      try {
        const raw = fs3.readFileSync(csvPath, "utf-8");
        const parsed = Papa2.parse(raw, { header: true, skipEmptyLines: true });
        const rows = parsed.data;
        const records = [];
        for (const r of rows) {
          if (!r.feedback_id || !r.raw_text) continue;
          records.push({
            feedback_id: String(r.feedback_id).trim(),
            customer_id: r.customer_id ? String(r.customer_id).trim() : void 0,
            customer_name: r.customer_name ? String(r.customer_name).trim() : void 0,
            email: r.email ? String(r.email).trim() : void 0,
            country: r.country ? String(r.country).trim() : "Nigeria",
            city: r.city ? String(r.city).trim() : void 0,
            customer_segment: r.customer_segment ? String(r.customer_segment).trim() : "Retail",
            plan_tier: r.plan_tier ? String(r.plan_tier).trim() : "Basic",
            account_tenure_months: r.account_tenure_months !== void 0 && r.account_tenure_months !== "" && !isNaN(Number(r.account_tenure_months)) ? Number(r.account_tenure_months) : null,
            channel: r.channel ? String(r.channel).trim() : "Customer Interview",
            source_reference: r.source_reference ? String(r.source_reference).trim() : void 0,
            submitted_at: r.submitted_at ? new Date(r.submitted_at).toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
            rating: r.rating !== void 0 && r.rating !== null && r.rating !== "" && !isNaN(Number(r.rating)) ? Number(r.rating) : null,
            nps_score: r.nps_score !== void 0 && r.nps_score !== null && r.nps_score !== "" && !isNaN(Number(r.nps_score)) ? Number(r.nps_score) : null,
            device: r.device ? String(r.device).trim() : void 0,
            os: r.os ? String(r.os).trim() : void 0,
            app_version: r.app_version ? String(r.app_version).trim() : void 0,
            raw_text: String(r.raw_text).trim(),
            created_at: (/* @__PURE__ */ new Date()).toISOString(),
            source: "csv"
          });
        }
        db.bulkImportFeedback(records, "append");
        console.log(`[PayNext] Seeded ${records.length} initial reference feedback records from paynest_customer_feedback.csv`);
      } catch (err) {
        console.error("[PayNext] Failed to auto-seed reference CSV:", err);
      }
    }
  }
  ensureAllRecordsAnalyzed();
}
function ensureAllRecordsAnalyzed() {
  const all = db.getAllFeedback();
  console.log(`[PayNext] Running enhanced sentiment detection & categorization across ${all.length} records...`);
  const analyses = all.map((r) => fallbackAnalysis(r));
  db.bulkSaveAnalysis(analyses);
  const withAnalysis = all.map((r) => ({
    ...r,
    analysis: db.getAnalysisByFeedbackId(r.feedback_id)
  }));
  synthesizeRecurringIssues(withAnalysis).then((issues) => {
    db.setIssues(issues);
    console.log(`[PayNext] Successfully synthesized ${issues.length} recurring issues`);
  }).catch((err) => console.error(err));
}
seedInitialDataIfEmpty();
async function startServer() {
  if (isProd) {
    const distPath = path3.resolve(process.cwd(), "dist");
    app.use(express2.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path3.resolve(distPath, "index.html"));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[PayNext] Server running on http://0.0.0.0:${PORT}`);
  });
}
startServer().catch((err) => {
  console.error("Fatal server startup error:", err);
});
