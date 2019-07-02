import ODataServer from 'simple-odata-server';
import SourceMap from 'source-map-support';
import ODataRestAdapter from './ODataRestAdapter';

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

