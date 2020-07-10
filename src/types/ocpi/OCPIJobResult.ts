export interface OCPIJobResult {
  success: number;
  failure: number;
  total: number;
  logs: string[];
  objectIDsInFailure?: string[];
  objectIDsInSuccess?: string[];
}
