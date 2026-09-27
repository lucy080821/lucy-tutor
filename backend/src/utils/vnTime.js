// Shared helper for parsing datetime strings that came from an <input type="datetime-local">
// (publishTime/deadline on exams & lessons, class session start/end times, etc). Those inputs
// always produce a naive "YYYY-MM-DDTHH:mm[:ss]" string with no timezone info — `new Date(str)`
// on that string is parsed as local time OF THE NODE PROCESS, not the teacher's/student's local
// time. This app's whole userbase is in Vietnam (UTC+7), but this backend's default deployment
// (Render, no TZ env var set) runs its Node process in UTC — so parsing naively shifts every
// stored publishTime/deadline/session time by 7 hours from what was actually typed into the form.
function parseVNDateTime(input) {
  if (!input) return null;
  const str = String(input);
  // Already carries an explicit UTC/offset marker (e.g. ends in "Z" or "+07:00") — trust it as-is.
  if (/Z$|[+-]\d{2}:\d{2}$/.test(str)) return new Date(str);
  return new Date(`${str}+07:00`);
}

module.exports = { parseVNDateTime };
