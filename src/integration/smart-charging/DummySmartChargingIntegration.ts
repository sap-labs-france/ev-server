import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import { ServerAction } from '../../types/Server';
import SiteArea from '../../types/SiteArea';
import SmartChargingIntegration from './SmartChargingIntegration';

const MODULE_NAME = 'DummySmartCharging';

export default class DummySapSmartChargingIntegration<SmartChargingSetting> extends SmartChargingIntegration<SmartChargingSetting> {
  constructor(tenantID: string, setting: SmartChargingSetting) {
    super(tenantID, setting);
    const error = new Error();
    Logging.logDebug({
      tenantID: tenantID,
      source: Constants.CENTRAL_SERVER,
      action: ServerAction.INSTANTIATE_DUMMY_MODULE,
      module: MODULE_NAME, method: 'constructor',
      message: MODULE_NAME + ' have been instantiated, ensure its instantiation follow its proper usage',
      detailedMessages: { stack: error.stack }
    });
  }

  async buildChargingProfiles(siteArea: SiteArea): Promise<any> {}

  async checkConnection() {}
}
