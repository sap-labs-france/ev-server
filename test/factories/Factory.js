const SiteFactory = require('./SiteFactory');
const CompanyFactory = require('./CompanyFactory');
const UserFactory = require('./UserFactory');
const ChargingStationFactory = require('./ChargingStationFactory');
const AddressFactory = require('./AddressFactory');
const SiteAreaFactory = require('./SiteAreaFactory');
const TenantFactory = require('./TenantFactory');

class Factory {
  constructor() {
    this.site = SiteFactory;
    this.company = CompanyFactory;
    this.user = UserFactory;
    this.chargingStation = ChargingStationFactory;
    this.address = AddressFactory;
    this.siteArea = SiteAreaFactory;
    this.tenant = TenantFactory;
  }
}

module.exports = new Factory();