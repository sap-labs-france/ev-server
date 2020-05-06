import ODataRestAdapter from './ODataRestAdapter';
import ODataServer from 'simple-odata-server';

export default class ODataServerFactory {
  public oDataServer: any;

  constructor() {
    this.oDataServer = ODataServer();
    ODataRestAdapter.registerAdapter(this.oDataServer);
  }

  getODataServer() {
    return this.oDataServer;
  }
}

