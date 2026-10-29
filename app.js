(function () {
  "use strict";

  const MAX_SIZE_MB = 5;
  const ACTION_VERBS = [
    "built", "developed", "designed", "implemented", "created", "led", "managed",
    "improved", "increased", "reduced", "optimized", "automated", "analyzed", "launched",
    "delivered", "architected", "trained", "deployed", "researched", "coordinated",
    "resolved", "streamlined", "migrated", "wrote", "tested", "collaborated"
  ];
  const WEAK_PHRASES = /\b(responsible for|duties include|duties included|helped with|worked on|assisted with|etc\.?)(?=\s|$|[.,;])/i;

  const el = {
    dropZone: document.getElementById("drop-zone"),
    fileInput: document.getElementById("file-input"),
    fileRow: document.getElementById("file-row"),
    fileName: document.getElementById("file-name"),
    clearBtn: document.getElementById("clear-btn"),
    analyzeBtn: document.getElementById("analyze-btn"),
    status: document.getElementById("status"),
    results: document.getElementById("results"),
    uploadPanel: document.getElementById("upload-panel"),
    scoreCircle: document.getElementById("score-circle"),
    scoreValue: document.getElementById("score-value"),
    scoreLabel: document.getElementById("score-label"),
    scoreSummary: document.getElementById("score-summary"),
    metaLine: document.getElementById("meta-line"),
    checks: document.getElementById("checks"),
    suggestions: document.getElementById("suggestions"),
    againBtn: document.getElementById("again-btn")
  };

  let selectedFile = null;

  /* ---------- File handling ---------- */

  function setStatus(message, isError) {
    el.status.textContent = message || "";
    el.status.classList.toggle("error", Boolean(isError));
  }

  function setFile(file) {
    setStatus("");
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["pdf", "docx", "txt"].includes(ext)) {
      setStatus("Please upload a PDF, DOCX, or TXT file.", true);
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setStatus("That file is larger than " + MAX_SIZE_MB + " MB. Please upload a smaller file.", true);
      return;
    }
    selectedFile = file;
    el.fileName.textContent = file.name;
    el.fileRow.hidden = false;
    el.analyzeBtn.disabled = false;
  }

  function clearFile() {
    selectedFile = null;
    el.fileInput.value = "";
    el.fileRow.hidden = true;
    el.analyzeBtn.disabled = true;
    setStatus("");
  }

  async function extractText(file) {
    const ext = file.name.split(".").pop().toLowerCase();

    if (ext === "txt") {
      return await file.text();
    }

    const buffer = await file.arrayBuffer();

    if (ext === "docx") {
      if (!window.mammoth) throw new Error("The DOCX reader could not load. Check your internet connection and try again.");
      const result = await window.mammoth.extractRawText({ arrayBuffer: buffer });
      return result.value;
    }

    if (ext === "pdf") {
      if (!window.pdfjsLib) throw new Error("The PDF reader could not load. Check your internet connection and try again.");
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      const pdf = await window.pdfjsLib.getDocument({ data: buffer }).promise;
      let text = "";
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        for (const item of content.items) {
          text += item.str + (item.hasEOL ? "\n" : " ");
        }
        text += "\n";
      }
      return text;
    }

    throw new Error("Unsupported file type.");
  }

  /* ---------- Analysis ---------- */

  function analyze(text) {
    const lower = text.toLowerCase();
    const lines = text.split(/\n+/).map(function (l) { return l.trim(); }).filter(Boolean);
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

    const bulletLines = lines.map(function (l) { return l.replace(/^[•\-*▪●◦·]\s*/, ""); });
    const verbLines = bulletLines.filter(function (l) {
      const first = (l.split(/\s+/)[0] || "").toLowerCase().replace(/[^a-z]/g, "");
      return ACTION_VERBS.indexOf(first) !== -1;
    });
    const numberLines = lines.filter(function (l) {
      return /\d+\s*%|\$\s?\d|\b\d+\s*(users|students|customers|people|projects|hours|days|months|years|x|times|clients|members)\b|\b\d{2,}\b/i.test(l);
    });

    const checks = [
      {
        title: "Email address",
        weight: 10,
        pass: /[\w.+-]+@[\w-]+\.[\w.-]+/.test(text),
        detail: "Recruiters need a way to contact you.",
        fix: "Add a professional email address near the top of your resume."
      },
      {
        title: "Phone number",
        weight: 5,
        pass: /(\+?\d[\d\s().-]{8,}\d)/.test(text),
        detail: "A phone number makes it easy to reach you.",
        fix: "Add a phone number with your country code near your contact details."
      },
      {
        title: "Profile link (LinkedIn or GitHub)",
        weight: 5,
        pass: /linkedin\.com|github\.com|portfolio|behance|kaggle/i.test(text),
        detail: "Links let recruiters see more of your work.",
        fix: "Add your LinkedIn or GitHub profile link to your contact details."
      },
      {
        title: "Summary or objective",
        weight: 5,
        pass: /\b(summary|objective|profile|about me)\b/i.test(text),
        detail: "A short summary helps recruiters see your focus at a glance.",
        fix: "Add a 2 to 3 line summary stating your role, key skills, and goal."
      },
      {
        title: "Work experience or internships",
        weight: 15,
        pass: /\b(experience|work history|employment|internship|internships)\b/i.test(text),
        detail: "Experience is the section recruiters read first.",
        fix: "Add a clearly labeled Experience or Internship section with your roles and dates."
      },
      {
        title: "Education section",
        weight: 10,
        pass: /\b(education|university|college|bachelor|master|b\.?tech|b\.?sc|degree)\b/i.test(text),
        detail: "Your degree and institution should be easy to find.",
        fix: "Add an Education section with your degree, institution, and graduation year."
      },
      {
        title: "Skills section",
        weight: 10,
        pass: /\b(skills|technical skills|technologies|tools)\b/i.test(text),
        detail: "A skills section helps automated screening tools match you to roles.",
        fix: "Add a Skills section listing your technical tools and languages."
      },
      {
        title: "Projects section",
        weight: 5,
        pass: /\bprojects?\b/i.test(text),
        detail: "Projects show practical work beyond coursework.",
        fix: "Add a Projects section with 2 to 3 relevant projects and what each one did."
      },
      {
        title: "Measurable achievements",
        weight: 15,
        pass: numberLines.length >= 3,
        detail: "Found " + numberLines.length + " line(s) with numbers, such as percentages or counts. Aim for at least 3.",
        fix: "Add numbers to your bullet points, such as \"reduced processing time by 30%\" or \"served 200+ students\"."
      },
      {
        title: "Strong action verbs",
        weight: 10,
        pass: verbLines.length >= 4,
        detail: "Found " + verbLines.length + " bullet(s) starting with a strong action verb. Aim for at least 4.",
        fix: "Start your bullet points with action verbs such as Built, Developed, Led, Improved, or Automated."
      },
      {
        title: "Appropriate length",
        weight: 5,
        pass: wordCount >= 300 && wordCount <= 800,
        detail: "Your resume has about " + wordCount + " words. Most resumes work best between 300 and 800.",
        fix: wordCount < 300
          ? "Your resume looks short. Add more detail about your projects and responsibilities."
          : "Your resume looks long. Keep only the most relevant experience and trim older or less relevant points."
      },
      {
        title: "No vague phrases",
        weight: 5,
        pass: !WEAK_PHRASES.test(lower),
        detail: "Phrases such as \"responsible for\" or \"helped with\" are vague.",
        fix: "Replace vague phrases like \"responsible for\" with what you actually did and the result."
      }
    ];

    const totalWeight = checks.reduce(function (sum, c) { return sum + c.weight; }, 0);
    const earned = checks.reduce(function (sum, c) { return sum + (c.pass ? c.weight : 0); }, 0);
    const score = Math.round((earned / totalWeight) * 100);

    return { score: score, checks: checks, wordCount: wordCount, lineCount: lines.length };
  }

  /* ---------- Rendering ---------- */

  function render(result) {
    const score = result.score;
    el.scoreValue.textContent = score;

    el.scoreCircle.classList.remove("good", "mid", "low");
    if (score >= 75) el.scoreCircle.classList.add("good");
    else if (score >= 50) el.scoreCircle.classList.add("mid");
    else el.scoreCircle.classList.add("low");

    let label, summary;
    if (score >= 75) {
      label = "Strong resume";
      summary = "Your resume covers the essentials well. Address the remaining points below to polish it further.";
    } else if (score >= 50) {
      label = "Good start";
      summary = "Your resume has a solid base, but a few important sections or details are missing.";
    } else {
      label = "Needs work";
      summary = "Several key elements are missing. Work through the suggestions below to strengthen your resume.";
    }
    el.scoreLabel.textContent = label;
    el.scoreSummary.textContent = summary;
    el.metaLine.textContent = "Analyzed " + result.wordCount + " words across " + result.lineCount + " lines.";

    el.checks.innerHTML = "";
    const failed = [];
    result.checks.forEach(function (c) {
      const li = document.createElement("li");

      const icon = document.createElement("span");
      icon.className = "check-icon " + (c.pass ? "pass" : "fail");
      icon.textContent = c.pass ? "✓" : "✕";

      const text = document.createElement("div");
      const title = document.createElement("div");
      title.className = "check-title";
      title.textContent = c.title + " (" + c.weight + " pts)";
      const detail = document.createElement("div");
      detail.className = "check-detail";
      detail.textContent = c.detail;
      text.appendChild(title);
      text.appendChild(detail);

      li.appendChild(icon);
      li.appendChild(text);
      el.checks.appendChild(li);

      if (!c.pass) failed.push(c.fix);
    });

    el.suggestions.innerHTML = "";
    if (failed.length === 0) {
      const li = document.createElement("li");
      li.textContent = "Excellent. Every check passed. Tailor your resume to each job description for the best results.";
      li.style.background = "#eaf8f1";
      li.style.borderLeftColor = "#2f9e6e";
      el.suggestions.appendChild(li);
    } else {
      failed.forEach(function (tip) {
        const li = document.createElement("li");
        li.textContent = tip;
        el.suggestions.appendChild(li);
      });
    }
  }

  /* ---------- Job matching (TF-IDF + cosine similarity) ---------- */

  const STOP_WORDS = new Set([
    "the", "and", "for", "with", "a", "an", "of", "to", "in", "on", "is", "are", "be", "or",
    "as", "at", "by", "from", "that", "this", "it", "we", "you", "your", "our", "will", "can",
    "using", "use", "have", "has", "etc", "who", "what", "how", "about", "into", "their", "they",
    "experience", "knowledge", "ability", "strong", "good", "work", "team", "role", "job",
    "candidate", "plus", "hiring", "join", "build", "including", "must", "should", "required",
    "preferred", "looking", "years", "year"
  ]);

  function tokenize(text) {
    const words = text.toLowerCase().match(/[a-z][a-z0-9+#]+/g) || [];
    return words.filter(function (w) { return !STOP_WORDS.has(w); });
  }

  // Builds a TF-IDF vector (word -> weight) for each document.
  function tfidfVectors(docs) {
    const tokenized = docs.map(tokenize);
    const total = docs.length;
    const docFreq = {};
    tokenized.forEach(function (tokens) {
      new Set(tokens).forEach(function (t) { docFreq[t] = (docFreq[t] || 0) + 1; });
    });
    return tokenized.map(function (tokens) {
      const counts = {};
      tokens.forEach(function (t) { counts[t] = (counts[t] || 0) + 1; });
      const length = tokens.length || 1;
      const vector = {};
      Object.keys(counts).forEach(function (t) {
        const tf = counts[t] / length;
        const idf = Math.log((1 + total) / (1 + docFreq[t])) + 1;
        vector[t] = tf * idf;
      });
      return vector;
    });
  }

  // Cosine similarity between two sparse vectors (0 to 1).
  function cosineSimilarity(a, b) {
    let dot = 0, normA = 0, normB = 0;
    Object.keys(a).forEach(function (k) {
      normA += a[k] * a[k];
      if (b[k]) dot += a[k] * b[k];
    });
    Object.keys(b).forEach(function (k) { normB += b[k] * b[k]; });
    if (!normA || !normB) return 0;
    return dot / Math.sqrt(normA * normB);
  }

  function jobMatch(resumeText, jobText) {
    const vectors = tfidfVectors([resumeText, jobText]);
    const resumeVec = vectors[0];
    const jobVec = vectors[1];

    const percent = Math.round(cosineSimilarity(resumeVec, jobVec) * 100);

    // Most important job terms that do not appear in the resume.
    const resumeWords = new Set(tokenize(resumeText));
    const missing = Object.keys(jobVec)
      .sort(function (a, b) { return jobVec[b] - jobVec[a]; })
      .filter(function (t) { return t.length > 2 && !resumeWords.has(t); })
      .slice(0, 10);

    return { percent: percent, missing: missing };
  }

  function renderMatch(match, jobText) {
    const box = document.getElementById("match-box");
    box.innerHTML = "";

    const title = document.createElement("h3");
    title.textContent = "Job match";

    const percent = document.createElement("div");
    percent.className = "match-percent";
    percent.textContent = match.percent + "%";

    const note = document.createElement("p");
    note.textContent = match.percent >= 50
      ? "Your resume closely matches this job description."
      : match.percent >= 25
        ? "Your resume partly matches this job. Add the keywords below where they are true for you."
        : "Your resume has little overlap with this job. Tailor it using the keywords below.";

    box.appendChild(title);
    box.appendChild(percent);
    box.appendChild(note);

    if (match.missing.length > 0) {
      const label = document.createElement("p");
      label.textContent = "Important words from the job that are missing from your resume:";
      const chips = document.createElement("div");
      chips.className = "match-chips";
      match.missing.forEach(function (word) {
        const chip = document.createElement("span");
        chip.textContent = word;
        chips.appendChild(chip);
      });
      box.appendChild(label);
      box.appendChild(chips);
    }

    box.hidden = false;
  }

  /* ---------- Events ---------- */

  el.fileInput.addEventListener("change", function (e) {
    setFile(e.target.files[0]);
  });

  ["dragenter", "dragover"].forEach(function (evt) {
    el.dropZone.addEventListener(evt, function (e) {
      e.preventDefault();
      el.dropZone.classList.add("dragover");
    });
  });
  ["dragleave", "drop"].forEach(function (evt) {
    el.dropZone.addEventListener(evt, function (e) {
      e.preventDefault();
      el.dropZone.classList.remove("dragover");
    });
  });
  el.dropZone.addEventListener("drop", function (e) {
    const file = e.dataTransfer.files[0];
    if (file) setFile(file);
  });

  el.clearBtn.addEventListener("click", clearFile);

  el.analyzeBtn.addEventListener("click", async function () {
    if (!selectedFile) return;
    el.analyzeBtn.disabled = true;
    setStatus("Reading your resume...");
    try {
      const text = await extractText(selectedFile);
      if (!text || text.trim().length < 50) {
        setStatus("We could not read enough text from this file. If it is a scanned PDF, try a DOCX or TXT version.", true);
        el.analyzeBtn.disabled = false;
        return;
      }
      const result = analyze(text);
      render(result);

      const jobText = document.getElementById("job-text").value.trim();
      if (jobText.length >= 30) {
        renderMatch(jobMatch(text, jobText), jobText);
      } else {
        document.getElementById("match-box").hidden = true;
      }

      el.uploadPanel.hidden = true;
      el.results.hidden = false;
      el.results.scrollIntoView({ behavior: "smooth", block: "start" });
      setStatus("");
    } catch (err) {
      setStatus(err.message || "Something went wrong while reading the file.", true);
      el.analyzeBtn.disabled = false;
    }
  });

  el.againBtn.addEventListener("click", function () {
    clearFile();
    el.results.hidden = true;
    el.uploadPanel.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
})();
