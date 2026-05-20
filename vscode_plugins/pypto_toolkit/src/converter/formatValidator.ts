export class FormatValidator {
  static validatePerfSwimlane(data: any): { valid: boolean; error?: string } {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'Invalid data: not an object' };
    }

    if (!Array.isArray(data.tasks)) {
      return { valid: false, error: 'Invalid tasks field: must be an array' };
    }

    return { valid: true };
  }

  static validateMergedSwimlane(data: any): { valid: boolean; error?: string } {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'Invalid data: not an object' };
    }

    if (!('traceEvents' in data)) {
      return { valid: false, error: 'Missing required field: traceEvents' };
    }

    if (!Array.isArray(data.traceEvents)) {
      return { valid: false, error: 'Invalid traceEvents field: must be an array' };
    }

    return { valid: true };
  }
}