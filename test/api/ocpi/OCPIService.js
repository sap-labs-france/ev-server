const {expect} = require('chai');
const BaseApi = require('./utils/BaseApi');
const config = require('../../config');
const chai = require('chai');
const chaiSubset = require('chai-subset');

// Set
chai.use(chaiSubset);

class OCPIService {
  constructor() {
    this.baseURL = `${config.get('server.scheme')}://${config.get('server.host')}:${config.get('server.port')}`;
    // Create the Base API
    this.baseApi = new BaseApi(this.baseURL);
  }
  
  
}

module.exports = OCPIService;