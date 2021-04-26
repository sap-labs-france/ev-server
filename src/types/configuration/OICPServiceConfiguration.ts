import { ServerProtocol } from '../Server';

export default interface OICPServiceConfiguration {
  protocol: ServerProtocol;
  externalProtocol: ServerProtocol;
  host: string;
  port: number;
  debug: boolean;
  key: string;
  cert: string;
}
