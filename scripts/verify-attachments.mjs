/**
 * The attachments bucket (0111): an owner uploads a photo to their own
 * request and the row learns of it; a neighbour can neither read nor add;
 * the board reads it and adds a photo to a notice; a path that names
 * another row is refused; nothing is deleted or replaced by a person.
 */
import { createHarness } from "./lib/harness.mjs";

const {
  admin, check, makeUser, cleanup, cleanupAll, report,
} = createHarness({
  passwordPrefix: "attach-",
  emailTag: "attach",
  claimSeats: true,
});

// A one-pixel PNG.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

try {
  const president = await makeUser("president");
  const owner = await makeUser("owner");
  const neighbor = await makeUser("neighbor");
  const { data: associationId, error: createError } = await president.client.rpc("create_association", {
    p_name: "Attachments Test HOA", p_city: "Bothell", p_state: "WA",
    p_dues_cents: 6000, p_dues_cadence: "monthly", p_due_day: 1,
    p_founder_name: "Pat Founder", p_founder_unit: "1",
    p_households: [
      { name: "Olive Owner", email: owner.email, unit: "2" },
      { name: "Nina Neighbor", email: neighbor.email, unit: "3" },
    ],
  });
  if (createError) throw new Error(createError.message);
  cleanup.associations.push(associationId);
  await owner.client.rpc("claim_my_seats");
  await neighbor.client.rpc("claim_my_seats");
  const { data: units } = await admin.from("units").select("id, label").eq("association_id", associationId);
  const unit2 = units.find((u) => u.label === "2").id;

  const { data: request, error: fileError } = await owner.client.from("requests").insert({
    association_id: associationId, unit_id: unit2, filed_by: owner.id,
    reference: "REQ-ATT-1", kind: "maintenance", title: "Leaking gutter",
  }).select("id").single();
  check("the owner files a request", !fileError && Boolean(request), fileError?.message ?? "");

  // ------------------------------------------------------ the owner adds
  const path = `${associationId}/requests/${request.id}/gutter.png`;
  const { error: uploadError } = await owner.client.storage.from("attachments").upload(path, PNG, { contentType: "image/png" });
  check("the owner uploads to their own request", !uploadError, uploadError?.message ?? "");
  const { error: attachError } = await owner.client.rpc("add_request_attachment", { p_request_id: request.id, p_name: "gutter.png", p_size_bytes: PNG.length, p_path: path });
  check("and the row learns of it", !attachError, attachError?.message ?? "");
  const { data: row } = await admin.from("requests").select("attachments").eq("id", request.id).single();
  check("the attachment carries name, size and path", row.attachments.length === 1 && row.attachments[0].path === path && /KB$/.test(row.attachments[0].size), JSON.stringify(row.attachments));

  const { data: ownRead, error: ownReadError } = await owner.client.storage.from("attachments").download(path);
  check("the owner reads it back", !ownReadError && ownRead && ownRead.size === PNG.length, ownReadError?.message ?? String(ownRead?.size));
  const { data: ownSigned, error: signError } = await owner.client.storage.from("attachments").createSignedUrl(path, 60);
  check("and gets a signed link", !signError && Boolean(ownSigned?.signedUrl), signError?.message ?? "");

  // --------------------------------------------------- the neighbour cannot
  const { data: nRead, error: nReadError } = await neighbor.client.storage.from("attachments").download(path);
  check("a neighbour cannot read it", Boolean(nReadError) || !nRead, nReadError?.message ?? "read it");
  const { error: nUpload } = await neighbor.client.storage.from("attachments").upload(`${associationId}/requests/${request.id}/mine.png`, PNG, { contentType: "image/png" });
  check("a neighbour cannot add to it", Boolean(nUpload), nUpload?.message ?? "no error");
  const { error: nAttach } = await neighbor.client.rpc("add_request_attachment", { p_request_id: request.id, p_name: "mine.png", p_size_bytes: 1, p_path: `${associationId}/requests/${request.id}/mine.png` });
  check("nor tell the row about a file", Boolean(nAttach), nAttach?.message ?? "no error");

  // --------------------------------------------------------- the board can
  const { data: bRead, error: bReadError } = await president.client.storage.from("attachments").download(path);
  check("the board reads it", !bReadError && bRead && bRead.size === PNG.length, bReadError?.message ?? "");
  const { error: ownDelete } = await owner.client.storage.from("attachments").remove([path]);
  const { data: still } = await admin.storage.from("attachments").download(path);
  check("nobody deletes a file by hand", Boolean(still) && still.size === PNG.length, ownDelete?.message ?? "deleted");

  // ------------------------------------------------- the path names the row
  const { error: wrongRow } = await owner.client.rpc("add_request_attachment", { p_request_id: request.id, p_name: "x.png", p_size_bytes: 1, p_path: `${associationId}/requests/${unit2}/x.png` });
  check("a path that names another row is refused", wrongRow?.code === "22023", wrongRow?.message ?? "no error");
  const { error: notUploaded } = await owner.client.rpc("add_request_attachment", { p_request_id: request.id, p_name: "ghost.png", p_size_bytes: 1, p_path: `${associationId}/requests/${request.id}/ghost.png` });
  check("a file that was never uploaded is refused", notUploaded?.code === "P0002", notUploaded?.message ?? "no error");
  const { error: tooBig } = await owner.client.storage.from("attachments").upload(`${associationId}/requests/${request.id}/big.bin`, Buffer.alloc(11 * 1024 * 1024), { contentType: "application/octet-stream" });
  check("an 11 MB file of the wrong type is refused", Boolean(tooBig), tooBig?.message ?? "no error");

  // ------------------------------------------------------ a notice's photo
  const { data: violation } = await admin.from("violations").insert({
    association_id: associationId, unit_id: unit2, reference: "V-ATT-1", rule: "Trash cans", stage: "courtesy",
  }).select("id").single();
  const photoPath = `${associationId}/violations/${violation.id}/cans.png`;
  const { error: oPhoto } = await owner.client.storage.from("attachments").upload(photoPath, PNG, { contentType: "image/png" });
  check("an owner cannot add a photo to a notice", Boolean(oPhoto), oPhoto?.message ?? "no error");
  const { error: bPhoto } = await president.client.storage.from("attachments").upload(photoPath, PNG, { contentType: "image/png" });
  check("the board uploads a photo to a notice", !bPhoto, bPhoto?.message ?? "");
  const { error: photoRow } = await president.client.rpc("add_violation_photo", { p_violation_id: violation.id, p_brief: "Two cans at the curb", p_vantage: "street", p_path: photoPath });
  check("and the notice learns of it", !photoRow, photoRow?.message ?? "");
  const { data: vRow } = await admin.from("violations").select("photos").eq("id", violation.id).single();
  check("the photo carries brief, date, who and path", vRow.photos.length === 1 && vRow.photos[0].path === photoPath && vRow.photos[0].takenBy === "Pat Founder", JSON.stringify(vRow.photos));
  const { data: oPhotoRead, error: oPhotoReadError } = await owner.client.storage.from("attachments").download(photoPath);
  check("the owner of the home reads the notice's photo", !oPhotoReadError && oPhotoRead && oPhotoRead.size === PNG.length, oPhotoReadError?.message ?? "");
  const { data: nPhotoRead, error: nPhotoReadError } = await neighbor.client.storage.from("attachments").download(photoPath);
  check("a neighbour does not", Boolean(nPhotoReadError) || !nPhotoRead, nPhotoReadError?.message ?? "read it");

  // Files go with the association.
  const { data: listed } = await admin.storage.from("attachments").list(`${associationId}/requests/${request.id}`);
  check("the files are listed under the association", (listed ?? []).length === 1, String((listed ?? []).length));
  await admin.storage.from("attachments").remove([path, photoPath]);
} catch (error) {
  check("the run finished", false, error.message);
} finally {
  await cleanupAll();
}

report();
