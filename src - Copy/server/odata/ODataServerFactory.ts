import ODataServer from 'simple-odata-server';
import ODataRestAdapter from './ODataRestAdapter';
import SourceMap from 'source-map-support';
SourceMap.install();

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

