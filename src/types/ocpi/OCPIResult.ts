export interface OCPIResult {
  success: number;
  failure: number;
  total: number;
  logs: string[];
  objectIDsInFailure?: string[];
}
