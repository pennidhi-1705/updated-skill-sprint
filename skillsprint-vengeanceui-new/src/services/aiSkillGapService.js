import { getPublishedTasks } from "./taskService";
import { getProjects } from "./projectService";
import { calculateMatch } from "./matchingService";

// ---------------------------------------------------------------------------
// AI Skill Gap Radar — deterministic AI-service abstraction.
// No random numbers anywhere: every score is derived from the student's own
// profile, completed projects and the tasks actually available on
// SkillSprint. If a real AI/LLM endpoint is wired up later, only the internals
// of these functions need to change — callers (App.jsx) stay the same.
// ---------------------------------------------------------------------------

export const SKILL_CATEGORIES = [
  "Programming",
  "Web Development",
  "Data/AI",
  "Communication",
  "Problem Solving",
  "Domain Knowledge",
  "Project Experience"
];

const KEYWORDS = {
  "Programming": ["java","python","c++","c#"," c ","golang","go","rust","kotlin","swift","php","ruby","javascript","typescript","dsa","algorithm","oop","programming"],
  "Web Development": ["react","html","css","node","express","next.js","nextjs","vue","angular","tailwind","bootstrap","rest api","graphql","frontend","backend","full stack","fullstack","web development","django","flask"],
  "Data/AI": ["sql","pandas","numpy","machine learning","ml","data analysis","data science","tensorflow","pytorch","excel","power bi","tableau","statistics","nlp","deep learning","data visualization","data entry"],
  "Communication": ["communication","public speaking","writing","content writing","presentation","documentation","teamwork","translation"],
  "Problem Solving": ["problem solving","algorithm","critical thinking","debugging","analytical"]
};

const ROLE_TARGETS = {
  "AI/ML Developer": { "Programming": 80, "Web Development": 50, "Data/AI": 90, "Communication": 70, "Problem Solving": 85, "Domain Knowledge": 65, "Project Experience": 75 },
  "Full-Stack Developer": { "Programming": 80, "Web Development": 90, "Data/AI": 40, "Communication": 65, "Problem Solving": 75, "Domain Knowledge": 55, "Project Experience": 80 },
  "Data Analyst": { "Programming": 55, "Web Development": 30, "Data/AI": 85, "Communication": 70, "Problem Solving": 75, "Domain Knowledge": 65, "Project Experience": 65 },
  "Backend Developer": { "Programming": 85, "Web Development": 70, "Data/AI": 45, "Communication": 60, "Problem Solving": 80, "Domain Knowledge": 55, "Project Experience": 75 },
  "Frontend Developer": { "Programming": 60, "Web Development": 90, "Data/AI": 30, "Communication": 70, "Problem Solving": 65, "Domain Knowledge": 50, "Project Experience": 70 },
  "Product / Business Analyst": { "Programming": 40, "Web Development": 30, "Data/AI": 60, "Communication": 85, "Problem Solving": 75, "Domain Knowledge": 75, "Project Experience": 65 }
};

// Skills a role most needs, used to seed "skills you should learn next"
// when the marketplace itself doesn't have enough live tasks to draw from.
const ROLE_CORE_SKILLS = {
  "AI/ML Developer": ["Python", "Pandas", "Machine Learning", "SQL", "Data Visualization"],
  "Full-Stack Developer": ["React", "Node.js", "SQL", "Git/GitHub", "REST API"],
  "Data Analyst": ["SQL", "Excel", "Pandas", "Data Visualization", "Statistics"],
  "Backend Developer": ["Node.js", "SQL", "REST API", "Git/GitHub", "System Design"],
  "Frontend Developer": ["React", "CSS", "JavaScript", "Accessibility", "Git/GitHub"],
  "Product / Business Analyst": ["Communication", "SQL", "Documentation", "Data Visualization", "Presentation"]
};

function norm(v) { return String(v || "").trim().toLowerCase(); }

function matchedSkillsForCategory(skills, category) {
  const kws = KEYWORDS[category] || [];
  return skills.filter(s => {
    const ns = norm(s);
    return kws.some(k => ns.includes(k) || k.includes(ns));
  });
}

function completedProjectsFor(studentId) {
  return getProjects().filter(p => p.studentId === studentId && p.status === "Completed");
}

function activeOrDoneProjectsFor(studentId) {
  return getProjects().filter(p => p.studentId === studentId);
}

/** Derive the student's *current* level (0-100) in every skill category. */
export function computeCurrentLevels(student) {
  const skills = (student?.skills || []).filter(Boolean);
  const completed = completedProjectsFor(student?.id).length;
  const experience = Number(student?.experienceScore || 0);

  const levels = {};
  for (const category of SKILL_CATEGORIES) {
    if (category === "Domain Knowledge") {
      const hasCourse = Boolean(student?.course);
      levels[category] = Math.min(95, 35 + (hasCourse ? 15 : 0) + Math.min(30, completed * 10));
      continue;
    }
    if (category === "Project Experience") {
      levels[category] = Math.min(95, 15 + completed * 18 + Math.min(20, experience));
      continue;
    }
    if (category === "Communication") {
      const matched = matchedSkillsForCategory(skills, category);
      const bioBonus = (student?.bio || "").length > 60 ? 15 : (student?.bio || "").length > 0 ? 8 : 0;
      levels[category] = Math.min(95, (matched.length ? 45 : 25) + bioBonus + Math.min(20, completed * 7));
      continue;
    }
    const matched = matchedSkillsForCategory(skills, category);
    const base = matched.length ? 35 : 15;
    const bonus = Math.min(45, matched.length * 15);
    const experienceBonus = Math.min(20, completed * 7);
    levels[category] = Math.min(95, base + bonus + experienceBonus);
  }
  return levels;
}

/** Derive the student's *target* level per category from their stated goal. */
export function computeTargetLevels(student, currentLevels) {
  const role = student?.targetRole;
  if (role && ROLE_TARGETS[role]) return { ...ROLE_TARGETS[role] };
  const generic = {};
  for (const category of SKILL_CATEGORIES) {
    generic[category] = Math.min(90, Math.max(65, (currentLevels[category] || 0) + 20));
  }
  return generic;
}

function priorityFor(gap) {
  if (gap >= 30) return "High";
  if (gap >= 15) return "Medium";
  return "Low";
}

/**
 * Full skill-gap analysis for a student: per-category current vs target,
 * ranked list of top gaps, and a plain-language current/target profile
 * summary the UI can render directly.
 */
export function analyzeSkillGaps(student) {
  const current = computeCurrentLevels(student);
  const target = computeTargetLevels(student, current);

  const categories = SKILL_CATEGORIES.map(name => {
    const cur = current[name];
    const tgt = target[name];
    const gap = Math.max(0, tgt - cur);
    return { name, current: cur, target: tgt, gap, priority: priorityFor(gap) };
  });

  const topGaps = [...categories]
    .filter(c => c.gap > 0)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 5);

  const strongest = [...categories].sort((a, b) => b.current - a.current)[0];
  const weakest = topGaps[0] || categories[0];

  const completed = completedProjectsFor(student?.id).length;
  const currentProfile = {
    headline: student?.skills?.length ? `${student.skills.slice(0, 2).join(" & ")} practitioner` : "Building an initial skill profile",
    points: [
      student?.skills?.length ? `Skills: ${student.skills.join(", ")}` : "No skills listed yet",
      completed ? `${completed} completed SkillSprint project${completed > 1 ? "s" : ""}` : "No completed projects yet",
      `Strongest area: ${strongest.name} (${strongest.current}%)`
    ]
  };
  const targetProfile = {
    headline: student?.targetRole || "Target role not set",
    points: [
      student?.targetSkills?.length ? `Target skills: ${student.targetSkills.join(", ")}` : `Focus area to close first: ${weakest.name}`,
      `Target ${weakest.name} level: ${weakest.target}%`,
      "Goal: verified real-world experience that matches the target role"
    ]
  };

  return { categories, topGaps, currentProfile, targetProfile };
}

/**
 * Recommend real, existing published tasks that close the student's
 * biggest skill gaps — never invents tasks.
 */
export function recommendNextTasks(student, gapAnalysis, limit = 3) {
  const gapByCategory = Object.fromEntries(gapAnalysis.categories.map(c => [c.name, c.gap]));
  const tasks = getPublishedTasks();

  const scored = tasks.map(task => {
    const touched = new Set();
    for (const skill of task.requiredSkills || []) {
      for (const category of SKILL_CATEGORIES) {
        if (matchedSkillsForCategory([skill], category).length) touched.add(category);
      }
    }
    const touchedList = [...touched];
    const gapWeight = touchedList.length
      ? touchedList.reduce((sum, c) => sum + (gapByCategory[c] || 0), 0) / touchedList.length
      : 0;
    const match = student?.role === "student" || student?.skills ? calculateMatch(student, task).total : 0;
    const combined = gapWeight * 0.65 + match * 0.35;
    const improvement = Math.max(2, Math.min(18, Math.round(gapWeight / 6)));
    return { task, touchedList, gapWeight, match, combined, improvement };
  });

  return scored
    .filter(s => s.gapWeight > 0)
    .sort((a, b) => b.combined - a.combined)
    .slice(0, limit)
    .map(s => ({
      task: s.task,
      matchScore: s.match,
      skillsGained: s.task.requiredSkills || [],
      improvement: s.improvement,
      reason: `Closes your ${s.touchedList.join(" & ") || "skill"} gap` +
        (s.match ? ` and is already a ${s.match}% profile match.` : ".")
    }));
}

/** Recommend individual skills (not just categories) the student should learn next. */
export function recommendSkills(student, gapAnalysis, limit = 5) {
  const existing = new Set((student?.skills || []).map(norm));
  const gapByCategory = Object.fromEntries(gapAnalysis.categories.map(c => [c.name, c]));

  const candidates = new Map(); // skill -> { category, sources: [taskTitle] }
  for (const task of getPublishedTasks()) {
    for (const skill of task.requiredSkills || []) {
      if (existing.has(norm(skill))) continue;
      let category = "Other";
      for (const c of SKILL_CATEGORIES) {
        if (matchedSkillsForCategory([skill], c).length) { category = c; break; }
      }
      if (!candidates.has(skill)) candidates.set(skill, { category, sources: [] });
      if (candidates.get(skill).sources.length < 2) candidates.get(skill).sources.push(task.title);
    }
  }

  const role = student?.targetRole;
  for (const skill of ROLE_CORE_SKILLS[role] || []) {
    if (existing.has(norm(skill)) && !candidates.has(skill)) continue;
    if (!candidates.has(skill)) {
      let category = "Other";
      for (const c of SKILL_CATEGORIES) {
        if (matchedSkillsForCategory([skill], c).length) { category = c; break; }
      }
      candidates.set(skill, { category, sources: [] });
    }
  }

  const ranked = [...candidates.entries()]
    .map(([skill, info]) => {
      const cat = gapByCategory[info.category];
      const priority = cat ? cat.gap : 20;
      return {
        skill,
        category: info.category,
        currentLevel: cat ? cat.current : 20,
        targetLevel: cat ? cat.target : 70,
        priority,
        relatedTasks: info.sources,
        why: role
          ? `Closes part of your ${info.category} gap toward becoming a ${role}.`
          : `Closes part of your ${info.category} gap and appears in live SkillSprint tasks.`
      };
    })
    .sort((a, b) => b.priority - a.priority)
    .slice(0, limit);

  return ranked;
}

/** 4-week roadmap built only from the student's own data — no filler. */
export function generateCareerRoadmap(student, gapAnalysis, recommendedSkills, recommendedTasks) {
  const topSkill = recommendedSkills[0];
  const secondSkill = recommendedSkills[1];
  const firstTask = recommendedTasks[0];
  const secondTask = recommendedTasks[1];

  return [
    {
      week: "Week 1",
      stage: "Skill Foundation",
      detail: topSkill
        ? `Learn the fundamentals of ${topSkill.skill} — it's your highest-priority gap in ${topSkill.category}.`
        : "Review your profile and confirm your target role so recommendations can be tailored further."
    },
    {
      week: "Week 2",
      stage: "Practice Task",
      detail: secondSkill
        ? `Do a small self-directed practice exercise using ${secondSkill.skill} before applying it on a real task.`
        : "Practice your strongest skill on a small self-directed exercise to stay sharp."
    },
    {
      week: "Week 3",
      stage: "Real-world SkillSprint Task",
      detail: firstTask
        ? `Apply to "${firstTask.task.title}" — it's projected to improve your profile by about +${firstTask.improvement}%.`
        : "Check the marketplace regularly — a task matching your gaps isn't live yet."
    },
    {
      week: "Week 4",
      stage: "Project / Portfolio Upgrade",
      detail: secondTask
        ? `Complete the task, then add it plus "${secondTask.task.title}" (if selected) to your portfolio and profile.`
        : "Document the completed work in your portfolio and update your SkillSprint profile bio."
    }
  ];
}

/** Short, explainable narrative for the "Upgrade My Profile with AI" button. */
export function generateProfileUpgrade(student, gapAnalysis, recommendedSkills, recommendedTasks) {
  const strongest = [...gapAnalysis.categories].sort((a, b) => b.current - a.current)[0];
  const weakest = gapAnalysis.topGaps[0];
  const skillNames = recommendedSkills.slice(0, 2).map(s => s.skill).join(" + ");
  const taskCount = recommendedTasks.length;
  const roleText = student?.targetRole ? ` for ${student.targetRole} opportunities` : "";

  if (!weakest) {
    return `Your profile is well balanced across the skills SkillSprint tracks, with ${strongest.name} as your strongest area (${strongest.current}%). Keep completing tasks to build verified experience${roleText}.`;
  }

  return `Your profile is strong in ${strongest.name} (${strongest.current}%) but has a ${weakest.priority.toLowerCase()} gap in ${weakest.name} (${weakest.gap}% below target)${roleText}. ` +
    (skillNames ? `Learning ${skillNames}` : "Picking up a couple of targeted skills") +
    (taskCount ? ` and completing ${taskCount} recommended SkillSprint task${taskCount > 1 ? "s" : ""}` : "") +
    ` could meaningfully close that gap.`;
}
