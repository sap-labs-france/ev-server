const SiteFactory = require('./SiteFactory');
const CompanyFactory = require('./CompanyFactory');
const UserFactory = require('./UserFactory');
const ChargePointFactory = require('./ChargePointFactory');
const AddressFactory = require('./AddressFactory');
const SiteAreaFactory = require('./SiteAreaFactory');

class Factory {
  constructor() {
    this.site = SiteFactory;
    this.company = CompanyFactory;
    this.user = UserFactory;
    this.chargePoint = ChargePointFactory;
    this.address = AddressFactory;
    this.siteArea = SiteAreaFactory;
  }
}

module.exports = new Factory();