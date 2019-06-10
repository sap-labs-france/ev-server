import AbstractOCPIService from '../../AbstractOCPIService';

const VERSION = "2.0";

import SourceMap from 'source-map-support';
SourceMap.install();

/**
 * OCPI Service 2.0 - Not Implemented - Only used for testing multiple Services declaration
 */export default class OCPIServices extends AbstractOCPIService {
  // Create OCPI Service
  constructor(ocpiRestConfig) {
    super(ocpiRestConfig, VERSION);
  }

  // Rest Service Implementation
  restService(req, res, next) { // eslint-disable-line
    // not implementated 
    res.sendStatus(501);
  }
}

