const User = require('../../../model/User');
const Logging = require('../../../utils/Logging');
const Database = require('../../../utils/Database');
const AppError = require('../../../exception/AppError');
const AppAuthError = require('../../../exception/AppAuthError');
const Authorizations = require('../../../authorization/Authorizations');
const Constants = require('../../../utils/Constants');
const Variant = require('../../../model/Variant');
const VariantSecurity = require('./security/VariantSecurity');
const VariantStorage = require('../../../storage/mongodb/VariantStorage');

class VariantService {
  static async handleDeleteVariant(action, req, res, next) {
    try {
      // Filter
      let filteredRequest = VariantSecurity.filterVariantDeleteRequest(
        req.query
      );
      // Check Mandatory fields
      if (!filteredRequest.name) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The variant name must be provided`,
          500,
          'VariantService',
          'handleDeleteVariant',
          req.user
        );
      }
      if (!filteredRequest.ViewID) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The variant view ID must be provided`,
          500,
          'VariantService',
          'handleDeleteVariant',
          req.user
        );
      }
      // Get
      let variant = await VariantStorage.getVariantByID(
        filteredRequest.name,
        filteredRequest.viewID,
        filteredRequest.userID,
      );
      if (!variant) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `Variant '${filteredRequest.name}' with view ID '${filteredRequest.viewID}' and user ID '${
            filteredRequest.userID
          }'  do not exist`,
          550,
          'VariantService',
          'handleDeleteVariant',
          req.user
        );
      }
      // Check auth
      if (!Authorizations.canDeleteVariant(req.user, variant.getModel())) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_DELETE,
          Constants.ENTITY_VARIANT,
          variant.getModel(),
          560,
          'VariantService',
          'handleDeleteVariant',
          req.user
        );
      }
      // Delete
      await variant.delete();
      // Log
      Logging.logSecurityInfo({
        user: req.user,
        module: 'VariantService',
        method: 'handleDeleteVariant',
        message: `Variant '${variant.getName()}' associated to view '${variant.getViewID()}' and user '${
          req.user.email
        }' has been deleted successfully`,
        action: action,
        detailedMessages: variant
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

  static async handleGetVariant(action, req, res, next) {
    try {
      // Filter
      let filteredRequest = VariantSecurity.filterVariantRequest(
        req.query,
        req.user
      );
       // Name is mandatory
       if (!filteredRequest.Name) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The variant name must be provided`,
          500,
          'VariantService',
          'handleGetVariant',
          req.user
        );
      }
      // View ID is mandatory
      if (!filteredRequest.ViewID) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The variant view ID must be provided`,
          500,
          'VariantService',
          'handleGetVariant',
          req.user
        );
      }
      // Get it
      let variant = await VariantStorage.getVariantByID(
        filteredRequest.Name,
        filteredRequest.ViewID,
        filteredRequest.UserID
      );
      if (!variant) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `Variant '${filteredRequest.Name}' with view ID '${filteredRequest.ViewID}' and user ID '${
            filteredRequest.UserID
          }'  do not exist`,
          550,
          'VariantService',
          'handleGetVariant',
          req.user
        );
      }
      // Return
      res.json(
        // Filter
        VariantSecurity.filterVariantResponse(variant.getModel(), req.user)
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

  static async handleGetVariants(action, req, res, next) {
    try {
      // Check auth
      if (!Authorizations.canListVariants(req.user)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_LIST,
          Constants.ENTITY_VARIANT,
          null,
          560,
          'VariantService',
          'handleGetVariants',
          req.user
        );
      }
      // Filter
      let filteredRequest = VariantSecurity.filterVariantsRequest(
        req.query,
        req.user
      );
      // Get variants
      let variants = await VariantStorage.getVariants(x, limit, skip, sort)(
        {name: filteredRequest.Name, viewID: filteredRequest.ViewID, userID: filteredRequest.UserID},
        filteredRequest.Limit,
        filteredRequest.Skip,
        filteredRequest.Sort
      );
      // Set
      variants.result = variants.result.map(variant => variant.getModel());
      // Filter
      variants.result = VariantSecurity.filterVariantsResponse(
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

  static async handleCreateVariant(action, req, res, next) {
    try {
      // Check auth
      if (!Authorizations.canCreateVariant(req.user)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_CREATE,
          Constants.ENTITY_VARIANT,
          null,
          560,
          'VariantService',
          'handleCreateVariant',
          req.user
        );
      }
      // Filter
      let filteredRequest = VariantSecurity.filterVariantCreateRequest(
        req.body,
        req.user
      );
      // Check Mandatory fields
      Variant.checkIfVariantValid(filteredRequest, req);
      // Create variants
      let variant = new Variant(filteredRequest);
      // Save
      let newVariant = await variant.save();
      // Log
      Logging.logSecurityInfo({
        user: req.user,
        module: 'VariantService',
        method: 'handleCreateVariant',
        message: `Variant '${newVariant.getName()}' associated to view '${newVariant.getViewID()}' and user '${req.user.email }' has been created successfully`,
        action: action,
        detailedMessages: newVariant
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

module.exports = VariantService;
