// Single shared PrismaClient for the whole backend. Each `new PrismaClient()` opens its own
// connection pool (and pays its own ~1.5s cold connect to Supabase), so per-route instances
// multiplied pools against the pgbouncer pooler and slowed every first request per route.
const { PrismaClient } = require('@prisma/client');

// `omit` keeps the bcrypt hash out of every User query by default, so no route can leak it
// by returning a raw user row. Code that must read it (signin) opts back in with `omit: { password: false }`.
const prisma = global.__lucyPrisma || new PrismaClient({ omit: { user: { password: true } } });
if (process.env.NODE_ENV !== 'production') global.__lucyPrisma = prisma;

module.exports = prisma;
