import ODataServer from 'simple-odata-server';
import ODataRestAdapter from './ODataRestAdapter';

export default class ODataServerFactory {
  public odataserver: any;

  constructor() {
    this.odataserver = ODataServer();
    ODataRestAdapter.registerAdapter(this.odataserver);
  }

  getODataServer() {
    return this.odataserver;
  }
}

