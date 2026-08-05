/**
 * HTML 跳脫。凡是把使用者可控文字內插進 innerHTML 的地方都要經過它。
 * 使用者可控的來源：趟次的 name / note / id —— 這些可能來自匯入的 JSON。
 */
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[c]);
