/* ===================================================================
   AI Resume Analyzer — a rule-based resume checker with optional
   real AI suggestions via the Claude API.
=================================================================== */

const STRONG_VERBS = [
  "achieved","accelerated","architected","automated","built","championed",
  "coordinated","created","cut","decreased","delivered","deployed","designed",
  "developed","directed","drove","engineered","established","executed",
  "expanded","generated","grew","implemented","improved","increased",
  "initiated","launched","led","managed","mentored","negotiated","optimized",
  "orchestrated","organized","overhauled","pioneered","produced","reduced",
  "redesigned","resolved","restructured","saved","scaled","secured","shipped",
  "spearheaded","streamlined","strengthened","transformed","upgraded","won"
];

const WEAK_PHRASES = [
  "responsible for","worked on","helped with","duties included",
  "in charge of","tasked with","assisted with","involved in",
  "was responsible","participated in","exposure to","familiar with"
];

const SECTION_PATTERNS = [
  { key: "summary",   label: "Summary / Objective", re: /\b(summary|objective|profile)\b/i },
  { key: "experience",label: "Work Experience",     re: /\b(experience|employment history|work history)\b/i },
  { key: "education", label: "Education",           re: /\beducation\b/i },
  { key: "skills",    label: "Skills",               re: /\b(skills|technical skills|core competencies)\b/i },
  { key: "projects",  label: "Projects",             re: /\bprojects?\b/i },
  { key: "certs",     label: "Certifications",       re: /\b(certifications?|licenses?)\b/i },
];

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}/;
const PHONE_RE = /(\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;
const LINKEDIN_RE = /linkedin\.com\/[a-zA-Z0-9\-_/]+/i;
const NUMBER_RE = /\$\d[\d,]*\.?\d*[kKmMbB]?|\d+\.?\d*\s?%|\b\d{1,3}(?:,\d{3})+\b|\b\d+\+\b/g;
const BULLET_LINE_RE = /^[\s]*([-•*▪◦]|\d+[.)])\s+/;

// ---------- helpers ----------
const $ = (id) => document.getElementById(id);
const escapeHtml = (s) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const escapeReg = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function wordCount(text){
  return (text.trim().match(/\b[\w'-]+\b/g) || []).length;
}

// ---------- analysis ----------
function analyze(resumeText){
  const lower = resumeText.toLowerCase();
  const lines = resumeText.split("\n");

  // Contact info
  const hasEmail = EMAIL_RE.test(resumeText);
  const hasPhone = PHONE_RE.test(resumeText);
  const hasLinkedin = LINKEDIN_RE.test(resumeText);
  const contactScore = (hasEmail?1:0)*0.5 + (hasPhone?1:0)*0.35 + (hasLinkedin?1:0)*0.15;

  // Sections
  const sectionsFound = SECTION_PATTERNS.filter(s => s.re.test(resumeText));
  const coreSections = ["experience","education","skills"];
  const coreFound = SECTION_PATTERNS.filter(s => coreSections.includes(s.key) && s.re.test(resumeText));
  const sectionScore = (coreFound.length / coreSections.length) * 0.75
                      + (Math.min(sectionsFound.length,6)/6) * 0.25;

  // Strong verbs vs weak phrases
  let strongCount = 0;
  for (const v of STRONG_VERBS){
    const re = new RegExp("\\b"+v+"\\b","gi");
    const m = lower.match(re);
    if (m) strongCount += m.length;
  }
  let weakCount = 0;
  for (const p of WEAK_PHRASES){
    const re = new RegExp(escapeReg(p),"gi");
    const m = lower.match(re);
    if (m) weakCount += m.length;
  }
  const verbRatio = strongCount + weakCount === 0 ? 0 : strongCount / (strongCount + weakCount);
  const verbScore = Math.min(1, (strongCount>=5?0.6:strongCount/5*0.6) + verbRatio*0.4);

  // Quantified achievements
  const numberMatches = resumeText.match(NUMBER_RE) || [];
  const quantScore = Math.min(1, numberMatches.length / 6);

  // Bullet formatting
  const nonEmptyLines = lines.filter(l => l.trim().length > 0);
  const bulletLines = nonEmptyLines.filter(l => BULLET_LINE_RE.test(l));
  const bulletRatio = nonEmptyLines.length ? bulletLines.length / nonEmptyLines.length : 0;
  const bulletScore = Math.min(1, bulletRatio / 0.35);

  // Word count / length
  const wc = wordCount(resumeText);
  let lengthScore;
  if (wc === 0) lengthScore = 0;
  else if (wc < 150) lengthScore = wc / 150 * 0.5;
  else if (wc <= 850) lengthScore = 1;
  else lengthScore = Math.max(0.4, 1 - (wc-850)/1200);

  // ---- weighted overall score ----
  const categories = [
    { key:"contact",  weight:15, frac: contactScore },
    { key:"sections", weight:20, frac: sectionScore },
    { key:"verbs",    weight:25, frac: verbScore },
    { key:"quant",    weight:20, frac: quantScore },
    { key:"bullets",  weight:10, frac: bulletScore },
    { key:"length",   weight:10, frac: lengthScore },
  ];

  const totalWeight = categories.reduce((s,c)=>s+c.weight,0);
  const earned = categories.reduce((s,c)=>s + c.weight*c.frac, 0);
  const overall = Math.round((earned/totalWeight)*100);

  return {
    overall, hasEmail, hasPhone, hasLinkedin,
    sectionsFound, coreFound,
    strongCount, weakCount, verbRatio,
    numberCount: numberMatches.length,
    bulletRatio, wc
  };
}

// ---------- rendering ----------
function markUp(resumeText){
  let escaped = escapeHtml(resumeText);
  const weakAlt = WEAK_PHRASES.map(p => escapeReg(p)).sort((a,b)=>b.length-a.length).join("|");
  const verbAlt = STRONG_VERBS.map(v => "\\b"+v+"\\b").join("|");
  const combined = new RegExp(`(${weakAlt})|(${verbAlt})|(${NUMBER_RE.source})`, "gi");

  return escaped.replace(combined, (match, weak, verb) => {
    if (weak) return `<span class="mark-weak">${match}</span>`;
    if (verb) return `<span class="mark-strong">${match}</span>`;
    return `<span class="mark-num">${match}</span>`;
  });
}

const STATUS_LABEL = { pass: "Good", warn: "Needs work", fail: "Missing" };

function addLedgerRow(container, title, status, description){
  const row = document.createElement("div");
  row.className = `ledger-row ledger-row--${status}`;
  row.innerHTML = `
    <div class="ledger-row__top">
      <span class="ledger-row__title">${title}</span>
      <span class="ledger-row__badge ${status}">${STATUS_LABEL[status]}</span>
    </div>
    <p class="ledger-row__desc">${description}</p>
  `;
  container.appendChild(row);
}

function addNote(container, tone, icon, title, body){
  const el = document.createElement("div");
  el.className = `note note--${tone}`;
  el.innerHTML = `
    <div class="note__icon">${icon}</div>
    <div class="note__body"><b>${title}</b><span>${body}</span></div>
  `;
  container.appendChild(el);
}

function renderResults(r, resumeText){
  // Score dial
  const circumference = 327;
  const offset = circumference * (1 - r.overall/100);
  const arc = $("scoreArc");
  arc.style.strokeDashoffset = offset;
  arc.style.stroke = r.overall >= 75 ? "var(--good)" : r.overall >= 50 ? "var(--warn)" : "var(--bad)";
  $("scoreNum").textContent = r.overall;

  const verdictText = r.overall >= 85 ? "Excellent resume!" :
                       r.overall >= 70 ? "Good, minor tweaks needed" :
                       r.overall >= 50 ? "Needs some work" : "Needs a major rewrite";
  $("scoreVerdict").textContent = verdictText;
  $("scoreSub").textContent = `${r.strongCount} strong verb${r.strongCount!==1?'s':''} · ${r.numberCount} quantified result${r.numberCount!==1?'s':''} · ${r.wc} words`;

  // Ledger — each row explains WHAT was checked, WHAT was found, and WHY it matters
  const ledger = $("ledger");
  ledger.innerHTML = "";

  // 1. Contact details
  {
    const found = [r.hasEmail&&"email", r.hasPhone&&"phone", r.hasLinkedin&&"LinkedIn"].filter(Boolean);
    const missing = [!r.hasEmail&&"email", !r.hasPhone&&"phone number"].filter(Boolean);
    const status = r.hasEmail && r.hasPhone ? "pass" : (r.hasEmail || r.hasPhone) ? "warn" : "fail";
    const desc = status === "pass"
      ? `Found: ${found.join(", ")}. A recruiter can reach you easily.`
      : `Found: ${found.join(", ") || "nothing"}. Missing: ${missing.join(" and ")}. Add this near the top of your resume so recruiters can contact you.`;
    addLedgerRow(ledger, "Contact Details", status, desc);
  }

  // 2. Core sections
  {
    const found = r.coreFound.map(s=>s.label);
    const missing = ["experience","education","skills"]
      .filter(k => !r.coreFound.some(s=>s.key===k))
      .map(k => k[0].toUpperCase()+k.slice(1));
    const status = r.coreFound.length===3 ? "pass" : r.coreFound.length>=1 ? "warn" : "fail";
    const desc = status === "pass"
      ? `Found all three key sections: ${found.join(", ")}.`
      : `Found: ${found.join(", ") || "none"}. Missing: ${missing.join(", ")}. Add clear headings for these so both recruiters and ATS software can find them.`;
    addLedgerRow(ledger, "Resume Sections", status, desc);
  }

  // 3. Action-verb strength
  {
    const status = r.verbRatio>=0.75 && r.strongCount>=5 ? "pass" : r.strongCount>0 ? "warn" : "fail";
    const desc = status === "pass"
      ? `Found ${r.strongCount} strong action verbs (like "led", "built", "improved") and only ${r.weakCount} weak phrase${r.weakCount!==1?'s':''}. Your bullets sound confident and active.`
      : r.strongCount > 0
        ? `Found ${r.strongCount} strong verb${r.strongCount!==1?'s':''} but also ${r.weakCount} weak phrase${r.weakCount!==1?'s':''} (like "responsible for" or "helped with"). Replace weak phrases with strong action verbs to sound more confident.`
        : `No strong action verbs detected. Start your bullet points with words like "Led", "Built", "Increased", or "Reduced" instead of passive phrases.`;
    addLedgerRow(ledger, "Action Verbs", status, desc);
  }

  // 4. Quantified impact
  {
    const status = r.numberCount>=5 ? "pass" : r.numberCount>=2 ? "warn" : "fail";
    const desc = status === "pass"
      ? `Found ${r.numberCount} numbers or metrics (like percentages, dollar amounts, or team sizes). Numbers make your achievements concrete and easy to believe.`
      : r.numberCount > 0
        ? `Only found ${r.numberCount} number${r.numberCount!==1?'s':''}. Try adding more measurable results — e.g. "increased sales by 20%" or "led a team of 5".`
        : `No numbers or measurable results found. Add specific numbers to your bullet points — percentages, amounts, team sizes, or time saved — to prove your impact.`;
    addLedgerRow(ledger, "Measurable Results", status, desc);
  }

  // 5. Bullet formatting
  {
    const pct = Math.round(r.bulletRatio*100);
    const status = r.bulletRatio>=0.3 ? "pass" : r.bulletRatio>=0.1 ? "warn" : "fail";
    const desc = status === "pass"
      ? `${pct}% of your lines use bullet points. This makes your resume easy to scan quickly.`
      : `Only ${pct}% of your lines use bullet points. Recruiters scan resumes in seconds — break your experience into short bullet points (starting with "-" or "•") instead of paragraphs.`;
    addLedgerRow(ledger, "Formatting", status, desc);
  }

  // 6. Length
  {
    const status = r.wc>=350 && r.wc<=850 ? "pass" : r.wc>=150 ? "warn" : "fail";
    const desc = status === "pass"
      ? `Your resume is ${r.wc} words — a good length, roughly one page.`
      : r.wc < 350
        ? `Your resume is only ${r.wc} words, which may look too short or empty. Try to add more detail about your experience, projects, or skills (aim for 350–850 words).`
        : `Your resume is ${r.wc} words, which is quite long and may spread past one page. Try trimming it down to the most relevant points (aim for 350–850 words).`;
    addLedgerRow(ledger, "Resume Length", status, desc);
  }

  // Marked-up copy
  $("markedCopy").innerHTML = markUp(resumeText) || "<em>Nothing to mark yet.</em>";

  // Notes
  const notes = $("notesList");
  notes.innerHTML = "";

  if (!r.hasEmail || !r.hasPhone){
    addNote(notes, "bad", "✗", "Missing contact info",
      "A recruiter should be able to reach you in five seconds. Add a working email and phone number near the top.");
  }
  if (r.coreFound.length < 3){
    const missing = ["experience","education","skills"].filter(k => !r.coreFound.some(s=>s.key===k));
    addNote(notes, "warn", "!", "Section headers not detected",
      `Couldn't confidently find: ${missing.join(", ")}. Use clear, standard headings like "Experience" and "Education".`);
  }
  if (r.weakCount > 0 && r.verbRatio < 0.7){
    addNote(notes, "warn", "!", "Weak phrasing detected",
      `Lines with phrases like "responsible for" or "helped with" read as passive. Rewrite bullets to open with a strong verb — try Achieved, Led, Built, or Reduced instead.`);
  }
  if (r.numberCount < 3){
    addNote(notes, "warn", "!", "Light on numbers",
      "Bullets with a number, percentage, or dollar figure are far more convincing than descriptions alone. Try quantifying scope, scale, or result — team size, % improvement, revenue, time saved.");
  } else {
    addNote(notes, "good", "✓", "Good use of metrics",
      `Found ${r.numberCount} quantified results — this is what makes impact concrete to a reviewer.`);
  }
  if (r.bulletRatio < 0.2){
    addNote(notes, "warn", "!", "Consider bullet points",
      "Dense paragraphs are harder to scan in the 6–10 seconds a recruiter typically spends. Break experience into short, bulleted lines.");
  }
  if (r.wc > 900){
    addNote(notes, "warn", "!", "Resume may be running long",
      `At ${r.wc} words this likely spans 2+ pages. Unless you're very senior, aim for roughly 400–700 words.`);
  }
  if (r.overall >= 85){
    addNote(notes, "good", "✓", "This is in good shape",
      "Give it one more human read-through for typos, then it's ready to send.");
  }
}

// ---------- optional AI-powered suggestions (Claude API) ----------
// This calls the Anthropic API DIRECTLY from the browser using the
// "anthropic-dangerous-direct-browser-access" header. That's fine for a
// personal/demo project where you paste in your own key, but it exposes
// the key to anyone using the page — never ship this pattern to the public
// internet with a real key. A production app would proxy this through a
// small backend server instead.
async function getAiSuggestions(resumeText, ruleBasedSummary, apiKey){
  const prompt = `You are a career coach reviewing a resume. Here is a rule-based
checklist that was already run on it:

${ruleBasedSummary}

Here is the resume text:
"""
${resumeText}
"""

In 4-6 short bullet points, give specific, encouraging, and actionable advice
to improve this resume. Focus on things the checklist can't catch — clarity,
impact, relevance, and wording. Do not repeat the checklist items verbatim.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!response.ok){
    const errBody = await response.json().catch(()=>({}));
    throw new Error(errBody?.error?.message || `Request failed (${response.status})`);
  }
  const data = await response.json();
  const textBlock = data.content.find(b => b.type === "text");
  return textBlock ? textBlock.text : "No suggestions returned.";
}

function buildRuleBasedSummary(r){
  return [
    `Contact info: ${r.hasEmail?"email found":"no email"}, ${r.hasPhone?"phone found":"no phone"}`,
    `Sections found: ${r.coreFound.map(s=>s.label).join(", ") || "none"}`,
    `Strong verbs: ${r.strongCount}, weak phrases: ${r.weakCount}`,
    `Quantified results: ${r.numberCount}`,
    `Bullet usage: ${Math.round(r.bulletRatio*100)}%`,
    `Word count: ${r.wc}`,
    `Overall score: ${r.overall}/100`
  ].join("\n");
}

// ---------- wiring ----------
document.addEventListener("DOMContentLoaded", () => {
  const inputScreen = $("inputScreen");
  const resultsScreen = $("resultsScreen");

  $("uploadBtn").addEventListener("click", () => $("fileInput").click());
  $("fileInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { $("resumeInput").value = ev.target.result; };
    reader.readAsText(file);
  });

  // Show/hide the API key box when the AI toggle is flipped
  $("aiToggle").addEventListener("change", (e) => {
    $("aiKeyBox").hidden = !e.target.checked;
  });

  // "Back to edit" returns to screen 1 without losing what was typed
  $("backBtn").addEventListener("click", () => {
    resultsScreen.hidden = true;
    inputScreen.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  $("analyzeBtn").addEventListener("click", async () => {
    const resumeText = $("resumeInput").value;
    if (!resumeText.trim()){
      $("resumeInput").focus();
      $("resumeInput").style.outline = "2px solid var(--bad)";
      setTimeout(()=>{ $("resumeInput").style.outline = ""; }, 1200);
      return;
    }

    // Run the instant, rule-based analysis first
    const result = analyze(resumeText);
    renderResults(result, resumeText);

    // Switch from screen 1 to screen 2
    inputScreen.hidden = true;
    resultsScreen.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });

    // If the user opted into AI suggestions, fetch them asynchronously
    const wantsAi = $("aiToggle").checked;
    const apiKey = $("apiKeyInput").value.trim();
    const aiBlock = $("aiBlock");
    const aiBody = $("aiBody");

    if (wantsAi && apiKey){
      aiBlock.hidden = false;
      aiBody.innerHTML = `<div class="ai-loading" id="aiLoading"><span class="spinner"></span> Asking Claude for personalized feedback...</div>`;
      try {
        const summary = buildRuleBasedSummary(result);
        const suggestions = await getAiSuggestions(resumeText, summary, apiKey);
        aiBody.textContent = suggestions;
      } catch (err){
        aiBody.innerHTML = `<span class="ai-error">Couldn't get AI suggestions: ${err.message}. Double-check your API key and try again.</span>`;
      }
    } else {
      aiBlock.hidden = true;
    }
  });
});
