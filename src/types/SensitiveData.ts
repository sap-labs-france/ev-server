export interface SensitiveDataMigrationState {
  id: string;
  timestamp: Date;
  name: string;
  version: string;
  durationSecs: number;
  settingSensitiveData: SettingSensitiveData[];
}

export interface SettingSensitiveData {
  id?: string;
  identifier: string;
  sensitiveData: SensitiveData[]
}

export interface SensitiveData {
  identifier: string;
  path: string;
  initialValue: EncryptedValue;
  clearValue: string;
  migratedValue: EncryptedValue;
}

export interface EncryptedValue {
  key: string;
  encryptedValue: string;
}
