
export interface Migration {
  id?: string;
  timestamp: Date;
  name: string;
  version: string;
  durationSecs: number;
}
