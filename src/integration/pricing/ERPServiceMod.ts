import Utils from '../../utils/Utils';

const ERPServiceMod = Utils.isModuleAvailable(__dirname + '/convergent-charging/ERPService') ?
  require('./convergent-charging/ERPService').default :
  require('../../utils/DummyModule').default;

export default ERPServiceMod;
