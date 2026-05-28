import AdmZip from "adm-zip";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export class ZipValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZipValidationError";
  }
}

export function validateZipBuffer(
  buffer: Buffer,
  maxBytes: number,
): { normalizedBuffer: Buffer } {
  if (buffer.length > maxBytes) {
    throw new ZipValidationError(
      `Zip file exceeds ${Math.floor(maxBytes / (1024 * 1024))}MB limit`,
    );
  }

  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    throw new ZipValidationError("Invalid zip archive");
  }

  const entries = zip.getEntries().filter((entry) => !entry.isDirectory);
  if (entries.length === 0) {
    throw new ZipValidationError("Zip archive is empty");
  }

  const indexEntry = entries.find((entry) => {
    const normalized = entry.entryName.replace(/\\/g, "/");
    if (normalized === "index.html") return true;
    const parts = normalized.split("/");
    return parts.length === 2 && parts[1] === "index.html";
  });

  if (!indexEntry) {
    throw new ZipValidationError(
      "Zip must contain index.html at root or in a single top-level folder",
    );
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "web2app-"));
  try {
    zip.extractAllTo(tmpDir, true);
    const rootIndex = path.join(tmpDir, "index.html");
    if (!fs.existsSync(rootIndex)) {
      const subdirs = fs
        .readdirSync(tmpDir, { withFileTypes: true })
        .filter((d) => d.isDirectory());
      if (subdirs.length !== 1) {
        throw new ZipValidationError(
          "index.html must be at zip root or inside exactly one folder",
        );
      }
      const nestedRoot = path.join(tmpDir, subdirs[0].name);
      flattenDirectory(nestedRoot, tmpDir);
    }
    const normalizedZip = new AdmZip();
    addDirectoryToZip(normalizedZip, tmpDir, "");
    return { normalizedBuffer: normalizedZip.toBuffer() };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function flattenDirectory(sourceDir: string, targetDir: string) {
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const from = path.join(sourceDir, entry.name);
    const to = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      fs.cpSync(from, to, { recursive: true });
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

function addDirectoryToZip(zip: AdmZip, dir: string, prefix: string) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    const entryName = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      addDirectoryToZip(zip, fullPath, entryName);
    } else {
      zip.addFile(entryName, fs.readFileSync(fullPath));
    }
  }
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
