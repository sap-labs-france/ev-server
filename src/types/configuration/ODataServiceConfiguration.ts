import { ServerProtocol } from '../Server';

export default interface ODataServiceConfiguration {
  protocol: ServerProtocol;
  externalProtocol: ServerProtocol;
  host: string;
  port: number;
  debug: boolean;
}
