const CentralServerService = require('../client/CentralServerService');
const DataHelper = require('../DataHelper');

class GlobalContext {

  static getInstance() {
    if (!global.globalContextInstance) {
      global.globalContextInstance = new GlobalContext();
    }
    return global.globalContextInstance;
  }

  constructor(globalTest = false) {
    this.globalTest = globalTest;
    this.tenantID = null;
    this.dataHelper16 = null;
    this.dataHelper15 = null;
  }

  setGlobalTest(globalTest) {
    this.globalTest = globalTest;
  }

  isGlobalTest() {
    return this.globalTest === true;
  }

  async init() {
    this.tenantID = await CentralServerService.authenticatedApi.getTenantID();
    this.dataHelper16 = new DataHelper('1.6', this.tenantID);
    this.dataHelper15 = new DataHelper('1.5', this.tenantID);
    console.log('constructor each global ' + this.globalTest);
  }

  async destroy() {
    this.dataHelper16.close();
    this.dataHelper16.destroyData();
    this.dataHelper15.close();
    this.dataHelper15.destroyData();
    global.globalContextInstance = false;
    console.log('destroy global ' + this.globalTest);
  }

  getDataHelper(ocppVersion) {
      if (ocppVersion === '1.6') {
          return this.dataHelper16;
      }
      if (ocppVersion === '1.5') {
        return this.dataHelper15;
      }
      console.log('OCPP Version not supported' + ocppVersion);
      return null;
  }

  getTenantID() {
      return this.tenantID;
  }

}

module.exports = GlobalContext;