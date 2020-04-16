import ODataServer from 'simple-odata-server';
import ODataRestAdapter from './ODataRestAdapter';

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

