const User = require('../../../model/User');
const Logging = require('../../../utils/Logging');
const Database = require('../../../utils/Database');
const AppError = require('../../../exception/AppError');
const AppAuthError = require('../../../exception/AppAuthError');
const Authorizations = require('../../../authorization/Authorizations');
const Constants = require('../../../utils/Constants');
const Variants = require('../../../model/Variants');
const VariantsSecurity = require('./security/VariantsSecurity');
const VariantsStorage = require('../../../storage/mongodb/VariantsStorage');

class VariantsService {
  static async handleDeleteVariants(action, req, res, next) {
    try {
      // Filter
      let filteredRequest = VariantsSecurity.filterVariantsDeleteRequest(
        req.query
      );
      // Check Mandatory fields
      if (!filteredRequest.ViewID) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The variants view ID must be provided`,
          500,
          'VariantsService',
          'handleDeleteVariants',
          req.user
        );
      }
      // Get
      let variants = await VariantsStorage.getUserVariantsByID(
        filteredRequest.viewID,
        filteredRequest.userID,
        false
      );
      if (!variants) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `Variants with view ID '${filteredRequest.viewID}' and user ID '${
            filteredRequest.userID
          }'  do not exist`,
          550,
          'VariantsService',
          'handleDeleteVariants',
          req.user
        );
      }
      // Check auth
      if (!Authorizations.canDeleteVariants(req.user, variants.getModel())) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_DELETE,
          Constants.ENTITY_VARIANTS,
          {viewID: variants.getviewID(), userID: userID},
          560,
          'VariantsService',
          'handleDeleteVariants',
          req.user
        );
      }
      // Delete
      await variants.delete();
      // Log
      Logging.logSecurityInfo({
        user: req.user,
        module: 'VariantsService',
        method: 'handleDeleteVariants',
        message: `Variants associated to view '${variants.getViewID()}' and user '${
          req.user.email
        }' has been deleted successfully`,
        action: action,
        detailedMessages: variants
      });
      // Ok
      res.json({status: `Success`});
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(
        action,
        error,
        req,
        res,
        next
      );
    }
  }

  static async handleGetVariants(action, req, res, next) {
    try {
      // Filter
      let filteredRequest = VariantsSecurity.filterVariantsRequest(
        req.query,
        req.user
      );
      // View ID  is mandatory
      if (!filteredRequest.ViewID) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The variants view ID must be provided`,
          500,
          'VariantsService',
          'handleGetVariants',
          req.user
        );
      }
      // Get it
      let variants = await VariantsStorage.getUserVariantsByID(
        filteredRequest.ViewID,
        filteredRequest.UserID,
        filteredRequest.Global
      );
      if (!variants) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `Variants with view ID '${filteredRequest.ViewID}' and user ID '${
            filteredRequest.UserID
          }'  do not exist`,
          550,
          'VariantsService',
          'handleGetVariants',
          req.user
        );
      }
      // Return
      res.json(
        // Filter
        VariantsSecurity.filterVariantsResponse(variants.getModel(), req.user)
      );
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(
        action,
        error,
        req,
        res,
        next
      );
    }
  }

  static async handleGetVariantsList(action, req, res, next) {
    try {
      // Check auth
      if (!Authorizations.canListVariants(req.user)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_LIST,
          Constants.ENTITY_VARIANTS,
          null,
          560,
          'VariantsService',
          'handleGetVariantsList',
          req.user
        );
      }
      // Filter
      let filteredRequest = VariantsSecurity.filterVariantsRequest(
        req.query,
        req.user
      );
      // Get variants
      let variants = await VariantsStorage.getVariants(x, limit, skip, sort)(
        {viewID: filteredRequest.ViewID, userID: filteredRequest.UserID},
        filteredRequest.Limit,
        filteredRequest.Skip,
        filteredRequest.Sort
      );
      // Set
      variants.result = variants.result.map(variant => variant.getModel());
      // Filter
      variants.result = VariantsSecurity.filterVariantsListResponse(
        variants.result,
        req.user
      );
      // Return
      res.json(variants);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(
        action,
        error,
        req,
        res,
        next
      );
    }
  }

  static async handleCreateVariants(action, req, res, next) {
    try {
      // Check auth
      if (!Authorizations.canCreateVehicle(req.user)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_CREATE,
          Constants.ENTITY_VARIANTS,
          null,
          560,
          'VariantsService',
          'handleCreateVariants',
          req.user
        );
      }
      // Filter
      let filteredRequest = VariantsSecurity.filterVariantsCreateRequest(
        req.body,
        req.user
      );
      // Check Mandatory fields
      Variants.checkIfVariantsValid(filteredRequest, req);
      // Create variants
      let variants = new Variants(filteredRequest);
      // Save
      let newVariants = await variants.save();
      // Log
      Logging.logSecurityInfo({
        user: req.user,
        module: 'VariantsService',
        method: 'handleCreateVariants',
        message: `Variants associated to view '${newVariants.getViewID}' and user '${req.user.email }' have been created successfully`,
        action: action,
        detailedMessages: newVariants
      });
      // Ok
      res.json({status: `Success`});
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(
        action,
        error,
        req,
        res,
        next
      );
    }
  }

  static async handleUpdateVariants(action, req, res, next) {
    try {
      // Filter
      let filteredRequest = VariantsSecurity.filterVariantsUpdateRequest(
        req.body,
        req.user
      );
      // Check view
      let variants = await VariantsStorage.getUserVariantsByID(filteredRequest.viewID, filteredRequest.userID, true);
      if (!variants) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Variants associated to view ID '${filteredRequest.viewID}' and user '${filteredRequest.userID}' do not exist anymore`,
          550,
          'VariantsService',
          'handleUpdateVariants',
          req.user
        );
      }
      // Check Mandatory fields
      Variants.checkIfVariantsValid(filteredRequest, req);
      // Check auth
      if (!Authorizations.canUpdateVariants(req.user, variants.getModel())) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_UPDATE,
          Constants.ENTITY_VARIANTS,
          {"viewID": variants.getViewID(), "userID": variants.userID},
          560,
          'VariantsService',
          'handleUpdateVariants',
          req.user
        );
      }
      // Update
      Database.updateVariants(filteredRequest, vehicle.getModel());
      // Update Variants
      let updatedVariants = await variants.save();
      // Log
      Logging.logSecurityInfo({
        user: req.user,
        module: 'VariantsService',
        method: 'handleUpdateVariants',
        message: `Variants associated to view '${updatedVariants.getviewID()}' and user '${updatedVariants.getUserID()}'have been updated successfully`,
        action: action,
        detailedMessages: updatedVariants
      });
      // Ok
      res.json({status: `Success`});
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(
        action,
        error,
        req,
        res,
        next
      );
    }
  }
}

module.exports = VariantsService;
