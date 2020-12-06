export interface OICPJobResult {
  success: number;
  failure: number;
  total: number;
  logs: string[];
  objectIDsInFailure?: string[];
}
