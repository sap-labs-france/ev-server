import AddressFactory from './AddressFactory';
import AssetFactory from './AssetFactory';
import CarFactory from './CarFactory';
import ChargingStationFactory from './ChargingStationFactory';
import ChargingStationTemplateFactory from './ChargingStationTemplateFactory';
import CompanyFactory from './CompanyFactory';
import OcpiEndpointsFactory from './OcpiEndpointsFactory';
import OicpEndpointsFactory from './OicpEndpointsFactory';
import RegistrationTokenFactory from './RegistrationTokenFactory';
import SettingFactory from './SettingFactory';
import SiteAreaFactory from './SiteAreaFactory';
import SiteFactory from './SiteFactory';
import TagFactory from './TagFactory';
import TenantFactory from './TenantFactory';
import UserFactory from './UserFactory';

export default abstract class Factory {
  public static site = SiteFactory;
  public static company = CompanyFactory;
  public static asset = AssetFactory;
  public static user = UserFactory;
  public static chargingStation = ChargingStationFactory;
  public static address = AddressFactory;
  public static siteArea = SiteAreaFactory;
  public static tenant = TenantFactory;
  public static setting = SettingFactory;
  public static ocpiEndpoint = OcpiEndpointsFactory;
  public static oicpEndpoint = OicpEndpointsFactory;
  public static car = CarFactory;
  public static tag = TagFactory;
  public static registrationToken = RegistrationTokenFactory;
  public static chargingStationTemplate = ChargingStationTemplateFactory;
}
