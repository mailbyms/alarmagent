// 时间格式化工具函数
export function formatLocalTime(val) {
  if (!val) return '';
  const d = new Date(val);
  if (isNaN(d)) return val;
  return d.toLocaleString();
}
