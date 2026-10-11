/**
 * Reads the title ID straight from an NSP/NSZ in the browser, before uploading.
 * Mirrors the server's layer 1: a "<rightsId>.tik" entry or a plaintext ".cnmt.xml".
 */

export interface HeaderInfo {
  titleId: string | null;
  version: number | null;
  source: "cnmt" | "ticket" | null;
}

const NONE: HeaderInfo = { titleId: null, version: null, source: null };

export async function readFileHeader(file: File): Promise<HeaderInfo> {
  if (!/\.(nsp|nsz)$/i.test(file.name) || file.size < 16) return NONE;
  const buf = new Uint8Array(await file.slice(0, 64 * 1024).arrayBuffer());
  if (String.fromCharCode(...buf.subarray(0, 4)) !== "PFS0") return NONE;
  const view = new DataView(buf.buffer);
  const count = view.getUint32(4, true);
  const stringTableSize = view.getUint32(8, true);
  if (!count || count > 1000) return NONE;
  const stringsStart = 0x10 + count * 0x18;
  const dataStart = stringsStart + stringTableSize;
  const entries = [];
  for (let i = 0; i < count && 0x10 + i * 0x18 + 0x18 <= buf.length; i++) {
    const base = 0x10 + i * 0x18;
    const offset = Number(view.getBigUint64(base, true));
    const size = Number(view.getBigUint64(base + 8, true));
    let end = stringsStart + view.getUint32(base + 16, true);
    const start = end;
    while (end < buf.length && buf[end] !== 0) end++;
    entries.push({ name: new TextDecoder().decode(buf.subarray(start, end)), offset: dataStart + offset, size });
  }

  const cnmt = entries.find((e) => e.name.toLowerCase().endsWith(".cnmt.xml"));
  if (cnmt && cnmt.size < 256 * 1024) {
    const xml = await file.slice(cnmt.offset, cnmt.offset + cnmt.size).text();
    const id = xml.match(/<Id>\s*0x([0-9a-fA-F]{16})\s*<\/Id>/)?.[1];
    const version = xml.match(/<Version>\s*(\d+)\s*<\/Version>/)?.[1];
    if (id) return { titleId: id.toUpperCase(), version: version ? Number(version) : null, source: "cnmt" };
  }
  const tik = entries.find((e) => /^[0-9a-f]{32}\.tik$/i.test(e.name));
  if (tik) return { titleId: tik.name.slice(0, 16).toUpperCase(), version: null, source: "ticket" };
  return NONE;
}
