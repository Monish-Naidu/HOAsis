/**
 * A store-only zip writer.
 *
 * The complete records export is a set of CSV files a person hands to an
 * accountant, so it has to arrive as one zip rather than thirty downloads,
 * and no dependency is worth one file type. A zip with no compression
 * ("stored") is only headers and a CRC: every archive tool opens it, and
 * the CSVs inside compress to almost nothing anyway because they are plain
 * text a spreadsheet re-reads.
 *
 * Nothing here touches the clock or the DOM: the timestamp on the archive
 * is passed in, so a test pins it and the demo does not drift.
 */

/** The CRC-32 table, IEEE polynomial, as the zip format specifies it. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) === 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/** CRC-32 of the bytes, unsigned, the way the zip headers record it. */
export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** One file inside the archive. Contents are text; every CSV here is. */
export interface ZipInput {
  name: string;
  contents: string;
}

/** The zip epoch: dates before 1980 have no DOS encoding. */
const DOS_YEAR = 1980;

/**
 * The DOS date and time the headers carry, from a `YYYY-MM-DD` day.
 *
 * Midnight, so every file in one archive reads the same moment and the day
 * the export was made is the whole story. DOS time counts in two-second
 * steps, which midnight is exactly.
 */
function dosStamp(iso: string): { time: number; date: number } {
  const [y, m, d] = iso.split("-").map(Number);
  const year = Math.max(y || DOS_YEAR, DOS_YEAR);
  const month = Math.min(Math.max(m || 1, 1), 12);
  const day = Math.min(Math.max(d || 1, 1), 31);
  return { time: 0, date: ((year - DOS_YEAR) << 9) | (month << 5) | day };
}

/**
 * Builds the archive. Names may hold any characters; a name outside ASCII
 * sets the format's UTF-8 flag so unzippers decode it rather than guessing.
 */
export function buildZip(files: ZipInput[], generatedOn: string): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const { time, date } = dosStamp(generatedOn);

  const names = files.map((f) => encoder.encode(f.name));
  const bodies = files.map((f) => encoder.encode(f.contents));
  // Offsets are written as we go, so each entry knows where its header began.
  const offsets: number[] = [];
  const crcs = bodies.map(crc32);

  const localSize = names.reduce((t, n, i) => t + 30 + n.length + bodies[i].length, 0);
  const centralSize = names.reduce((t, n) => t + 46 + n.length, 0);
  const out = new Uint8Array(localSize + centralSize + 22);
  let at = 0;
  /** Little-endian writes, the only endianness the zip format allows. */
  const w = (value: number, bytes: number) => {
    for (let i = 0; i < bytes; i++) out[at++] = (value >>> (i * 8)) & 0xff;
  };
  const put = (bytes: Uint8Array) => {
    out.set(bytes, at);
    at += bytes.length;
  };

  for (let i = 0; i < files.length; i++) {
    const flags = names[i].every((b) => b < 128) ? 0 : 0x800;
    offsets.push(at);
    w(0x04034b50, 4); // local file header signature
    w(20, 2); // version needed: a stored entry asks for nothing newer
    w(flags, 2);
    w(0, 2); // method: stored
    w(time, 2);
    w(date, 2);
    w(crcs[i], 4);
    w(bodies[i].length, 4); // compressed size
    w(bodies[i].length, 4); // uncompressed size, the same stored
    w(names[i].length, 2);
    w(0, 2); // no extra field
    put(names[i]);
    put(bodies[i]);
  }

  const centralAt = at;
  for (let i = 0; i < files.length; i++) {
    const flags = names[i].every((b) => b < 128) ? 0 : 0x800;
    w(0x02014b50, 4); // central directory signature
    w(20, 2); // version made by
    w(20, 2); // version needed
    w(flags, 2);
    w(0, 2); // method: stored
    w(time, 2);
    w(date, 2);
    w(crcs[i], 4);
    w(bodies[i].length, 4);
    w(bodies[i].length, 4);
    w(names[i].length, 2);
    w(0, 2); // no extra field
    w(0, 2); // no comment
    w(0, 2); // starts on this disk
    w(0, 2); // internal attributes: not a text stream
    w(0, 4); // external attributes
    w(offsets[i], 4);
    put(names[i]);
  }

  // Measured before the end record is written, because the record's own bytes
  // are not part of the directory it describes.
  const directorySize = at - centralAt;
  w(0x06054b50, 4); // end of central directory signature
  w(0, 2);
  w(0, 2);
  w(files.length, 2);
  w(files.length, 2);
  w(directorySize, 4); // central directory size
  w(centralAt, 4); // where it starts
  w(0, 2); // no comment
  return out;
}
