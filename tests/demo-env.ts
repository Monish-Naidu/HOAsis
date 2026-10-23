/**
 * Runs before every other setup file, so before anything under src/ is
 * imported and reads its configuration at module load.
 *
 * The unit and integration suites test the signed-out demo. A shell that has a
 * real backend loaded (a local stack, or production through .env.local) used to
 * leak into them: the demo sign-in and join tests then called that Auth server
 * and failed, or worse, passed against it. Tests that need one of these values
 * set it themselves.
 */
const BACKEND_VARIABLES = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
  "NEXT_PUBLIC_TEST_LOGINS",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_BILLING_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "RESEND_WEBHOOK_SECRET",
  "CRON_SECRET",
  "APPLICATIONINSIGHTS_CONNECTION_STRING",
];

for (const name of BACKEND_VARIABLES) delete process.env[name];
