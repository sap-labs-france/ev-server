export default interface CentralSystemServerConfiguration {
  protocol: string;
  host: string;
  port: number;
  sslKey?: string;
  sslCert?: string;
  sslCa?: string | string[];
}
