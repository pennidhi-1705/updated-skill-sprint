function norm(v) { return String(v || "").trim().toLowerCase(); }

export function calculateMatch(student, task) {
  const skills = (student?.skills || []).map(norm);
  const required = (task?.requiredSkills || []).map(norm);
  const matched = required.filter(s => skills.includes(s));
  const skill = required.length ? Math.round((matched.length / required.length) * 40) : 0;

  const availability = norm(student?.availability);
  const duration = norm(task?.duration);
  const availabilityScore =
    availability === "flexible" || !availability ? 25 :
    availability.includes("both") ? 25 :
    availability.includes("weekdays") && !duration.includes("weekend") ? 23 :
    availability.includes("weekends") && duration.includes("weekend") ? 23 : 18;

  const remoteCompatible = norm(task?.workMode) === "remote" ||
    norm(student?.location) === norm(task?.location) ||
    norm(task?.workMode) === "hybrid";
  const location = remoteCompatible ? 20 : 8;

  const experience = Math.min(15, Math.max(0, Number(student?.experienceScore || 0)));

  const total = Math.min(100, skill + availabilityScore + location + experience);
  const reasons = [];
  if (matched.length) reasons.push(`Strong match on ${matched.slice(0, 3).join(", ")}.`);
  if (availabilityScore >= 23) reasons.push("Availability is compatible.");
  if (remoteCompatible) reasons.push("Location/work mode is compatible.");
  if (experience) reasons.push("Relevant prior experience is reflected.");
  if (!reasons.length) reasons.push("Limited profile information is available, so the score is conservative.");

  return { total, skill, availability: availabilityScore, location, experience, reasons };
}