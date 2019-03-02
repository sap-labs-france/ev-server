const path = require('path');
global.appRoot = path.resolve(__dirname, '../../src');
const chai = require('chai');
const chaiSubset = require('chai-subset');
chai.use(chaiSubset);

describe('OCPI Entity Access Tests', function () {
  this.timeout(100000);


  before(async () => {

  });

  after(async () => {

  });

  /**
   * Test Entity access
   */
  describe('Test acess Tenant - Services', () => {
  });
});