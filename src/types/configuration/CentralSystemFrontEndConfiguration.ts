import { ServerProtocol } from '../Server';

export default interface CentralSystemFrontEndConfiguration {
  protocol: ServerProtocol;
  host: string;
  port: number;
  distEnabled?: boolean;
  distPath?: string;
}
