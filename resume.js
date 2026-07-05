
Action: file_editor create /app/resume-analyzer/script.js --file-text "/* ==========================================================
   AI RESUME ANALYZER — 100% Client-side
   Parses PDF/DOCX/TXT → scores 100 → detailed feedback
   ========================================================== */

// PDF.js worker
if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    \"https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js\";
}

// ==== DOM refs ====
const fileInput      = document.getElementById(\"fileInput\");
const dropZone       = document.getElementById(\"dropZone\");
const pasteInput     = document.getElementById(\"pasteInput\");
const analyzePasteBtn = document.getElementById(\"analyzePasteBtn\");
const uploadCard     = document.getElementById(\"uploadCard\");
const loadingCard    = document.getElementById(\"loadingCard\");
const loadingText    = document.getElementById(\"loadingText\");
const results        = document.getElementById(\"results\");
const restartBtn     = document.getElementById(\"restartBtn\");
const downloadBtn    = document.getElementById(\"downloadBtn\");

// ==== File handlers ====
fileInput.addEventListener(\"change\", (e) => {
  const file = e.target.files[0];
  if (file) handleFile(file);
});

[\"dragenter\", \"dragover\"].forEach((ev) =>
  dropZone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropZone.classList.add(\"dragover\");
  })
);
[\"dragleave\", \"drop\"].forEach((ev) =>
  dropZone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropZone.classList.remove(\"dragover\");
  })
);
dropZone.addEventListener(\"drop\", (e) => {
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

analyzePasteBtn.addEventListener(\"click\", () => {
  const text = pasteInput.value.trim();
  if (text.length < 50) {
    alert(\"Please paste a longer resume (at least 50 characters).\");
    return;
  }
  runAnalysis(text);
});

restartBtn.addEventListener(\"click\", () => {
  results.classList.add(\"hidden\");
  uploadCard.classList.remove(\"hidden\");
  fileInput.value = \"\";
  pasteInput.value = \"\";
  window.scrollTo({ top: document.getElementById(\"analyzer\").offsetTop - 40, behavior: \"smooth\" });
});

downloadBtn.addEventListener(\"click\", () => downloadReport());

// ==== File → text ====
async function handleFile(file) {
  if (file.size > 5 * 1024 * 1024) {
    alert(\"File too large. Max 5MB.\");
    return;
  }
  showLoading(\"Reading your resume...\");
  try {
    let text = \"\";
    const name = file.name.toLowerCase();
    if (name.endsWith(\".pdf\")) {
      text = await readPDF(file);
    } else if (name.endsWith(\".docx\")) {
      text = await readDOCX(file);
    } else if (name.endsWith(\".txt\")) {
      text = await file.text();
    } else {
      throw new Error(\"Unsupported file type. Use PDF, DOCX or TXT.\");
    }
    if (!text || text.trim().length < 50) {
      throw new Error(\"Could not extract enough text. Try a different file or paste content directly.\");
    }
    runAnalysis(text);
  } catch (err) {
    hideLoading();
    alert(\"Error: \" + err.message);
  }
}

async function readPDF(file) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let full = \"\";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    full += content.items.map((it) => it.str).join(\" \") + \"\n\";
  }
  return full;
}

async function readDOCX(file) {
  const buf = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buf });
  return result.value;
}

// ==== Loading ====
function showLoading(msg) {
  uploadCard.classList.add(\"hidden\");
  results.classList.add(\"hidden\");
  loadingCard.classList.remove(\"hidden\");
  loadingText.textContent = msg;
}
function hideLoading() {
  loadingCard.classList.add(\"hidden\");
  uploadCard.classList.remove(\"hidden\");
}

// ==== Analysis pipeline ====
async function runAnalysis(text) {
  showLoading(\"Analyzing structure...\");
  await sleep(400);
  loadingText.textContent = \"Scoring sections...\";
  await sleep(400);
  loadingText.textContent = \"Checking ATS compatibility...\";
  await sleep(400);
  loadingText.textContent = \"Building your report...\";
  await sleep(300);

  const report = analyze(text);
  loadingCard.classList.add(\"hidden\");
  renderReport(report);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ==== The heuristic engine ====
const ACTION_VERBS = [
  \"achieved\",\"accelerated\",\"adapted\",\"administered\",\"advised\",\"analyzed\",\"architected\",\"assembled\",\"assessed\",\"authored\",\"automated\",\"boosted\",\"built\",\"captured\",\"chaired\",\"championed\",\"coached\",\"collaborated\",\"communicated\",\"conducted\",\"consolidated\",\"constructed\",\"consulted\",\"coordinated\",\"created\",\"cultivated\",\"decreased\",\"defined\",\"delivered\",\"demonstrated\",\"designed\",\"developed\",\"devised\",\"directed\",\"doubled\",\"drove\",\"earned\",\"engineered\",\"enhanced\",\"established\",\"evaluated\",\"executed\",\"expanded\",\"expedited\",\"facilitated\",\"forged\",\"formulated\",\"founded\",\"generated\",\"grew\",\"guided\",\"headed\",\"identified\",\"implemented\",\"improved\",\"increased\",\"influenced\",\"initiated\",\"innovated\",\"instituted\",\"instructed\",\"integrated\",\"introduced\",\"launched\",\"led\",\"leveraged\",\"managed\",\"mentored\",\"migrated\",\"modernized\",\"monitored\",\"motivated\",\"negotiated\",\"optimized\",\"orchestrated\",\"organized\",\"overhauled\",\"oversaw\",\"partnered\",\"performed\",\"piloted\",\"pioneered\",\"planned\",\"prepared\",\"presented\",\"prioritized\",\"processed\",\"produced\",\"programmed\",\"promoted\",\"proposed\",\"provided\",\"published\",\"recruited\",\"redesigned\",\"reduced\",\"reengineered\",\"refined\",\"reorganized\",\"reported\",\"researched\",\"resolved\",\"restructured\",\"revamped\",\"reviewed\",\"scaled\",\"scoped\",\"secured\",\"shaped\",\"shipped\",\"simplified\",\"solved\",\"spearheaded\",\"standardized\",\"streamlined\",\"strengthened\",\"structured\",\"supervised\",\"supported\",\"surpassed\",\"synthesized\",\"targeted\",\"taught\",\"tested\",\"trained\",\"transformed\",\"translated\",\"tripled\",\"unified\",\"upgraded\",\"validated\",\"won\",\"wrote\"
];

const TECH_KEYWORDS = [
  \"python\",\"javascript\",\"typescript\",\"java\",\"c++\",\"c#\",\"go\",\"rust\",\"ruby\",\"php\",\"swift\",\"kotlin\",\"scala\",
  \"react\",\"angular\",\"vue\",\"next.js\",\"node.js\",\"express\",\"django\",\"flask\",\"spring\",\"laravel\",\"rails\",
  \"aws\",\"azure\",\"gcp\",\"docker\",\"kubernetes\",\"terraform\",\"ansible\",\"jenkins\",\"git\",\"github\",\"gitlab\",\"ci/cd\",
  \"sql\",\"mysql\",\"postgresql\",\"mongodb\",\"redis\",\"elasticsearch\",\"dynamodb\",\"firebase\",
  \"machine learning\",\"deep learning\",\"tensorflow\",\"pytorch\",\"pandas\",\"numpy\",\"nlp\",\"ai\",\"llm\",\"genai\",
  \"figma\",\"sketch\",\"adobe\",\"photoshop\",\"illustrator\",\"tableau\",\"power bi\",\"excel\",\"jira\",\"confluence\",\"agile\",\"scrum\",\"kanban\",
  \"rest\",\"graphql\",\"microservices\",\"api\",\"oauth\",\"jwt\",\"html\",\"css\",\"tailwind\",\"sass\",\"webpack\",\"vite\"
];

const SOFT_SKILLS = [
  \"leadership\",\"communication\",\"teamwork\",\"problem-solving\",\"analytical\",\"strategic\",\"adaptable\",\"collaborative\",\"mentoring\",\"stakeholder\"
];

const ATS_TRAPS = [
  { re: /\|/g, label: \"Pipe characters detected — may confuse ATS parsers\" },
  { re: /\t{2,}/g, label: \"Multiple tabs found — likely a table (ATS traps)\" },
];

const WEAK_PHRASES = [
  \"responsible for\",\"duties included\",\"hard worker\",\"team player\",\"go-getter\",\"think outside the box\",\"synergy\",\"hit the ground running\",\"results-driven\",\"results-oriented\",\"detail-oriented\",\"self-starter\",\"reliable\"
];

function analyze(text) {
  const clean = text.replace(/\r/g, \"\").trim();
  const lower = clean.toLowerCase();
  const lines = clean.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const words = clean.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // ---- Detections ----
  const emailMatch  = clean.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const phoneMatch  = clean.match(/(\+?\d{1,3}[\s-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
  const linkedin    = /linkedin\.com\/in\//i.test(clean);
  const github      = /github\.com\//i.test(clean);
  const portfolio   = /(portfolio|behance|dribbble|personal.?site|\.dev|\.io)/i.test(clean);

  const hasSummary     = /\b(summary|profile|objective|about)\b/i.test(clean);
  const hasExperience  = /\b(experience|employment|work history|professional)\b/i.test(clean);
  const hasEducation   = /\b(education|academic|university|college|bachelor|master|phd|b\.?tech|m\.?tech|degree)\b/i.test(clean);
  const hasSkills      = /\b(skills|technologies|technical|competencies|tools)\b/i.test(clean);
  const hasProjects    = /\b(projects?|portfolio)\b/i.test(clean);
  const hasCerts       = /\b(certification|certificate|certified|licence|license)\b/i.test(clean);

  // action verbs
  const verbHits = ACTION_VERBS.filter((v) =>
    new RegExp(`\\b${v}\\b`, \"i\").test(clean)
  );
  const verbCount = verbHits.length;

  // quantified results — numbers, %, $
  const numberHits = clean.match(/(\d+%|\$\s?\d+|\d+(\+|k|K|M)|\d+\s?(users|customers|clients|hours|days|weeks|months|years|team|people|projects|deals))/g) || [];
  const metricCount = numberHits.length;

  // bullet points
  const bulletLines = lines.filter((l) => /^(\u2022|\-|\*|\u25CF|\u2023|\u2043|\u25E6|·)/.test(l));
  const bulletCount = bulletLines.length;

  // pages estimation (rule of thumb ~450 words/page)
  const pageEst = Math.max(1, Math.ceil(wordCount / 450));

  // weak phrases
  const weakHits = WEAK_PHRASES.filter((p) => lower.includes(p));

  // ATS traps
  const trapHits = ATS_TRAPS.filter((t) => t.re.test(clean));

  // keywords
  const kwHits = TECH_KEYWORDS.filter((k) => new RegExp(`\\b${k.replace(/[.+#]/g,'\\$&')}\\b`, \"i\").test(clean));
  const softHits = SOFT_SKILLS.filter((s) => new RegExp(`\\b${s}\\b`, \"i\").test(clean));

  // ---- Section scores (each 0..max) ----
  const sections = [];

  // 1. Contact & Links (15)
  let contactScore = 0;
  if (emailMatch) contactScore += 5;
  if (phoneMatch) contactScore += 4;
  if (linkedin)   contactScore += 3;
  if (github || portfolio) contactScore += 3;
  sections.push({
    key: \"contact\",
    title: \"Contact & Links\",
    score: contactScore,
    max: 15,
    note: [
      emailMatch ? \"Email ✓\" : \"Missing email\",
      phoneMatch ? \"Phone ✓\" : \"Missing phone\",
      linkedin ? \"LinkedIn ✓\" : \"No LinkedIn URL\",
      (github || portfolio) ? \"Portfolio/GitHub ✓\" : \"No portfolio/GitHub link\"
    ].join(\" · \")
  });

  // 2. Summary/Profile (8)
  let summaryScore = hasSummary ? 8 : 0;
  sections.push({
    key: \"summary\",
    title: \"Professional Summary\",
    score: summaryScore,
    max: 8,
    note: hasSummary ? \"Summary section present\" : \"Add a 2–3 line summary at the top\"
  });

  // 3. Experience with verbs & metrics (25)
  let expScore = 0;
  if (hasExperience) expScore += 8;
  expScore += Math.min(9, verbCount);       // up to 9 pts for action verbs
  expScore += Math.min(8, metricCount * 2); // up to 8 pts for quantified results
  sections.push({
    key: \"experience\",
    title: \"Work Experience\",
    score: expScore,
    max: 25,
    note: `${verbCount} action verbs · ${metricCount} quantified results`
  });

  // 4. Skills (12)
  let skillsScore = 0;
  if (hasSkills) skillsScore += 4;
  skillsScore += Math.min(8, Math.floor(kwHits.length / 2));
  sections.push({
    key: \"skills\",
    title: \"Skills\",
    score: skillsScore,
    max: 12,
    note: `${kwHits.length} technical keywords detected`
  });

  // 5. Education (8)
  let eduScore = hasEducation ? 8 : 0;
  sections.push({
    key: \"education\",
    title: \"Education\",
    score: eduScore,
    max: 8,
    note: hasEducation ? \"Education section present\" : \"Add education details\"
  });

  // 6. Projects/Certifications (7)
  let projScore = 0;
  if (hasProjects) projScore += 4;
  if (hasCerts)    projScore += 3;
  sections.push({
    key: \"projects\",
    title: \"Projects & Certifications\",
    score: projScore,
    max: 7,
    note: `${hasProjects ? \"Projects ✓\" : \"No projects section\"} · ${hasCerts ? \"Certifications ✓\" : \"No certifications\"}`
  });

  // 7. Formatting & Length (10)
  let fmtScore = 0;
  if (wordCount >= 250 && wordCount <= 900) fmtScore += 5;
  else if (wordCount >= 150 && wordCount <= 1200) fmtScore += 3;
  if (pageEst <= 2) fmtScore += 3;
  if (bulletCount >= 6) fmtScore += 2;
  sections.push({
    key: \"formatting\",
    title: \"Formatting & Length\",
    score: fmtScore,
    max: 10,
    note: `${wordCount} words · ~${pageEst} page(s) · ${bulletCount} bullets`
  });

  // 8. ATS Compatibility (10)
  let atsScore = 10;
  const atsChecks = [];
  atsChecks.push({ pass: !!emailMatch, label: \"Plain-text email found\" });
  atsChecks.push({ pass: bulletCount >= 3, label: \"Uses standard bullet points\" });
  atsChecks.push({ pass: !trapHits.length, label: \"No tables/columns detected\" });
  atsChecks.push({ pass: wordCount >= 200, label: \"Sufficient text content\" });
  atsChecks.push({ pass: /\b(experience|education|skills)\b/i.test(clean), label: \"Standard section headings\" });
  atsChecks.push({ pass: kwHits.length >= 5, label: \"Contains industry keywords\" });
  const atsPassCount = atsChecks.filter((c) => c.pass).length;
  atsScore = Math.round((atsPassCount / atsChecks.length) * 10);
  sections.push({
    key: \"ats\",
    title: \"ATS Compatibility\",
    score: atsScore,
    max: 10,
    note: `${atsPassCount}/${atsChecks.length} ATS checks passed`
  });

  // 9. Language quality (5) — penalise weak phrases
  let langScore = 5 - Math.min(5, weakHits.length);
  sections.push({
    key: \"language\",
    title: \"Language Quality\",
    score: langScore,
    max: 5,
    note: weakHits.length ? `${weakHits.length} weak phrase(s) found` : \"Strong, active language\"
  });

  // ---- Total ----
  const total = sections.reduce((s, x) => s + x.score, 0);
  const maxTotal = sections.reduce((s, x) => s + x.max, 0);
  const overall = Math.round((total / maxTotal) * 100);

  // ---- Issues ----
  const issues = [];
  if (!emailMatch)  issues.push({ sev: \"high\",   title: \"No email address found\",  desc: \"Recruiters and ATS tools rely on your email to contact you.\" });
  if (!phoneMatch)  issues.push({ sev: \"medium\", title: \"No phone number found\",   desc: \"A phone number gives recruiters a direct line to reach you.\" });
  if (!linkedin)    issues.push({ sev: \"medium\", title: \"LinkedIn URL missing\",    desc: \"80%+ of recruiters check LinkedIn — link yours prominently.\" });
  if (!hasSummary)  issues.push({ sev: \"medium\", title: \"No professional summary\", desc: \"A 2–3 line summary at the top helps recruiters in the first 7-second scan.\" });
  if (metricCount < 3) issues.push({ sev: \"high\",   title: \"Not enough quantified results\", desc: `Only ${metricCount} metrics found. Numbers make achievements believable.` });
  if (verbCount < 6)   issues.push({ sev: \"high\",   title: \"Weak action-verb usage\", desc: `Only ${verbCount} strong action verbs detected. Start every bullet with one.` });
  if (weakHits.length) issues.push({ sev: \"medium\", title: `${weakHits.length} weak/cliché phrase(s)`, desc: `Avoid: \"${weakHits.slice(0,3).join('\", \"')}\"${weakHits.length>3?'...':''}` });
  if (wordCount < 250) issues.push({ sev: \"medium\", title: \"Resume is too short\", desc: `Only ${wordCount} words. Aim for 400–700.` });
  if (wordCount > 900) issues.push({ sev: \"medium\", title: \"Resume is too long\", desc: `${wordCount} words — trim to under 900 (1–2 pages).` });
  if (bulletCount < 6) issues.push({ sev: \"low\", title: \"Few bullet points\", desc: \"Break dense paragraphs into scannable bullets.\" });
  if (!hasSkills)   issues.push({ sev: \"high\",   title: \"No dedicated Skills section\", desc: \"ATS scanners look for a Skills block. Add one.\" });
  if (!hasEducation) issues.push({ sev: \"medium\", title: \"No Education section found\", desc: \"Even if minimal, include your degree or highest qualification.\" });
  if (!hasProjects && !hasCerts) issues.push({ sev: \"low\", title: \"No projects or certifications\", desc: \"Projects showcase skills; certifications add credibility.\" });
  if (trapHits.length) issues.push({ sev: \"high\", title: \"Possible ATS traps detected\", desc: trapHits.map((t)=>t.label).join(\" · \") });
  if (kwHits.length < 5) issues.push({ sev: \"medium\", title: \"Low keyword density\", desc: `Only ${kwHits.length} industry keywords. Tailor to the job description.` });

  // ---- Fixes ----
  const fixes = [];
  if (!emailMatch || !phoneMatch || !linkedin) {
    fixes.push({ title: \"Complete your header\", desc: \"Add: Full name · Email · Phone · LinkedIn · Location · Portfolio/GitHub — all on top.\" });
  }
  if (!hasSummary) {
    fixes.push({ title: \"Write a 3-line summary\", desc: 'Formula: \"[Role] with [X yrs] experience in [domain]. Proven at [key achievement]. Passionate about [target role/impact].\"' });
  }
  if (verbCount < 8) {
    fixes.push({ title: \"Rewrite bullets with strong verbs\", desc: \"Use: Led, Built, Shipped, Reduced, Automated, Launched, Scaled, Optimized — never 'Responsible for'.\" });
  }
  if (metricCount < 3) {
    fixes.push({ title: \"Quantify every achievement\", desc: 'Turn \"Improved performance\" into \"Reduced page load time by 42%, boosting conversion 18%.\" Numbers convince recruiters.' });
  }
  if (weakHits.length) {
    fixes.push({ title: \"Remove clichés\", desc: `Delete phrases like \"${weakHits.slice(0,2).join('\", \"')}\". Replace with concrete outcomes.` });
  }
  if (!hasSkills || kwHits.length < 8) {
    fixes.push({ title: \"Add a Skills block\", desc: \"Group as: Languages · Frameworks · Tools · Cloud. Mirror keywords from job descriptions you're targeting.\" });
  }
  if (wordCount < 250) {
    fixes.push({ title: \"Expand achievements\", desc: \"For each role, add 3–5 bullets covering: what you built, tech used, measurable impact.\" });
  }
  if (wordCount > 900) {
    fixes.push({ title: \"Trim ruthlessly\", desc: \"Cut old roles (>10 yrs), remove filler adjectives, condense bullets to one line each. Aim under 700 words.\" });
  }
  if (bulletCount < 6) {
    fixes.push({ title: \"Use bullets, not paragraphs\", desc: \"Recruiters scan in 7 seconds. Bullets → 5–8 per role, one line each.\" });
  }
  if (trapHits.length) {
    fixes.push({ title: \"Make it ATS-clean\", desc: \"Remove tables, columns, text-boxes, images, headers/footers. Use a single-column plain layout.\" });
  }
  if (!hasProjects) {
    fixes.push({ title: \"Add a Projects section\", desc: \"List 2–3 relevant projects: title, 1-line description, tech stack, live link/GitHub, key outcome.\" });
  }
  fixes.push({ title: \"Tailor per application\", desc: \"Mirror 8–12 keywords from each job description into your Skills & Experience bullets to beat ATS filters.\" });

  // ---- Verdict ----
  let grade, verdictTitle, verdictSub;
  if (overall >= 85) {
    grade = \"EXCELLENT\"; verdictTitle = \"This resume is recruiter-ready.\"; verdictSub = \"Minor polish suggestions below — you're in the top tier.\";
  } else if (overall >= 70) {
    grade = \"STRONG\";    verdictTitle = \"Solid resume — a few upgrades away from great.\"; verdictSub = \"Fix the highlighted items to significantly boost callback rates.\";
  } else if (overall >= 55) {
    grade = \"AVERAGE\";   verdictTitle = \"There's real potential — but it needs work.\"; verdictSub = \"Address the high-priority fixes to move into the top-tier.\";
  } else if (overall >= 40) {
    grade = \"NEEDS WORK\";verdictTitle = \"Significant improvements required.\"; verdictSub = \"Follow the fix checklist below — start with the high-severity items.\";
  } else {
    grade = \"REBUILD\";   verdictTitle = \"Time for a rewrite from the ground up.\"; verdictSub = \"Use the recommendations below as a blueprint. You've got this.\";
  }

  return {
    overall, grade, verdictTitle, verdictSub,
    sections,
    issues,
    fixes,
    stats: { wordCount, pageEst, verbCount, metricCount, bulletCount },
    ats: { checks: atsChecks, score: atsScore, passCount: atsPassCount, total: atsChecks.length },
    keywords: kwHits,
    softSkills: softHits,
  };
}

// ==== RENDER ====
function renderReport(r) {
  results.classList.remove(\"hidden\");

  // Overall
  const scoreEl = document.getElementById(\"overallScore\");
  animateNumber(scoreEl, 0, r.overall, 1400);
  document.getElementById(\"overallGrade\").textContent = r.grade;
  document.getElementById(\"verdictTitle\").textContent = r.verdictTitle;
  document.getElementById(\"verdictSub\").textContent = r.verdictSub;

  // Ring
  const ring = document.getElementById(\"bigRingFg\");
  const circumference = 553;
  requestAnimationFrame(() => {
    ring.style.strokeDashoffset = circumference - (circumference * r.overall) / 100;
    ring.style.stroke = r.overall >= 75 ? \"#2d7d46\" : r.overall >= 55 ? \"#c47d18\" : \"#b8321a\";
  });

  // Sections
  const grid = document.getElementById(\"sectionGrid\");
  grid.innerHTML = r.sections.map((s) => {
    const pct = Math.round((s.score / s.max) * 100);
    const color = pct >= 75 ? \"#2d7d46\" : pct >= 50 ? \"#c47d18\" : \"#b8321a\";
    return `
      <div class=\"section-card\" data-testid=\"section-${s.key}\">
        <div class=\"section-card-head\">
          <span class=\"section-card-title\">${s.title}</span>
          <span class=\"section-card-score\" style=\"color:${color}\">${s.score}/${s.max}</span>
        </div>
        <div class=\"section-card-bar\">
          <div class=\"section-card-bar-fill\" style=\"width:0%; background:${color}\"></div>
        </div>
        <div class=\"section-card-note\">${s.note}</div>
      </div>`;
  }).join(\"\");
  // Animate bars
  setTimeout(() => {
    document.querySelectorAll(\".section-card-bar-fill\").forEach((el, i) => {
      const s = r.sections[i];
      el.style.width = Math.round((s.score / s.max) * 100) + \"%\";
    });
  }, 100);

  // Issues
  const issuesList = document.getElementById(\"issuesList\");
  if (r.issues.length === 0) {
    issuesList.innerHTML = `<div class=\"issue-item low\"><div class=\"issue-icon\"><i class=\"fa-solid fa-check\"></i></div><div class=\"issue-content\"><h5>No major issues detected</h5><p>Your resume passes all our core checks. Consider the fine-tuning tips on the right.</p></div></div>`;
  } else {
    issuesList.innerHTML = r.issues.map((i) => {
      const icon = i.sev === \"high\" ? \"fa-circle-xmark\" : i.sev === \"medium\" ? \"fa-triangle-exclamation\" : \"fa-circle-info\";
      return `
        <div class=\"issue-item ${i.sev}\">
          <div class=\"issue-icon\"><i class=\"fa-solid ${icon}\"></i></div>
          <div class=\"issue-content\">
            <h5>${i.title}</h5>
            <p>${i.desc}</p>
            <span class=\"issue-badge\">${i.sev} priority</span>
          </div>
        </div>`;
    }).join(\"\");
  }

  // Fixes
  const fixesList = document.getElementById(\"fixesList\");
  fixesList.innerHTML = r.fixes.map((f, idx) => `
    <div class=\"fix-item\">
      <div class=\"fix-icon\"><i class=\"fa-solid fa-wrench\"></i></div>
      <div class=\"fix-content\">
        <h5>${String(idx+1).padStart(2,\"0\")}. ${f.title}</h5>
        <p>${f.desc}</p>
      </div>
    </div>`).join(\"\");

  // ATS
  document.getElementById(\"atsScore\").textContent = `${r.ats.passCount}/${r.ats.total}`;
  document.getElementById(\"atsList\").innerHTML = r.ats.checks.map((c) => `
    <div class=\"ats-item\">
      <i class=\"fa-solid ${c.pass ? \"fa-circle-check pass\" : \"fa-circle-xmark fail\"}\"></i>
      <span>${c.label}</span>
    </div>`).join(\"\");

  // Keywords
  document.getElementById(\"keywordCount\").textContent = `${r.keywords.length} found`;
  const kwEl = document.getElementById(\"keywordCloud\");
  if (r.keywords.length === 0) {
    kwEl.innerHTML = `<div style=\"font-size:13px;color:var(--ink-3)\">No technical keywords detected. Add tools & technologies specific to your target role.</div>`;
  } else {
    kwEl.innerHTML = r.keywords.slice(0, 30).map((k, i) => `<span class=\"keyword-chip ${i<8?'hot':''}\">${k}</span>`).join(\"\");
  }

  // Stats
  document.getElementById(\"statWords\").textContent = r.stats.wordCount;
  document.getElementById(\"statPages\").textContent = r.stats.pageEst;
  document.getElementById(\"statVerbs\").textContent = r.stats.verbCount;
  document.getElementById(\"statMetrics\").textContent = r.stats.metricCount;
  document.getElementById(\"statBullets\").textContent = r.stats.bulletCount;

  // save for download
  window.__lastReport = r;

  // Scroll into view
  setTimeout(() => {
    results.scrollIntoView({ behavior: \"smooth\", block: \"start\" });
  }, 150);
}

function animateNumber(el, from, to, dur) {
  const start = performance.now();
  function tick(now) {
    const t = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(from + (to - from) * eased);
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ==== Download report ====
function downloadReport() {
  const r = window.__lastReport;
  if (!r) return;
  const lines = [];
  lines.push(\"=\".repeat(60));
  lines.push(\"       RESUME ANALYZER — DETAILED REPORT\");
  lines.push(\"=\".repeat(60));
  lines.push(\"\");
  lines.push(`OVERALL SCORE: ${r.overall}/100 — ${r.grade}`);
  lines.push(`Verdict: ${r.verdictTitle}`);
  lines.push(\"\");
  lines.push(\"-\".repeat(60));
  lines.push(\"SECTION BREAKDOWN\");
  lines.push(\"-\".repeat(60));
  r.sections.forEach((s) => {
    lines.push(`  ${s.title.padEnd(28)} ${String(s.score).padStart(2)}/${s.max}   — ${s.note}`);
  });
  lines.push(\"\");
  lines.push(\"-\".repeat(60));
  lines.push(\"ISSUES FOUND\");
  lines.push(\"-\".repeat(60));
  r.issues.forEach((i, idx) => {
    lines.push(`${idx+1}. [${i.sev.toUpperCase()}] ${i.title}`);
    lines.push(`   ${i.desc}`);
    lines.push(\"\");
  });
  lines.push(\"-\".repeat(60));
  lines.push(\"HOW TO FIX — ACTION CHECKLIST\");
  lines.push(\"-\".repeat(60));
  r.fixes.forEach((f, idx) => {
    lines.push(`${idx+1}. ${f.title}`);
    lines.push(`   ${f.desc}`);
    lines.push(\"\");
  });
  lines.push(\"-\".repeat(60));
  lines.push(\"QUICK STATS\");
  lines.push(\"-\".repeat(60));
  lines.push(`  Words: ${r.stats.wordCount}   Pages: ~${r.stats.pageEst}   Bullets: ${r.stats.bulletCount}`);
  lines.push(`  Action verbs: ${r.stats.verbCount}   Quantified results: ${r.stats.metricCount}`);
  lines.push(`  Keywords: ${r.keywords.join(\", \")}`);
  lines.push(\"\");
  lines.push(\"Generated by ResumeAnalyzer — 100% client-side, private, free.\");

  const blob = new Blob([lines.join(\"\n\")], { type: \"text/plain\" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement(\"a\");
  a.href = url;
  a.download = `resume-report-${r.overall}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}
"
Observation: Create successful: /app/resume-analyzer/script.js