import Authorizations from '../../../authorization/Authorizations';
import Logging from '../../../utils/Logging';
import Database from '../../../utils/Database';
import PricingSecurity from './security/PricingSecurity';
import PricingStorage from '../../../storage/mongodb/PricingStorage';
import Constants from '../../../utils/Constants';
import AppAuthError from '../../../exception/AppAuthError';
import AppError from '../../../exception/AppError';
export default class PricingService {
  static async handleGetPricing(action, req, res, next) {
    try {
      // Check auth
      if (!Authorizations.canReadPricing(req.user)) {
        // Not Authorized!
        throw new AppAuthError(
          action, Constants.ENTITY_PRICING,
          null,
          560, 'PricingService', 'handleGetPricing',
          req.user);
      }
      // Get the Pricing
      const pricing = await PricingStorage.getPricing(req.user.tenantID);
      // Return
      if (pricing) {
        res.json(
          // Filter
          PricingSecurity.filterPricingResponse(
            pricing, req.user)
        );
      } else {
        res.json(null);
      }
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleUpdatePricing(action, req, res, next) {
    try {
      // Check auth
      if (!Authorizations.canUpdatePricing(req.user)) {
        // Not Authorized!
        throw new AppAuthError(
          action, Constants.ENTITY_PRICING,
          null,
          560, 'PricingService', 'handleUpdatePricing',
          req.user);
      }
      // Filter
      const filteredRequest = PricingSecurity.filterPricingUpdateRequest(req.body, req.user);
      // Check
      if (!filteredRequest.priceKWH || isNaN(filteredRequest.priceKWH)) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The price ${filteredRequest.priceKWH} has not a correct format`, 500,
          'PricingService', 'handleUpdatePricing', req.user);
      }
      // Update
      const pricing:any = {};
      Database.updatePricing(filteredRequest, pricing);
      // Set timestamp
      pricing.timestamp = new Date();
      // Get
      await PricingStorage.savePricing(req.user.tenantID, pricing);
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, action: action,
        module: 'PricingService',
        method: 'handleUpdatePricing',
        message: `Pricing has been updated to '${req.body.priceKWH} ${req.body.priceUnit}'`,
        detailedMessages: req.body
      });
      // Ok
      res.json(Constants.REST_RESPONSE_SUCCESS);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }
}


