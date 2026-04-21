// 节点精度详情面板，概览卡片数据
export interface AbnormalNodeOverviewInfo {
  dataType: string | number; // Dtype
  validShape: string | number; // Shape
  rtolAtol: string; // rtol/atol, eg: '0.01/0.01'
  totalCount: string | number; // total_Count(总数据量)
  zeroCount: string | number; // ZeroCount(均为0的数量)
  tolCnt: string | number; // tol_cnt(容差个数)
  warn: string | number; // warn(实际差异个数)
  fail: string | number; // fail(错误个数)
  mre: string; // mre(平均相对误差)
  mreTop8: string; // mre_top8(相对误差top8的均值)
  mreTop1permil: string; // mre_top1premil(相对误差top1/1000的均值)
  mae: string; // mae(平均绝对误差)
  maeTop8: string; // mae_top8(绝对误差top8的均值)
  maeTop1permil: string; // mae_top1premil(绝对误差top1/1000的均值)
  cntTotalZeroInfnanCnt: string; // total_cnt/zero_cnt/infnan_cnt
  cntFailWarnTol: string; // fail_cnt/warn_cnt/tol_cnt
  // 小表格的A行
  aAavg: string;
  aAvg: string;
  aMax: string;
  aMin: string;
  aInfnan: string;
  // 小表格的b行
  bAavg: string;
  bAvg: string;
  bMax: string;
  bMin: string;
  bInfnan: string;
  [key: string]: string | number;
}

// 节点精度详情面板，概览列表数据
export interface AbnormalNodeOverviewListItem {
  id: string | number; // 对应列表第一列，eg: A、B
  max: string | number; // 对应列表Max列，最大值
  min: string | number; // 对应列表Min列，最小值
  avg: string | number; // 对应列表Avg列，平均值
  aavg: string | number; // 对应列表Aavg列，绝对值的平均值
  infnan: string | number; // 对应列表Infnan列，异常值的个数
}

// 节点精度详情面板，精度异常详细对比列表数据
export interface AbnormalNodeCompareListItem {
  offset: string | number; // 对应OFFSET列
  offsetRaw: string | number; // 对应OFFSET_RAW列
  aValue: string | number; // 对应A>VALUE列
  bValue: string | number; // 对应B>VALUE列
  abRe: string | number; // 对应AB相对误差列
  abAe: string | number; // 对应AB绝对误差列
  abTol: string | number; // 对应误差判断容忍度列
}

export interface OverviewCardData {
  label: string;
  value: string | number;
  desc?: string;
}

export interface SelectedSortCol {
  field: keyof AbnormalNodeCompareListItem;
  direction: 'asc' | 'desc';
}
