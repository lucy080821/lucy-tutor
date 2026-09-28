// Single place for the Groq text model used by every AI feature. Groq retires models without
// notice (llama-3.3-70b-versatile disappeared and silently broke every AI route at once), so
// the id lives here and can be overridden on Render with GROQ_TEXT_MODEL without a code change.
// Check what's available with: groq.models.list()
const GROQ_TEXT_MODEL = process.env.GROQ_TEXT_MODEL || 'openai/gpt-oss-120b';

module.exports = { GROQ_TEXT_MODEL };
