const path = require('path');
global.appRoot = path.resolve(__dirname, '../../src');
const chai = require('chai');
const {expect} = require('chai');
const chaiSubset = require('chai-subset');
chai.use(chaiSubset);
const moment = require('moment');
const faker = require('faker');
const DataHelper = require('./DataHelper');
const CentralServerService = require('./client/CentralServerService');
const GlobalContext = require('./scenario/GlobalContext');

describe('Transaction tests', function() {
  this.timeout(10000);
  before(async () => {
    this.globalContext = GlobalContext.getInstance();
    console.log('before transaction ' + this.globalContext.isGlobalTest());
    if (!this.globalContext.isGlobalTest()) {
      this.tenantID = await CentralServerService.authenticatedApi.getTenantID();
      this.dataHelper16 = new DataHelper('1.6', this.tenantID);
    } else {
      this.tenantID = this.globalContext.getTenantID();
      this.dataHelper16 = this.globalContext.getDataHelper('1.6');
    }
  });

  after(async () => {
    console.log('after transaction ' + this.globalTest);
    if (!this.globalContext.isGlobalTest()) {
      this.dataHelper16.close();
      this.dataHelper16.destroyData();
    }
  });

  it('should return -1 when the value is not present', function() {
    [1, 2, 3].indexOf(5).should.equal(-1);
    [1, 2, 3].indexOf(0).should.equal(-1);
  });
  
});


function timeout(ms) {
  // eslint-disable-next-line no-undef
  return new Promise(resolve => setTimeout(resolve, ms));
}