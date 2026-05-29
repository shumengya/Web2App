export class IconValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IconValidationError";
  }
}

const MAX_ICON_BYTES = 2 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

const ALLOWED_EXT = new Set([".png", ".jpg", ".jpeg", ".ico"]);

export function resolveIconUpload(
  file: File,
  buffer: Uint8Array,
): { repoPath: string; fileName: string } {
  if (buffer.length > MAX_ICON_BYTES) {
    throw new IconValidationError("图标文件不能超过 2MB");
  }

  const ext = pathExt(file.name).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    throw new IconValidationError("图标仅支持 PNG、JPG、ICO 格式");
  }

  const type = file.type.toLowerCase();
  if (type && !ALLOWED_TYPES.has(type) && type !== "application/octet-stream") {
    throw new IconValidationError("不支持的图标 MIME 类型");
  }

  if (ext === ".ico") {
    return { repoPath: "favicon.ico", fileName: "favicon.ico" };
  }
  if (ext === ".jpg" || ext === ".jpeg") {
    return { repoPath: "logo.jpg", fileName: "logo.jpg" };
  }

  return { repoPath: "logo.png", fileName: "logo.png" };
}

function pathExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i) : "";
}
