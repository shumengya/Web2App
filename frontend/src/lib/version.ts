/** 默认版本号：当前日期，格式如 2026.5.29 */
export function getDefaultAppVersion(date = new Date()): string {
  return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
}
