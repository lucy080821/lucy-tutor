// Trial/monthly-lock rules for free-standing (classless) students — see CLAUDE.md.
// Only applies to students who signed up on/after this cutoff and never joined a classroom.
const FREE_TRIAL_CUTOFF = new Date('2026-08-01T00:00:00+07:00');
const TRIAL_DAYS = 3;

function isCutoffReached(at = new Date()) {
  return at >= FREE_TRIAL_CUTOFF;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addOneMonth(date) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  return d;
}

// user must include: role, classroomsJoined (array, at least length), accessExpiresAt
function computeAccessStatus(user) {
  const isFreeStudent = user.role === 'STUDENT' && (!user.classroomsJoined || user.classroomsJoined.length === 0) && !!user.accessExpiresAt;
  if (!isFreeStudent) {
    return { accessLocked: false, accessDaysRemaining: null };
  }
  const msRemaining = new Date(user.accessExpiresAt).getTime() - Date.now();
  const accessDaysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
  return { accessLocked: msRemaining <= 0, accessDaysRemaining };
}

module.exports = { FREE_TRIAL_CUTOFF, TRIAL_DAYS, isCutoffReached, addDays, addOneMonth, computeAccessStatus };
