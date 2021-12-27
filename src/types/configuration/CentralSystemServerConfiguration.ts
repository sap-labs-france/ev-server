import { ServerProtocol } from '../Server';

export default interface CentralSystemServerConfiguration {
  protocol: ServerProtocol;
  host?: string;
  port: number;
}
