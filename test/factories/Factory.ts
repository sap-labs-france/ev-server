const SiteFactory = require('./SiteFactory');
const CompanyFactory = require('./CompanyFactory');
const UserFactory = require('./UserFactory');
const ChargingStationFactory = require('./ChargingStationFactory');
const AddressFactory = require('./AddressFactory');
const SiteAreaFactory = require('./SiteAreaFactory');
const TenantFactory = require('./TenantFactory');
const SettingFactory = require('./SettingFactory');
const OcpiEndpointsFactory = require('./OcpiEndpointsFactory');

export default abstract class Factory {
  public static site = SiteFactory;
  public static company = CompanyFactory;
  public static user = UserFactory;
  public static chargingStation = ChargingStationFactory;
  public static address = AddressFactory;
  public static siteArea = SiteAreaFactory;
  public static tenant = TenantFactory;
  public static setting = SettingFactory;
  public static ocpiEndpoint = OcpiEndpointsFactory;
}
