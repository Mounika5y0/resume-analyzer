/* ===================================================================
   AI Resume Analyzer — a rule-based resume checker.
   No external AI calls: everything below is pattern-matching,
   dictionaries, and heuristics, run entirely client-side.
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

  const hasEmail = EMAIL_RE.test(resumeText);
  const hasPhone = PHONE_RE.test(resumeText);
  const hasLinkedin = LINKEDIN_RE.test(resumeText);
  const contactScore = (hasEmail?1:0)*0.5 + (hasPhone?1:0)*0.35 + (hasLinkedin?1:0)*0.15;

  const sectionsFound = SECTION_PATTERNS.filter(s => s.re.test(resumeText));
  const coreSections = ["experience","education","skills"];
  const coreFound = SECTION_PATTERNS.filter(s => coreSections.includes(s.key) && s.re.test(resumeText));
  const sectionScore = (coreFound.length / coreSections.length) * 0.75
                      + (Math.min(sectionsFound.length,6)/6) * 0.25;

  let strongCount = 0;
  for (const v of STRONG_VERBS){
    const re = new RegExp("\\b"+v+"\\b","gi");
    const m = lower.match(re);
    if (m) strongCount += m.length;
  }
  let weakCount = 0;
  let firstWeakPhrase = null;
  for (const p of WEAK_PHRASES){
    const re = new RegExp(escapeReg(p),"gi");
    const m = lower.match(re);
    if (m){
      weakCount += m.length;
      if (!firstWeakPhrase) firstWeakPhrase = p;
    }
  }
  const verbRatio = strongCount + weakCount === 0 ? 0 : strongCount / (strongCount + weakCount);
  const verbScore = Math.min(1, (strongCount>=5?0.6:strongCount/5*0.6) + verbRatio*0.4);

  const numberMatches = resumeText.match(NUMBER_RE) || [];
  const quantScore = Math.min(1, numberMatches.length / 6);

  const nonEmptyLines = lines.filter(l => l.trim().length > 0);
  const bulletLines = nonEmptyLines.filter(l => BULLET_LINE_RE.test(l));
  const bulletRatio = nonEmptyLines.length ? bulletLines.length / nonEmptyLines.length : 0;
  const bulletScore = Math.min(1, bulletRatio / 0.35);

  const wc = wordCount(resumeText);
  let lengthScore;
  if (wc === 0) lengthScore = 0;
  else if (wc < 150) lengthScore = wc / 150 * 0.5;
  else if (wc <= 850) lengthScore = 1;
  else lengthScore = Math.max(0.4, 1 - (wc-850)/1200);

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
    strongCount, weakCount, verbRatio, firstWeakPhrase,
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

// hint is an optional HTML string rendered as a dashed "how to fix it" box
function addLedgerRow(container, title, status, description, hint){
  const row = document.createElement("div");
  row.className = `ledger-row ledger-row--${status}`;
  row.innerHTML = `
    <div class="ledger-row__top">
      <span class="ledger-row__title">${title}</span>
      <span class="ledger-row__badge ${status}">${STATUS_LABEL[status]}</span>
    </div>
    <p class="ledger-row__desc">${description}</p>
    ${hint ? `<div class="ledger-row__hint"><span class="ledger-row__hint-label">How to fix it</span>${hint}</div>` : ""}
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

// small helper to render a before -> after example inside a hint box
function exampleRewrite(before, after){
  return `<span class="example-line before">✗ ${before}</span>
          <span class="arrow">↓ rewrite as</span>
          <span class="example-line after">✓ ${after}</span>`;
}

function renderResults(r, resumeText){
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
    const hint = status !== "pass"
      ? `<span class="example-line">Put one line under your name, e.g.:</span>
         <code>Jordan Lee &nbsp;|&nbsp; jordan.lee@email.com &nbsp;|&nbsp; (555) 123-4567 &nbsp;|&nbsp; linkedin.com/in/jordanlee</code>`
      : null;
    addLedgerRow(ledger, "Contact Details", status, desc, hint);
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
    const hint = status !== "pass"
      ? `<span class="example-line">Use plain, literal headings the scanner can match — not creative ones:</span>
         <code>EXPERIENCE&nbsp;&nbsp;&nbsp;EDUCATION&nbsp;&nbsp;&nbsp;SKILLS</code>
         <span class="example-line">rather than "My Journey" or "What I Bring".</span>`
      : null;
    addLedgerRow(ledger, "Resume Sections", status, desc, hint);
  }

  // 3. Action-verb strength
  {
    const status = r.verbRatio>=0.75 && r.strongCount>=5 ? "pass" : r.strongCount>0 ? "warn" : "fail";
    const desc = status === "pass"
      ? `Found ${r.strongCount} strong action verbs (like "led", "built", "improved") and only ${r.weakCount} weak phrase${r.weakCount!==1?'s':''}. Your bullets sound confident and active.`
      : r.strongCount > 0
        ? `Found ${r.strongCount} strong verb${r.strongCount!==1?'s':''} but also ${r.weakCount} weak phrase${r.weakCount!==1?'s':''} (like "responsible for" or "helped with"). Replace weak phrases with strong action verbs to sound more confident.`
        : `No strong action verbs detected. Start your bullet points with words like "Led", "Built", "Increased", or "Reduced" instead of passive phrases.`;
    const weakPhraseUsed = r.firstWeakPhrase ? r.firstWeakPhrase.charAt(0).toUpperCase()+r.firstWeakPhrase.slice(1) : "Responsible for";
    const hint = status !== "pass"
      ? exampleRewrite(
          `${weakPhraseUsed} the onboarding process for new hires`,
          `Redesigned the onboarding process, cutting ramp-up time by 30%`
        )
      : null;
    addLedgerRow(ledger, "Action Verbs", status, desc, hint);
  }

  // 4. Quantified impact
  {
    const status = r.numberCount>=5 ? "pass" : r.numberCount>=2 ? "warn" : "fail";
    const desc = status === "pass"
      ? `Found ${r.numberCount} numbers or metrics (like percentages, dollar amounts, or team sizes). Numbers make your achievements concrete and easy to believe.`
      : r.numberCount > 0
        ? `Only found ${r.numberCount} number${r.numberCount!==1?'s':''}. Try adding more measurable results — e.g. "increased sales by 20%" or "led a team of 5".`
        : `No numbers or measurable results found. Add specific numbers to your bullet points — percentages, amounts, team sizes, or time saved — to prove your impact.`;
    const hint = status !== "pass"
      ? exampleRewrite(
          "Managed customer support team",
          "Managed a support team of 6, reducing average response time from 4h to 45min"
        ) + `<span class="example-line">Ask yourself: how many? how much? how fast? how often?</span>`
      : null;
    addLedgerRow(ledger, "Measurable Results", status, desc, hint);
  }

  // 5. Bullet formatting
  {
    const pct = Math.round(r.bulletRatio*100);
    const status = r.bulletRatio>=0.3 ? "pass" : r.bulletRatio>=0.1 ? "warn" : "fail";
    const desc = status === "pass"
      ? `${pct}% of your lines use bullet points. This makes your resume easy to scan quickly.`
      : `Only ${pct}% of your lines use bullet points. Recruiters scan resumes in seconds — break your experience into short bullet points (starting with "-" or "•") instead of paragraphs.`;
    const hint = status !== "pass"
      ? exampleRewrite(
          "Led the redesign of the checkout flow which increased conversion and also managed two junior developers during the project",
          "Led redesign of the checkout flow, increasing conversion 12%\nMentored 2 junior developers throughout the project"
        )
      : null;
    addLedgerRow(ledger, "Formatting", status, desc, hint);
  }

  // 6. Length
  {
    const status = r.wc>=350 && r.wc<=850 ? "pass" : r.wc>=150 ? "warn" : "fail";
    const desc = status === "pass"
      ? `Your resume is ${r.wc} words — a good length, roughly one page.`
      : r.wc < 350
        ? `Your resume is only ${r.wc} words, which may look too short or empty. Try to add more detail about your experience, projects, or skills (aim for 350–850 words).`
        : `Your resume is ${r.wc} words, which is quite long and may spread past one page. Try trimming it down to the most relevant points (aim for 350–850 words).`;
    const hint = status !== "pass"
      ? (r.wc < 350
          ? `<span class="example-line">Add a Projects or Certifications section, or expand each bullet with the result it produced (see "Measurable Results" above).</span>`
          : `<span class="example-line">Cut roles older than ~10 years to one line, and merge bullets that describe the same task.</span>`)
      : null;
    addLedgerRow(ledger, "Resume Length", status, desc, hint);
  }

  $("markedCopy").innerHTML = markUp(resumeText) || "<em>Nothing to mark yet.</em>";

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

// ---------- page navigation ----------
function showPage(id){
  document.querySelectorAll(".page").forEach(p => p.hidden = (p.id !== id));
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
}

function goToResults(resumeText){
  showPage("pageResults");
  $("loadingState").hidden = false;
  $("resultsContent").hidden = true;

  // Small deliberate delay so the "Analyzing…" state is visible instead of
  // an empty page appearing then instantly filling in.
  setTimeout(() => {
    const result = analyze(resumeText);
    renderResults(result, resumeText);
    $("loadingState").hidden = true;
    $("resultsContent").hidden = false;
  }, 550);
}

function goToInput(){
  showPage("pageInput");
}

// ---------- wiring ----------
document.addEventListener("DOMContentLoaded", () => {
  $("uploadBtn").addEventListener("click", () => $("fileInput").click());
  $("fileInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { $("resumeInput").value = ev.target.result; };
    reader.readAsText(file);
  });

  $("analyzeBtn").addEventListener("click", () => {
    const resumeText = $("resumeInput").value;
    if (!resumeText.trim()){
      $("resumeInput").focus();
      $("resumeInput").style.outline = "2px solid var(--bad)";
      setTimeout(()=>{ $("resumeInput").style.outline = ""; }, 1200);
      return;
    }
    goToResults(resumeText);
  });

  $("backBtn").addEventListener("click", goToInput);
});