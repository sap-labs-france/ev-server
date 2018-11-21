const BaseApi = require('../client/utils/BaseApi');
const config = require('../../config');
const { expect } = require('chai');
const chai = require('chai');
const chaiSubset = require('chai-subset');

// Set
chai.use(chaiSubset);

class OCPIService {
  constructor() {
    this.baseURL = `${config.get('ocpi.scheme')}://${config.get('ocpi.host')}:${config.get('ocpi.port')}`;
    // Create the Base API
    this.baseApi = new BaseApi(this.baseURL);
  }
  
  /**
   * Get Version url
   */
  async getVersions() {
    return this.baseApi.send({
      method: 'GET',
      url: 'ocpi/cpo/versions'
    });
  }

  /**
   * Get Implementation for 2.1.1
   */
  async getImplementation2_1_1() {
    return this.baseApi.send({
      method: 'GET',
      url: 'ocpi/cpo/2.1.1'
    });
  }

  /**
   * Get Locations for 2.1.1
   */
  async getLocations2_1_1() {
    return this.baseApi.send({
      method: 'GET',
      url: 'ocpi/cpo/2.1.1/locations'
    });
  }

  /**
   * Check basic structure for OCPI Response
   * @param {*} ocpiResponse 
   */
  checkOCPIResponseStructure(ocpiResponse) {
    expect(ocpiResponse).to.not.be.empty;
    expect(ocpiResponse).to.have.property('status_code');
    expect(ocpiResponse).to.have.property('status_message');
    expect(ocpiResponse).to.have.property('data');
    expect(ocpiResponse).to.have.property('timestamp').that.is.not.empty;
  }
  

  
}

module.exports = OCPIService;