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
  troubleshootingMode?: boolean // DEV only - set to true to dump the email HTML content
}
