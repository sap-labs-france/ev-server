export default interface EmailConfiguration {
  smtp: {
    from: string;
    host: string;
    port: number;
    secure: boolean;
    requireTLS: boolean;
    user: string;
    password: string;
  };
  disableBackup?: boolean;
  troubleshootingMode?: boolean
  smtpBackup?: {
    from: string;
    host: string;
    port: number;
    secure: boolean;
    requireTLS: boolean;
    user: string;
    password: string;
  };
}
