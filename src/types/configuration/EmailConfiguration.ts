export default interface EmailConfiguration {
  from: string;
  admins: string[];
  bcc: string;
  smtp: {
    from: string;
    host: string;
    port: number;
    secure: boolean;
    requireTLS: boolean;
    user: string;
    password: string;
  };
  smtpBackup: {
    from: string;
    host: string;
    port: number;
    secure: boolean;
    requireTLS: boolean;
    user: string;
    password: string;
  };
}
