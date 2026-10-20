/** Minimal, dependency-free image sniffing: type + dimensions for the formats BINHI accepts. */
export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

export interface ImageInfo {
  mimeType: AllowedImageType;
  width: number;
  height: number;
}

export function sniffImage(buf: Buffer): ImageInfo | null {
  if (buf.length < 12) return null;
  // PNG
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) && buf.length >= 24) {
    return { mimeType: "image/png", width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // GIF
  if (buf.subarray(0, 6).toString("ascii") === "GIF87a" || buf.subarray(0, 6).toString("ascii") === "GIF89a") {
    return { mimeType: "image/gif", width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }
  // WEBP
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") {
    const chunk = buf.subarray(12, 16).toString("ascii");
    if (chunk === "VP8 " && buf.length >= 30) return { mimeType: "image/webp", width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (chunk === "VP8L" && buf.length >= 25) {
      const b0 = buf[21]!, b1 = buf[22]!, b2 = buf[23]!, b3 = buf[24]!;
      return { mimeType: "image/webp", width: 1 + (((b1 & 0x3f) << 8) | b0), height: 1 + (((b3 & 0xf) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)) };
    }
    if (chunk === "VP8X" && buf.length >= 30) {
      return { mimeType: "image/webp", width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    }
    return null;
  }
  // JPEG: scan for SOF markers
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let off = 2;
    while (off + 9 < buf.length) {
      if (buf[off] !== 0xff) {
        off++;
        continue;
      }
      const marker = buf[off + 1]!;
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        off += 2;
        continue;
      }
      const len = buf.readUInt16BE(off + 2);
      if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
        return { mimeType: "image/jpeg", height: buf.readUInt16BE(off + 5), width: buf.readUInt16BE(off + 7) };
      }
      off += 2 + len;
    }
    return null;
  }
  return null;
}

export function safeFilename(name: string, fallbackExt: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  if (!cleaned || cleaned === "." || cleaned === "..") return `upload${fallbackExt}`;
  return /\.[A-Za-z0-9]{2,5}$/.test(cleaned) ? cleaned : `${cleaned}${fallbackExt}`;
}

export const EXT_BY_TYPE: Record<AllowedImageType, string> = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif" };
