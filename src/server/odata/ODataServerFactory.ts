import ODataRestAdapter from './ODataRestAdapter';
import ODataServer from 'simple-odata-server';

export default class ODataServerFactory {
  public oDataServer: ODataServer;

  constructor() {
    this.oDataServer = ODataServer();
    ODataRestAdapter.registerAdapter(this.oDataServer);
  }

  getODataServer(): ODataServer {
    return this.oDataServer;
  }
}

