import SourceMap from 'source-map-support';
import AbstractOCPIService from '../../AbstractOCPIService';

const VERSION = '2.0';

SourceMap.install();

/**
 * OCPI Service 2.0 - Not Implemented - Only used for testing multiple Services declaration
 */
export default class OCPIServices extends AbstractOCPIService {
  // Create OCPI Service
  constructor(ocpiRestConfig) {
    super(ocpiRestConfig, VERSION);
  }

  // Rest Service Implementation
  restService(req, res, next) { // eslint-disable-line
    // Not implemented
    res.sendStatus(501);
  }
}

