import { ServerProtocol } from '../Server';

export default interface CentralSystemConfiguration {
  type: string;
  implementation: string;
  protocol: ServerProtocol;
  host: string;
  port: number;
  debug: boolean;
  keepaliveinterval?: number;
}
