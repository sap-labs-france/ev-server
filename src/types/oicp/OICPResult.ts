export interface OICPResult {
  success: number;
  failure: number;
  total: number;
  logs: string[];
  objectIDsInFailure?: string[];
}
