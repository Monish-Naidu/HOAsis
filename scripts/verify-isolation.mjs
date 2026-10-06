/**
 * Proves one association cannot see, change or add to another's rows.
 *
 * verify-rls.mjs checks the policies it knows about by name. This one does
 * not know any names: it reads the generated database types, finds every
 * table and view that carries an association_id, founds two associations
 * through the same RPC the wizard uses, and then, signed in as the President
 * of the first, tries to read every one of those tables scoped to the second.
 * A table added next month with no policy fails here the same day.
 *
 * Also asks the database itself which tables have row level security off
 * (tables_without_rls, service role only) and expects the answer to be none.
 *
 * Runs against the real project. It creates data and deletes it after.
 */

import { readFileSync } from "node:fs";
import { createHarness } from "./lib/harness.mjs";

const {
  admin, anon, stamp, check, cleanup, makeUser, cleanupAll, report,
} = createHarness({
  passwordPrefix: "isolate-",
  emailTag: "isolate",
  swallowUserDeleteErrors: false,
});

/* ------------------------------------------------------- what to look at */

/** Every public table and view with an association_id column, from the types. */
function scopedRelations() {
  const types = readFileSync(
    new URL("../src/lib/supabase/database.types.ts", import.meta.url),
    "utf8",
  );
  const pub = types.slice(types.indexOf("\n  public: {"));
  const section = (from, to) => pub.slice(pub.indexOf(from), pub.indexOf(to));
  const names = (block) =>
    [...block.matchAll(/\n {6}([a-z_]+): \{\n {8}Row: \{([\s\S]*?)\n {8}\}/g)]
      .filter((m) => /\n\s+association_id\??:/.test(m[2]))
      .map((m) => m[1]);
  return {
    tables: names(section("Tables: {", "Views: {")),
    views: names(section("Views: {", "Functions: {")),
  };
}

/* ----------------------------------------------------------------- setup */

async function found(president, name) {
  const { data, error } = await president.client.rpc("create_association", {
    p_name: name,
    p_city: "Bothell",
    p_state: "WA",
    p_dues_cents: 6000,
    p_dues_cadence: "monthly",
    p_due_day: 1,
    p_founder_name: "Founder",
    p_founder_unit: "1",
    p_households: [{ name: "Neighbor", email: `neighbor-${name.toLowerCase().replace(/\W/g, "")}-${stamp}@example.com`, unit: "2" }],
    p_property_type: "single-family",
    p_origin: "builder",
  });
  if (error) throw new Error(`found ${name}: ${error.message}`);
  cleanup.associations.push(data);
  return data;
}

/* --------------------------------------------------------------- the run */

try {
  const { tables, views } = scopedRelations();
  check("types list scoped tables", tables.length > 20, `${tables.length} tables, ${views.length} views`);

  const alpha = await makeUser("alpha");
  const beta = await makeUser("beta");
  const A = await found(alpha, "Alpha Ridge");
  const B = await found(beta, "Beta Hollow");

  // Give B a row in as many tables as the RPCs make cheap, so there is
  // something to leak. Units and memberships exist already from founding.
  await beta.client.rpc("issue_assessment", { p_association_id: B, p_label: "Dues", p_due_on: "2026-09-01" });
  await beta.client.from("announcements").insert({ association_id: B, author_name: "Beta", category: "Notice", title: "Private to Beta", body: "x", posted_on: "2026-09-01" });
  await beta.client.from("vendors").insert({ association_id: B, name: "Beta Landscaping", service: "Landscaping", default_category: "landscaping" });
  await beta.client.from("bank_accounts").insert({ association_id: B, kind: "operating", institution: "Beta CU", mask: "0001" });

  // 1. The database's own word on coverage.
  const { data: uncovered, error: rlsError } = await admin.rpc("tables_without_rls");
  check("every public table has row level security on", !rlsError && (uncovered ?? []).length === 0,
    rlsError ? rlsError.message : (uncovered ?? []).map((r) => r.table_name).join(", ") || "none uncovered");

  // 2. Signed in as A's President, every scoped table and view reads empty for B.
  for (const rel of [...tables, ...views]) {
    const { data, error } = await alpha.client.from(rel).select("*").eq("association_id", B);
    // A permission error is as good as an empty answer; a row is a leak.
    const leaked = (data ?? []).length;
    check(`read ${rel} scoped to the other association`, leaked === 0, error ? `refused: ${error.message}` : `${leaked} rows`);
  }

  // 3. Unscoped reads never carry a B row either.
  for (const rel of tables) {
    const { data } = await alpha.client.from(rel).select("association_id").limit(1000);
    const leaked = (data ?? []).filter((r) => r.association_id === B).length;
    check(`unscoped read of ${rel} shows no rows from the other association`, leaked === 0, `${leaked} rows`);
  }

  // 4. Writes into B, as A's President.
  {
    const { data } = await alpha.client.from("associations").update({ name: "Renamed by Alpha" }).eq("id", B).select("id");
    const { data: after } = await admin.from("associations").select("name").eq("id", B).single();
    check("cannot rename the other association", (data ?? []).length === 0 && after.name === "Beta Hollow", after.name);
  }
  {
    const { data, error } = await alpha.client.from("units").insert({ association_id: B, label: "99" }).select("id");
    check("cannot add a home to the other association", Boolean(error) || (data ?? []).length === 0, error?.code ?? "inserted");
  }
  {
    const { data, error } = await alpha.client.from("announcements").insert({ association_id: B, author_name: "Alpha", category: "Notice", title: "Planted", body: "x", posted_on: "2026-09-01" }).select("id");
    check("cannot post an announcement in the other association", Boolean(error) || (data ?? []).length === 0, error?.code ?? "inserted");
  }
  {
    const { error } = await alpha.client.rpc("issue_assessment", { p_association_id: B, p_label: "Fake", p_due_on: "2026-09-01" });
    check("cannot bill the other association's homes", Boolean(error), error?.message ?? "issued");
  }
  {
    const { data: units } = await admin.from("units").select("id").eq("association_id", B);
    const { error } = await alpha.client.from("memberships").update({ role: "president" }).eq("unit_id", units[0].id);
    const { data: roles } = await admin.from("memberships").select("role, profile_id").eq("association_id", B);
    const stillBeta = roles.some((m) => m.role === "president" && m.profile_id === beta.id);
    check("cannot seize the other association's presidency", stillBeta, error?.code ?? "no error, but unchanged");
  }

  // 4b. A home cannot be claimed across the line: a row whose unit is in B
  //     and whose association is A is refused, whoever writes it. Without
  //     this, memberships_write (no with-check) let a President seat
  //     themselves at another association's home and my_unit_ids() then
  //     opened that home's charges to them.
  {
    const { data: units } = await admin.from("units").select("id").eq("association_id", B).limit(1);
    const foreignUnit = units[0].id;
    const { data, error } = await alpha.client
      .from("memberships")
      .insert({ association_id: A, unit_id: foreignUnit, profile_id: alpha.id, full_name: "Alpha", role: "resident" })
      .select("id");
    check("cannot seat myself at the other association's home", Boolean(error) || (data ?? []).length === 0, error?.code ?? "inserted");
    const { data: charges } = await alpha.client.from("charges").select("id").eq("unit_id", foreignUnit);
    check("the other association's charges stay closed by unit", (charges ?? []).length === 0, `${(charges ?? []).length} rows`);
    const { error: adminError } = await admin
      .from("payments")
      .insert({ association_id: A, unit_id: foreignUnit, amount_cents: 100, rail: "check", state: "pending" });
    check("even the service role cannot record a payment against a home in another association", Boolean(adminError), adminError?.message ?? "inserted");
    await admin.from("memberships").delete().eq("unit_id", foreignUnit).eq("association_id", A);
  }

  // 4c. A name is a label, so a second "Beta Hollow" is allowed, and the
  //     public lookup that warns about it says name, town and slug only.
  {
    const { data, error } = await anon().rpc("associations_named", { p_name: "  beta   HOLLOW " });
    const rows = data ?? [];
    const keys = rows.length ? Object.keys(rows[0]).sort().join(",") : "";
    check("associations_named finds the name regardless of case and spacing", !error && rows.some((r) => r.slug && r.name === "Beta Hollow"), error?.message ?? `${rows.length} rows`);
    check("associations_named discloses name, city, state and slug only", !rows.length || keys === "city,name,slug,state", keys);
  }

  // 5. The list of associations a person belongs to is theirs alone.
  {
    const { data } = await alpha.client.rpc("my_associations");
    const ids = (data ?? []).map((r) => r.association_id);
    check("my_associations lists only my own", ids.includes(A) && !ids.includes(B), ids.join(","));
  }

  // 6. Files. The documents bucket is private and keyed by association.
  {
    const { data, error } = await alpha.client.storage.from("documents").list(B);
    check("cannot list the other association's document files", !error && (data ?? []).length === 0, error?.message ?? `${(data ?? []).length} objects`);
  }
} catch (error) {
  check("suite ran to completion", false, error.message);
} finally {
  await cleanupAll();
}

/* ---------------------------------------------------------------- report */

report({
  line: (r) => (r.passed ? null : `  ✗ ${r.name}${r.detail ? `  (${r.detail})` : ""}`),
  summary: ({ passed, total, failures }) =>
    `\nisolation: ${passed}/${total} checks passed${failures ? `, ${failures} FAILED` : ""}`,
});
