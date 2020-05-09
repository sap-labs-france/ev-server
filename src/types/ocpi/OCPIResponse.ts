export interface OCPIResponse {
  data?: string | object | object[];
  status_code: number;
  status_message: string;
  timestamp: string;
}
