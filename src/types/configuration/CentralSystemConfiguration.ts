export default interface CentralSystemConfiguration {
  type: string;
  implementation: string;
  protocol: string;
  host: string;
  port: number;
  debug: boolean;
  keepaliveinterval?: number;
}
