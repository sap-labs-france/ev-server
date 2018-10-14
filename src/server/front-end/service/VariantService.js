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
      if (!filteredRequest.ID) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The variant ID must be provided`,
          500,
          'VariantService',
          'handleDeleteVariant',
          req.user
        );
      }
      // Get
      let variant = await VariantStorage.getVariant(filteredRequest.ID);
      if (!variant) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `Variant  ID '${filteredRequest.ID}' do not exist`,
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
          variant.getID(),
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
          req.user.id
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
      if (!filteredRequest.ID) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The variant ID must be provided`,
          500,
          'VariantService',
          'handleGetVariant',
          req.user
        );
      }

      // Get it
      let variant = await VariantStorage.getVariant(filteredRequest.ID);
      if (!variant) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `Variant  ID '${filteredRequest.ID}' do not exist`,
          550,
          'VariantService',
          'handleGetVariant',
          req.user
        );
      }
      // Check auth
      if (!Authorizations.canReadVariant(req.user, variant.getModel())) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_READ,
          Constants.ENTITY_VARIANT,
          variant.getID(),
          560,
          'VariantService',
          'handleDeleteVariant',
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
      let variants = await VariantStorage.getVariants(
        {
          name: filteredRequest.Name,
          viewID: filteredRequest.ViewID,
          userID: filteredRequest.UserID,
          withGlobal: filteredRequest.WithGlobal
        },
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
      Variant.checkIfVariantValid(filteredRequest, req); // TODO Check if combination name/view/user exists
      // Create variants
      let variant = new Variant(filteredRequest);
      // Save
      let newVariant = await variant.save();
      // Log
      Logging.logSecurityInfo({
        user: req.user,
        module: 'VariantService',
        method: 'handleCreateVariant',
        message: `Variant '${newVariant.getName()}' associated to view '${newVariant.getViewID()}' and user '${
          req.user.id
        }' has been created successfully`,
        action: action,
        detailedMessages: newVariant
      });
      // Ok
      //res.json({status: `Success`});
      res.json(
        // Filter
        VariantSecurity.filterVariantResponse(newVariant.getModel(), req.user)
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

  static async handleUpdateVariant(action, req, res, next) {
    try {
      // Filter
      let filteredRequest = VariantSecurity.filterVariantUpdateRequest(
        req.body,
        req.user
      );
      // Check view
      let variant = await VariantStorage.getVariant(filteredRequest.id);

      if (!variant) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Variant '${filteredRequest.id}' do not exist anymore`,
          550,
          'VariantService',
          'handleUpdateVariant',
          req.user
        );
      }
      // Check Mandatory fields
      Variant.checkIfVariantValid(filteredRequest, req);
      // Check auth
      if (!Authorizations.canUpdateVariant(req.user, variant.getModel())) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_UPDATE,
          Constants.ENTITY_VARIANT,
          variant.getID(),
          560,
          'VariantService',
          'handleUpdateVariant',
          req.user
        );
      }
      // Update
      Database.updateVariant(filteredRequest, variant.getModel());
      // Update Variant
      let updatedVariant = await variant.save();
      // Log
      Logging.logSecurityInfo({
        user: req.user,
        module: 'VariantService',
        method: 'handleUpdateVariant',
        message: `Variant '${updatedVariant.getName()}' associated to view '${updatedVariant.getViewID()}' and user '${updatedVariant.getUserID()}'has been updated successfully`,
        action: action,
        detailedMessages: updatedVariant
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
