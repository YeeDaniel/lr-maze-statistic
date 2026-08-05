/**
 * 折線圖（view-chart）與趟次清單（view-runs）共用的配色。
 * 兩邊都依 state.runs 的 index 用 HUE[i % HUE.length] 取色，
 * 這樣趟次清單的色標才會跟折線圖上那條線的顏色對得起來。
 * 只維護這一份，兩邊都從這裡拿，不要各自複製一份。
 */
export const HUE = ['#2a78d6','#eb6834','#1baf7a','#eda100','#e87ba4','#008300','#4a3aa7','#e34948'];
