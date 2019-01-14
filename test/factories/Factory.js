const SiteFactory = require('./SiteFactory');
const CompanyFactory = require('./CompanyFactory');
const UserFactory = require('./UserFactory');
const ChargingStationFactory = require('./ChargingStationFactory');
const AddressFactory = require('./AddressFactory');
const SiteAreaFactory = require('./SiteAreaFactory');
const TenantFactory = require('./TenantFactory');
const SettingFactory = require('./SettingFactory');
const OCPIEndpointFactory = require('./OCPIEndpointFactory');

class Factory {
  constructor() {
    this.site = SiteFactory;
    this.company = CompanyFactory;
    this.user = UserFactory;
    this.chargingStation = ChargingStationFactory;
    this.address = AddressFactory;
    this.siteArea = SiteAreaFactory;
    this.tenant = TenantFactory;
    this.setting = SettingFactory;
    this.ocpiendpoint = OCPIEndpointFactory;
  }
}

module.exports = new Factory();