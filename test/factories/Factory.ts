import AddressFactory from './AddressFactory';
import ChargingStationFactory from './ChargingStationFactory';
import CompanyFactory from './CompanyFactory';
import OcpiEndpointsFactory from './OcpiEndpointsFactory';
import SettingFactory from './SettingFactory';
import SiteAreaFactory from './SiteAreaFactory';
import SiteFactory from './SiteFactory';
import TenantFactory from './TenantFactory';
import UserFactory from './UserFactory';

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
