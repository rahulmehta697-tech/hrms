import "server-only";
import { deflateSync } from "zlib";
import { jsPDF } from "jspdf";
import { aadhaarOk } from "./joinform";

/** Sample files for the demo: a labelled one-page PDF and a plain portrait PNG. Nothing here is a real document. */
export function samplePdf(title: string, person: string) {
  const d = new jsPDF({ unit: "pt", format: [420, 297] });
  d.setDrawColor(23, 112, 92); d.setLineWidth(2); d.rect(12, 12, 396, 273);
  d.setFont("helvetica", "bold"); d.setFontSize(18); d.text(title, 30, 60);
  d.setFont("helvetica", "normal"); d.setFontSize(12); d.text(person, 30, 90);
  d.setTextColor(150); d.setFontSize(10); d.text("SAMPLE DOCUMENT FOR THE DEMO. NOT A REAL RECORD.", 30, 260);
  return Buffer.from(d.output("arraybuffer"));
}

const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
/** A 120×150 portrait placeholder: a head-and-shoulders silhouette on a tinted background. */
export function samplePhoto(hue: number) {
  const w = 120, h = 150;
  const bg = [200 + (hue % 40), 220, 210 + ((hue * 7) % 40)], fg = [90, 110 + (hue % 30), 100];
  const rows: Buffer[] = [];
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * 3);
    for (let x = 0; x < w; x++) {
      const head = (x - 60) ** 2 / 26 ** 2 + (y - 58) ** 2 / 32 ** 2 <= 1;
      const body = y > 100 && (x - 60) ** 2 / 52 ** 2 + (y - 160) ** 2 / 62 ** 2 <= 1;
      const c = head || body ? fg : bg;
      row[1 + x * 3] = c[0]; row[2 + x * 3] = c[1]; row[3 + x * 3] = c[2];
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(Buffer.concat(rows))), chunk("IEND", Buffer.alloc(0))]);
}

/** A checksum-valid Aadhaar-format number for sample data. */
export function sampleAadhaar(r: () => number) {
  for (;;) {
    const base = String(2 + Math.floor(r() * 8)) + String(Math.floor(r() * 1e10)).padStart(10, "0");
    for (let c = 0; c < 10; c++) if (aadhaarOk(base + c)) return base + c;
  }
}
