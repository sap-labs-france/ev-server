import ODataServer from 'simple-odata-server';
import ODataRestAdapter from './ODataRestAdapter';
require('source-map-support').install();
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

