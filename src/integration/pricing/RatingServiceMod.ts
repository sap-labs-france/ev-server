import Utils from '../../utils/Utils';

const RatingServiceMod = Utils.isModuleAvailable(__dirname + '/convergent-charging/RatingService') ?
  require('./convergent-charging/RatingService').default :
  require('../../utils/DummyModule').default;

export default RatingServiceMod;
