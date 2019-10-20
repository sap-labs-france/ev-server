export default interface CentralSystemFrontEndConfiguration {
  protocol: string;
  host: string;
  port: number;
  distEnabled?: boolean;
  distPath?: string;
}
