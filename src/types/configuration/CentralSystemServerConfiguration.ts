import { ServerProtocol } from '../Server';

export default interface CentralSystemServerConfiguration {
  protocol: ServerProtocol;
  externalProtocol?: ServerProtocol;
  host?: string;
  port: number;
  sslKey?: string;
  sslCert?: string;
  sslCa?: string | string[];
}
