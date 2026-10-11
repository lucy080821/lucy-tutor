// Single shared PrismaClient for the whole backend. Each `new PrismaClient()` opens its own
// connection pool (and pays its own ~1.5s cold connect to Supabase), so per-route instances
// multiplied pools against the pgbouncer pooler and slowed every first request per route.
const { PrismaClient } = require('@prisma/client');

// `omit` keeps the bcrypt hash (and the plaintext temp password, see utils/tempPassword.js) out of every
// User query by default, so no route can leak them by returning a raw user row. Code that must read them
// opts back in (`omit: { password: false }` in signin, `select: { tempPassword: true }` in the reset lists).
const prisma = global.__lucyPrisma || new PrismaClient({ omit: { user: { password: true, tempPassword: true } } });
if (process.env.NODE_ENV !== 'production') global.__lucyPrisma = prisma;

module.exports = prisma;
