export interface OCPIResponse {
  data?: string | Record<string, unknown> | Record<string, unknown>[];
  status_code: number;
  status_message: string;
  timestamp: string;
}
