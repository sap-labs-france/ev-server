import { ServerProtocol } from '../Server';

export default interface OCPIServiceConfiguration {
  protocol: ServerProtocol;
  externalProtocol: ServerProtocol;
  host: string;
  port: number;
  debug: boolean;
}
