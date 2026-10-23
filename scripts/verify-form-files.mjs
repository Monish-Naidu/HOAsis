/**
 * Form files (0130): the board's settings upload keeps the bytes in the
 * private documents bucket under the association's forms folder, and the
 * forms row is what lets a member open them.
 *
 * A settings holder uploads, reads and removes; a resident of the same
 * association reads through the row; a resident can neither add, replace nor
 * delete the file and cannot write the row; another association's member, a
 * signed-out caller and an ended seat get nothing.
 */
import { createHash, randomUUID } from "node:crypto";
import { createHarness } from "./lib/harness.mjs";

const { admin, anon, env, check, makeUser, cleanup, cleanupAll, report } = createHarness({
  passwordPrefix: "formfile-",
  emailTag: "formfile",
  claimSeats: true,
});

// A small PDF-shaped fixture with known bytes.
const PDF = Buffer.from("%PDF-1.4\nform file fixture, byte counted\n%%EOF\n");
const sha = (buf) => createHash("sha256").update(buf).digest("hex");

async function text_of(blob) {
  return Buffer.from(await blob.arrayBuffer());
}

try {
  const president = await makeUser("president");
  const owner = await makeUser("owner");
  const outsider = await makeUser("outsider");

  const { data: associationId, error: createError } = await president.client.rpc(
    "create_association",
    {
      p_name: "Form Files Test HOA",
      p_city: "Bothell",
      p_state: "WA",
      p_dues_cents: 6000,
      p_dues_cadence: "monthly",
      p_due_day: 1,
      p_founder_name: "Pat Founder",
      p_founder_unit: "1",
      p_households: [{ name: "Olive Owner", email: owner.email, unit: "2" }],
    },
  );
  if (createError) throw new Error(createError.message);
  cleanup.associations.push(associationId);
  await owner.client.rpc("claim_my_seats");

  // A second association, so "another tenant" is a real member of something.
  const { data: otherId, error: otherError } = await outsider.client.rpc("create_association", {
    p_name: "Other HOA",
    p_city: "Bothell",
    p_state: "WA",
    p_dues_cents: 5000,
    p_dues_cadence: "monthly",
    p_due_day: 1,
    p_founder_name: "Otis Other",
    p_founder_unit: "1",
    p_households: [],
  });
  if (otherError) throw new Error(otherError.message);
  cleanup.associations.push(otherId);

  // ------------------------------------------------- the board saves a form
  const formId = randomUUID();
  const path = `${associationId}/forms/${formId}.pdf`;
  const { error: uploadError } = await president.client.storage
    .from("documents")
    .upload(path, PDF, { contentType: "application/pdf" });
  check("the board uploads the file", !uploadError, uploadError?.message ?? "");

  const { error: rowError } = await president.client.from("forms").insert({
    id: formId,
    association_id: associationId,
    label: "Pool rules",
    file_name: "pool-rules.pdf",
    size_label: `${PDF.length} B`,
    storage_path: path,
  });
  check("and the row learns the file's path", !rowError, rowError?.message ?? "");

  const { data: ownRead, error: ownReadError } = await president.client.storage
    .from("documents")
    .download(path);
  check(
    "the board reads back byte-identical contents",
    !ownReadError && ownRead && sha(await text_of(ownRead)) === sha(PDF),
    ownReadError?.message ?? "bytes differ",
  );
  const { data: ownSign, error: ownSignError } = await president.client.storage
    .from("documents")
    .createSignedUrl(path, 60);
  check(
    "and is issued a signed link",
    !ownSignError && Boolean(ownSign?.signedUrl),
    ownSignError?.message ?? "",
  );

  // ---------------------------------------------- a resident reads the file
  const { data: residentRead, error: residentReadError } = await owner.client.storage
    .from("documents")
    .download(path);
  check(
    "a resident of the association reads the same bytes",
    !residentReadError && residentRead && sha(await text_of(residentRead)) === sha(PDF),
    residentReadError?.message ?? "bytes differ",
  );
  const { data: residentSign, error: residentSignError } = await owner.client.storage
    .from("documents")
    .createSignedUrl(path, 60);
  check(
    "and is issued a signed link",
    !residentSignError && Boolean(residentSign?.signedUrl),
    residentSignError?.message ?? "",
  );

  // --------------------------------- a resident cannot manage board forms
  const { error: residentUpload } = await owner.client.storage
    .from("documents")
    .upload(`${associationId}/forms/${randomUUID()}.pdf`, PDF, { contentType: "application/pdf" });
  check(
    "a resident cannot add a form file",
    Boolean(residentUpload),
    residentUpload?.message ?? "uploaded",
  );
  const { error: residentReplace } = await owner.client.storage
    .from("documents")
    .update(path, Buffer.from("replaced"), { contentType: "application/pdf" });
  check(
    "a resident cannot replace it",
    Boolean(residentReplace),
    residentReplace?.message ?? "replaced",
  );
  const { error: residentDelete } = await owner.client.storage.from("documents").remove([path]);
  const { data: stillThere } = await admin.storage.from("documents").download(path);
  check(
    "a resident cannot delete it",
    stillThere && stillThere.size === PDF.length,
    residentDelete?.message ?? "deleted",
  );
  const { error: residentRow } = await owner.client.from("forms").insert({
    id: randomUUID(),
    association_id: associationId,
    label: "Forged form",
    file_name: "forged.pdf",
    size_label: "1 KB",
    storage_path: `${associationId}/forms/${randomUUID()}.pdf`,
  });
  check(
    "a resident cannot write the row",
    Boolean(residentRow),
    residentRow?.message ?? "inserted",
  );

  // ------------------------------------------- another tenant gets nothing
  const { data: crossRead, error: crossReadError } = await outsider.client.storage
    .from("documents")
    .download(path);
  check(
    "another association's member cannot read it",
    Boolean(crossReadError) || !crossRead,
    crossReadError?.message ?? "read it",
  );
  const { data: crossSign, error: crossSignError } = await outsider.client.storage
    .from("documents")
    .createSignedUrl(path, 60);
  check(
    "nor is issued a signed link",
    Boolean(crossSignError) || !crossSign?.signedUrl,
    crossSignError?.message ?? "signed",
  );
  const { error: crossWrite } = await outsider.client.storage
    .from("documents")
    .upload(`${associationId}/forms/${randomUUID()}.pdf`, PDF, { contentType: "application/pdf" });
  check(
    "nor can write into the other association's folder",
    Boolean(crossWrite),
    crossWrite?.message ?? "uploaded",
  );

  // ------------------------------------------------- signed out gets nothing
  const signedOut = anon();
  const { data: anonRead, error: anonReadError } = await signedOut.storage
    .from("documents")
    .download(path);
  check(
    "a signed-out caller cannot read it",
    Boolean(anonReadError) || !anonRead,
    anonReadError?.message ?? "read it",
  );
  const { data: anonSign, error: anonSignError } = await signedOut.storage
    .from("documents")
    .createSignedUrl(path, 60);
  check(
    "nor is issued a signed link",
    Boolean(anonSignError) || !anonSign?.signedUrl,
    anonSignError?.message ?? "signed",
  );
  // The direct object path, no bearer at all.
  const direct = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/documents/${path}`);
  check(
    "the unsigned object path answers with a refusal",
    direct.status >= 400,
    String(direct.status),
  );

  // ------------------------------------------------------- the seat that ended
  const { error: endError } = await admin
    .from("memberships")
    .update({ ends_on: new Date().toISOString().slice(0, 10) })
    .eq("association_id", associationId)
    .eq("profile_id", owner.id);
  if (endError) throw new Error(endError.message);
  const { data: endedRead, error: endedReadError } = await owner.client.storage
    .from("documents")
    .download(path);
  check(
    "an ended seat can no longer read it",
    Boolean(endedReadError) || !endedRead,
    endedReadError?.message ?? "read it",
  );
  const { data: endedSign, error: endedSignError } = await owner.client.storage
    .from("documents")
    .createSignedUrl(path, 60);
  check(
    "nor be issued a signed link",
    Boolean(endedSignError) || !endedSign?.signedUrl,
    endedSignError?.message ?? "signed",
  );

  await admin.storage.from("documents").remove([path]);
} catch (error) {
  check("the run finished", false, error.message);
} finally {
  await cleanupAll();
}

report();
