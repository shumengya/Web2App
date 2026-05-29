import { unzipSync, zipSync } from "fflate";

export class ZipValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZipValidationError";
  }
}

export function validateZipBuffer(
  buffer: Uint8Array,
  maxBytes: number,
): { normalizedBuffer: Uint8Array } {
  if (buffer.length > maxBytes) {
    throw new ZipValidationError(
      `Zip file exceeds ${Math.floor(maxBytes / (1024 * 1024))}MB limit`,
    );
  }

  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(buffer);
  } catch {
    throw new ZipValidationError("Invalid zip archive");
  }

  const entries = Object.keys(files).filter(
    (key) => !key.endsWith("/") && files[key].length > 0,
  );
  if (entries.length === 0) {
    throw new ZipValidationError("Zip archive is empty");
  }

  const indexEntry = entries.find((entry) => {
    const normalized = entry.replace(/\\/g, "/");
    if (normalized === "index.html") return true;
    const parts = normalized.split("/");
    return parts.length === 2 && parts[1] === "index.html";
  });

  if (!indexEntry) {
    throw new ZipValidationError(
      "Zip must contain index.html at root or in a single top-level folder",
    );
  }

  const normalized = normalizeZipFiles(files);
  return { normalizedBuffer: zipSync(normalized) };
}

function normalizeZipFiles(
  files: Record<string, Uint8Array>,
): Record<string, Uint8Array> {
  const map: Record<string, Uint8Array> = {};
  for (const [key, data] of Object.entries(files)) {
    const path = key.replace(/\\/g, "/").replace(/^\.\//, "");
    if (path.endsWith("/")) continue;
    map[path] = data;
  }

  if (map["index.html"]) {
    return map;
  }

  const keys = Object.keys(map);
  const indexKey = keys.find((k) => {
    const parts = k.split("/");
    return parts.length === 2 && parts[1] === "index.html";
  });

  if (!indexKey) {
    throw new ZipValidationError(
      "index.html must be at zip root or inside exactly one folder",
    );
  }

  const folder = indexKey.split("/")[0];
  const topDirs = new Set(
    keys.map((k) => k.split("/")[0]).filter(Boolean),
  );

  if (topDirs.size !== 1 || !topDirs.has(folder)) {
    throw new ZipValidationError(
      "index.html must be at zip root or inside exactly one folder",
    );
  }

  const flat: Record<string, Uint8Array> = {};
  const prefix = `${folder}/`;
  for (const [key, data] of Object.entries(map)) {
    if (!key.startsWith(prefix)) {
      throw new ZipValidationError(
        "index.html must be at zip root or inside exactly one folder",
      );
    }
    const rel = key.slice(prefix.length);
    if (!rel) continue;
    flat[rel] = data;
  }

  if (!flat["index.html"]) {
    throw new ZipValidationError(
      "index.html must be at zip root or inside exactly one folder",
    );
  }

  return flat;
}

const JAVA_RESERVED_SEGMENTS = new Set([
  "abstract",
  "assert",
  "boolean",
  "break",
  "byte",
  "case",
  "catch",
  "char",
  "class",
  "const",
  "continue",
  "default",
  "do",
  "double",
  "else",
  "enum",
  "extends",
  "final",
  "finally",
  "float",
  "for",
  "goto",
  "if",
  "implements",
  "import",
  "instanceof",
  "int",
  "interface",
  "long",
  "native",
  "new",
  "package",
  "private",
  "protected",
  "public",
  "return",
  "short",
  "static",
  "strictfp",
  "super",
  "switch",
  "synchronized",
  "this",
  "throw",
  "throws",
  "transient",
  "try",
  "void",
  "volatile",
  "while",
]);

function sanitizeSegment(segment: string): string {
  let value = segment.toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (!value) return "app";
  if (/^\d/.test(value)) value = `app${value}`;
  if (JAVA_RESERVED_SEGMENTS.has(value)) value = `${value}app`;
  return value.slice(0, 48);
}

export function validateEnglishAppName(input: string): string {
  const value = input.trim();
  if (!value) {
    throw new ZipValidationError("应用英文名不能为空");
  }
  if (!/^[a-zA-Z][a-zA-Z0-9 _.-]*$/.test(value)) {
    throw new ZipValidationError(
      "应用英文名需以字母开头，仅支持英文字母、数字、空格、下划线和连字符",
    );
  }
  return value;
}

export function validateChineseAppName(input: string): string {
  const value = input.trim();
  if (!value) {
    throw new ZipValidationError("应用中文名不能为空");
  }
  return value;
}

export function slugifyIdentifier(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .split(".")
    .map(sanitizeSegment)
    .filter(Boolean)
    .join(".")
    .slice(0, 120);
}

export function normalizeAppIdentifier(identifier: string): string {
  const parts = identifier
    .trim()
    .split(".")
    .map(sanitizeSegment)
    .filter(Boolean);

  if (parts.length < 2) {
    throw new ZipValidationError(
      "Bundle ID 至少需要两段，例如 com.example.myapp",
    );
  }

  return parts.join(".");
}
