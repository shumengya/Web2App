export class VersionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VersionValidationError";
  }
}

/** 当前日期版本，格式如 2026.5.29（月、日不补零） */
export function getDefaultAppVersion(date = new Date()): string {
  return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
}

export function validateAppVersion(input: string): string {
  const value = input.trim() || getDefaultAppVersion();
  if (!/^\d{4}\.\d{1,2}\.\d{1,2}$/.test(value)) {
    throw new VersionValidationError(
      "版本号格式应为 YYYY.M.D，例如 2026.5.29",
    );
  }
  const [, month, day] = value.split(".").map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new VersionValidationError("版本号中的月或日无效");
  }
  return value;
}
