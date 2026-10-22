/**
 * What must never leave the process, in one place for the log lines
 * (src/lib/log.ts), the rows in app_errors and the spans telemetry.mjs
 * exports. Plain JavaScript with no imports: the container loads
 * telemetry.mjs, and this file with it, before any build output exists,
 * and the same rules also run in the browser and the Edge runtime.
 *
 * Masked: an email keeps its first letter and its domain. Redacted: the
 * value of a query parameter, the whole fragment of a URL or path written
 * anywhere in the text, credentials in a URL, a bearer or
 * basic token, anything shaped like a JWT or a Stripe, Resend or webhook key,
 * and the value after a word like `token=` or `password:`.
 */

const EMAIL = /([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
const URL_CREDENTIALS = /\b([a-z][a-z0-9+.-]*:\/\/)[^\s/?#@]+@/gi;
const QUERY_VALUE = /([?&#;])([^=\s&#;?"'<>]+)=([^&#;\s"'<>]*)/g;
/**
 * A fragment after an address (`https://host/path#...`) or a path
 * (`/resident/pay#...`). Sign-in links carry their tokens there, and a
 * fragment is never sent to a server, so nothing downstream needs it. One
 * made only of `key=value` pairs is left to QUERY_VALUE, which keeps the
 * names; anything else in it goes whole. A closing parenthesis ends it, so
 * a stack frame keeps its shape.
 */
const FRAGMENT_PAIR = String.raw`[A-Za-z0-9_.-]{1,40}=[^\s"'<>\`)&#;]*`;
const FRAGMENT_END = String.raw`[\s"'<>\`)]`;
const FRAGMENT_TAIL = String.raw`#(?!\[redacted\])(?!${FRAGMENT_PAIR}(?:[&;]${FRAGMENT_PAIR})*(?:${FRAGMENT_END}|$))[^\s"'<>\`)]+`;
const URL_FRAGMENT = new RegExp(
  String.raw`(\b[a-z][a-z0-9+.-]*:\/\/[^\s#"'<>\`]*)` + FRAGMENT_TAIL,
  "gi",
);
const PATH_FRAGMENT = new RegExp(String.raw`(^|[\s(="'\`])(\/[^\s#"'<>\`]*)` + FRAGMENT_TAIL, "g");
const AUTH_SCHEME = /\b(Bearer|Basic|Token)\s+[A-Za-z0-9._~+/=-]+/gi;
const JWT = /\beyJ[A-Za-z0-9_-]{10,}(?:\.[A-Za-z0-9_-]*){0,2}/g;
const KEY_SHAPED = /\b(?:(?:sk|rk|pk)_(?:live|test)_|whsec_|re_)[A-Za-z0-9_]{6,}/g;
const CLIENT_SECRET = /\b[A-Za-z0-9]+_[A-Za-z0-9]+_secret_[A-Za-z0-9]+/g;
const NAMED_SECRET =
  /\b(secret|token|access_token|refresh_token|password|passwd|api[_-]?key|authorization|signature)(["']?\s*[:=]\s*["']?)(?!\[redacted\])([^\s"'&,;})\]]+)/gi;

const REDACTED = "[redacted]";

/** `monish@gmail.com` becomes `m***@gmail.com`. Anything else is returned as is. */
export function maskEmail(value) {
  return String(value).replace(EMAIL, (_, first, domain) => `${first}***@${domain}`);
}

/**
 * A string with every secret-shaped part redacted and every email masked.
 * Credentials go before emails, so `user:pass@host` is never half-masked as
 * an address.
 */
export function scrubText(value) {
  return maskEmail(
    String(value)
      .replace(URL_CREDENTIALS, "$1")
      .replace(URL_FRAGMENT, `$1#${REDACTED}`)
      .replace(PATH_FRAGMENT, `$1$2#${REDACTED}`)
      .replace(AUTH_SCHEME, `$1 ${REDACTED}`)
      .replace(JWT, REDACTED)
      .replace(KEY_SHAPED, REDACTED)
      .replace(CLIENT_SECRET, REDACTED)
      .replace(QUERY_VALUE, `$1$2=${REDACTED}`)
      .replace(NAMED_SECRET, `$1$2${REDACTED}`),
  );
}

/**
 * A URL cut to its origin and path: no user info, no query, no fragment.
 * A value that does not parse is cut at the first `?` or `#` and scrubbed,
 * so a malformed URL loses its query rather than keeping it.
 */
export function stripUrl(value) {
  const text = String(value);
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      return scrubText(`${url.protocol}//${url.host}${url.pathname}`);
    } catch {
      // Falls through to the cut below.
    }
  }
  return scrubText(text.split(/[?#]/, 1)[0]);
}

/* ------------------------------------------------------------------- spans */

/** Attributes that hold a whole URL or a path with its query. */
const URL_ATTRIBUTES = new Set([
  "http.url",
  "url.full",
  "url.original",
  "http.target",
  "http.referer",
  "next.url",
]);
/** Attributes that are nothing but query values, SQL or headers. */
const DROPPED_ATTRIBUTES = new Set(["url.query", "db.statement", "db.query.text"]);
const DROPPED_PREFIXES = ["http.request.header.", "http.response.header.", "url.query."];
const SECRET_ATTRIBUTE = /secret|token|password|passwd|authorization|cookie|api[_-]?key/i;

function redactAttributeValue(key, value) {
  if (SECRET_ATTRIBUTE.test(key)) return REDACTED;
  const clean = URL_ATTRIBUTES.has(key) ? stripUrl : scrubText;
  if (typeof value === "string") return clean(value);
  if (Array.isArray(value)) return value.map((v) => (typeof v === "string" ? clean(v) : v));
  return value;
}

/** Scrubs an attribute map in place, which is what reaches the exporter. */
export function redactAttributes(attributes) {
  if (!attributes) return;
  for (const key of Object.keys(attributes)) {
    if (DROPPED_ATTRIBUTES.has(key) || DROPPED_PREFIXES.some((p) => key.startsWith(p))) {
      delete attributes[key];
      continue;
    }
    const next = redactAttributeValue(key, attributes[key]);
    if (next !== attributes[key]) attributes[key] = next;
  }
}

/**
 * Scrubs a span in place: its name, attributes, event attributes (an
 * exception's message and stack) and status message. Trace and span ids,
 * kind, timing, method, status code and the path are left as they are.
 */
export function redactSpan(span) {
  redactAttributes(span.attributes);
  for (const event of span.events ?? []) redactAttributes(event.attributes);
  if (typeof span.name === "string") {
    const name = scrubText(span.name);
    if (name !== span.name) span.name = name;
  }
  if (span.status && typeof span.status.message === "string") {
    span.status = { ...span.status, message: scrubText(span.status.message) };
  }
}

/**
 * A span processor that scrubs every span before anything downstream reads
 * it. Order matters: the distro puts its own live-metrics processor first
 * and the Azure exporter last, and `onEnding` runs for every processor
 * before any `onEnd`, so by the time either sees the span it is already
 * clean. `onStart` covers the attributes an instrumentation sets when the
 * span opens; `onEnd` is the backstop for an SDK without `onEnding`.
 */
export class RedactingSpanProcessor {
  onStart(span) {
    redactSpan(span);
  }
  onEnding(span) {
    redactSpan(span);
  }
  onEnd(span) {
    redactSpan(span);
  }
  forceFlush() {
    return Promise.resolve();
  }
  shutdown() {
    return Promise.resolve();
  }
}
