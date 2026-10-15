/**
 * Copies every file in the hosted project's storage buckets to the Azure
 * stack's storage service, through the two storage APIs with the service
 * key. The target writes its own storage.objects rows, which is why the
 * migrate job leaves that table's data behind.
 *
 *   node scripts/azure/copy-storage.mjs https://<hosted>.supabase.co https://<azure stack>
 *
 * Reads SUPABASE_SERVICE_ROLE_KEY from .env.azure (it is the same key on
 * both sides, because the JWT secret is reused). Safe to run again: uploads
 * replace.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const [source, target] = process.argv.slice(2);
if (!source || !target) {
  console.error("usage: node scripts/azure/copy-storage.mjs <source url> <target url>");
  process.exit(1);
}
const env = Object.fromEntries(
  readFileSync(new URL("../../.env.azure", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => {
      const i = l.indexOf("=");
      return [
        l.slice(0, i),
        l
          .slice(i + 1)
          .replace(/^["']|["']$/g, "")
          .replace(/\s+#.*$/, ""),
      ];
    }),
);
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing from .env.azure");

const from = createClient(source, key, { auth: { persistSession: false } });
const to = createClient(target, key, { auth: { persistSession: false } });

async function* walk(client, bucket, prefix = "") {
  let offset = 0;
  for (;;) {
    const { data, error } = await client.storage.from(bucket).list(prefix, { limit: 1000, offset });
    if (error) throw new Error(`${bucket}/${prefix}: ${error.message}`);
    if (!data.length) return;
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      // A folder has no id; a file does.
      if (item.id) yield { path, contentType: item.metadata?.mimetype };
      else yield* walk(client, bucket, path);
    }
    if (data.length < 1000) return;
    offset += data.length;
  }
}

const { data: buckets, error } = await from.storage.listBuckets();
if (error) throw error;
let copied = 0;
for (const bucket of buckets) {
  const { data: existing } = await to.storage.getBucket(bucket.id);
  if (!existing) {
    const { error: e } = await to.storage.createBucket(bucket.id, {
      public: bucket.public,
      fileSizeLimit: bucket.file_size_limit ?? undefined,
      allowedMimeTypes: bucket.allowed_mime_types ?? undefined,
    });
    if (e) throw new Error(`create bucket ${bucket.id}: ${e.message}`);
  }
  for await (const file of walk(from, bucket.id)) {
    const { data: blob, error: dl } = await from.storage.from(bucket.id).download(file.path);
    if (dl) throw new Error(`download ${bucket.id}/${file.path}: ${dl.message}`);
    const { error: up } = await to.storage
      .from(bucket.id)
      .upload(file.path, blob, { upsert: true, contentType: file.contentType });
    if (up) throw new Error(`upload ${bucket.id}/${file.path}: ${up.message}`);
    copied += 1;
    console.log(`${bucket.id}/${file.path}`);
  }
}
console.log(`${copied} files copied across ${buckets.length} buckets`);
