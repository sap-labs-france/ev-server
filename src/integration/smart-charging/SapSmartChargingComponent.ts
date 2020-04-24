import Utils from '../../utils/Utils';

const SapSmartChargingComponent = Utils.isModuleAvailable(__dirname + '/sap-smart-charging/SapSmartCharging') ?
  require('./sap-smart-charging/SapSmartCharging').default :
  require('../../utils/DummyModule').default;

export default SapSmartChargingComponent;
