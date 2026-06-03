  export const executionTimeData = {
    ticksMap: new Map(),
    timelineGroupsMap: new Map(),
    echartsMap: new Map(),
    tableData: []
  };
  export const US_TO_MS_THRESHOLD = 1000;
  export const US_TO_S_THRESHOLD = 1000000;
  export const UNIT_US = '¦Ìs';
  export const UNIT_MS = 'ms';
  export const UNIT_S = 's';
  export const formatTimeUnit = (valueInUs) => {
    if (!valueInUs) return UNIT_US;
    if (valueInUs >= US_TO_S_THRESHOLD) return UNIT_S;
    if (valueInUs >= US_TO_MS_THRESHOLD) return UNIT_MS;
    return UNIT_US;
  };
  
  export const formatTimeValue = (valueInUs) => {
    if (!valueInUs) return 0;
    if (valueInUs >= US_TO_S_THRESHOLD) {
      return parseFloat((valueInUs / US_TO_S_THRESHOLD).toFixed(3));
    }
    if (valueInUs >= US_TO_MS_THRESHOLD) {
      return parseFloat((valueInUs / US_TO_MS_THRESHOLD).toFixed(3));
    }
    return valueInUs;
  };