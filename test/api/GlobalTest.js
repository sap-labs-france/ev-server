const path = require('path');
global.appRoot = path.resolve(__dirname, '../../src');
const { expect } = require('chai');
const chai = require('chai');
const chaiSubset = require('chai-subset');
chai.use(chaiSubset);

const GlobalContext = require('./scenario/GlobalContext');

describe('Global tests', function () {
  
  before(async () => {
    console.log('BEFORE global test');
    GlobalContext.getInstance().setGlobalTest(true);
    await GlobalContext.getInstance().init();
  });

  after(async () => {
    console.log('AFTER global test');
    await GlobalContext.getInstance().destroy();
  });

  var tests = [
    {description: 'Tenant with all components active'},
    {description: 'Tenant with NO components active'},
  ];

  tests.forEach(function(test) {
    // it('Test ' + test.description, function() {
      describe('Global Transactions ' + test.description, function () {
        require('./TransactionTest');
      });
    // });
  });

});
