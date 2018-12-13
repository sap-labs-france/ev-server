const Logging = require('../../../utils/Logging');
const Database = require('../../../utils/Database');
const AppError = require('../../../exception/AppError');
const AppAuthError = require('../../../exception/AppAuthError');
const Authorizations = require('../../../authorization/Authorizations');
const Constants = require('../../../utils/Constants');
const Ocpiendpoint = require('../../../entity/OcpiEndpoint');
const User = require('../../../entity/User');
const OcpiendpointSecurity = require('./security/OcpiendpointSecurity');

class OcpiendpointService {
  static async handleDeleteOcpiendpoint(action, req, res, next) {
    try {
      // Filter
      const filteredRequest = OcpiendpointSecurity.filterOcpiendpointDeleteRequest(req.query, req.user);
      // Check Mandatory fields
      if (!filteredRequest.ID) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Ocpiendpoint's ID must be provided`, 500,
          'OcpiendpointService', 'handleDeleteOcpiendpoint', req.user);
      }
      // Get
      const ocpiendpoint = await Ocpiendpoint.getOcpiendpoint(req.user.tenantID, filteredRequest.ID);
      if (!ocpiendpoint) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `Ocpiendpoint with ID '${filteredRequest.ID}' does not exist`, 550,
          'OcpiendpointService', 'handleDeleteOcpiendpoint', req.user);
      }
      // Check auth
      if (!Authorizations.canDeleteOcpiendpoint(req.user, ocpiendpoint.getModel())) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_DELETE,
          Constants.ENTITY_OCPIENDPOINT,
          ocpiendpoint.getID(),
          560,
          'OcpiendpointService', 'handleDeleteOcpiendpoint',
          req.user);
      }
      // Delete
      await ocpiendpoint.delete();
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, module: 'OcpiendpointService', method: 'handleDeleteOcpiendpoint',
        message: `Ocpiendpoint '${ocpiendpoint.getName()}' has been deleted successfully`,
        action: action, detailedMessages: ocpiendpoint
      });
      // Ok
      res.json(Constants.REST_RESPONSE_SUCCESS);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleGetOcpiendpoint(action, req, res, next) {
    try {
      // Filter
      const filteredRequest = OcpiendpointSecurity.filterOcpiendpointRequest(req.query, req.user);
      // ID is mandatory
      if (!filteredRequest.ID) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Ocpiendpoint's ID must be provided`, 500,
          'OcpiendpointService', 'handleGetOcpiendpoint', req.user);
      }
      // Get it
      const ocpiendpoint = await Ocpiendpoint.getOcpiendpoint(req.user.tenantID, filteredRequest.ID);
      if (!ocpiendpoint) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Ocpiendpoint with ID '${filteredRequest.ID}' does not exist anymore`, 550,
          'OcpiendpointService', 'handleGetOcpiendpoint', req.user);
      }
      // Return
      res.json(
        // Filter
        OcpiendpointSecurity.filterOcpiendpointResponse(
          ocpiendpoint.getModel(), req.user)
      );
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleGetOcpiendpoints(action, req, res, next) {
    try {
      // Check auth
      if (!Authorizations.canListOcpiendpoints(req.user)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_LIST,
          Constants.ENTITY_OCPIENDPOINTS,
          null,
          560,
          'OcpiendpointService', 'handleGetOcpiendpoints',
          req.user);
      }
      // Filter
      const filteredRequest = OcpiendpointSecurity.filterOcpiendpointsRequest(req.query, req.user);
      // Get all ocpiendpoints
      const ocpiendpoints = await Ocpiendpoint.getOcpiendpoints(req.user.tenantID,
        {
          'search': filteredRequest.Search
        },
        filteredRequest.Limit, filteredRequest.Skip, filteredRequest.Sort);
      // Set
      ocpiendpoints.result = ocpiendpoints.result.map((ocpiendpoint) => ocpiendpoint.getModel());
      // Filter
      ocpiendpoints.result = OcpiendpointSecurity.filterOcpiendpointsResponse(
        ocpiendpoints.result, req.user);
      // Return
      res.json(ocpiendpoints);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleCreateOcpiendpoint(action, req, res, next) {
    try {
      // Check auth
      if (!Authorizations.canCreateOcpiendpoint(req.user)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_CREATE,
          Constants.ENTITY_OCPIENDPOINT,
          null,
          560,
          'OcpiendpointService', 'handleCreateOcpiendpoint',
          req.user);
      }
      // Filter
      const filteredRequest = OcpiendpointSecurity.filterSiteCreateRequest(req.body, req.user);
      // Check Mandatory fields
      Ocpiendpoint.checkIfOcpiendpointValid(filteredRequest, req);
      
      // Create ocpiendpoint
      const ocpiendpoint = new Ocpiendpoint(req.user.tenantID, filteredRequest);
      // Update timestamp
      ocpiendpoint.setCreatedBy(new User(req.user.tenantID, {'id': req.user.id}));
      ocpiendpoint.setCreatedOn(new Date());
      // Save Ocpiendpoint
      const newOcpiendpoint = await ocpiendpoint.save();
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, module: 'OcpiendpointService', method: 'handleCreateOcpiendpoint',
        message: `Ocpiendpoint '${newOcpiendpoint.getName()}' has been created successfully`,
        action: action, detailedMessages: newOcpiendpoint
      });
      // Ok
      res.json(Object.assign({ id: newOcpiendpoint.getID() }, Constants.REST_RESPONSE_SUCCESS));
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleUpdateOcpiendpoint(action, req, res, next) {
    try {
      // Filter
      const filteredRequest = OcpiendpointSecurity.filterSiteUpdateRequest(req.body, req.user);
      // Get Ocpiendpoint
      const ocpiendpoint = await Ocpiendpoint.getOcpiendpoint(req.user.tenantID, filteredRequest.id);
      if (!ocpiendpoint) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Ocpiendpoint with ID '${filteredRequest.id}' does not exist anymore`, 550,
          'OcpiendpointService', 'handleUpdateOcpiendpoint', req.user);
      }
      // Check Mandatory fields
      Ocpiendpoint.checkIfOcpiendpointValid(filteredRequest, req);
      // Check auth
      if (!Authorizations.canUpdateOcpiendpoint(req.user, ocpiendpoint.getModel())) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_UPDATE,
          Constants.ENTITY_OCPIENDPOINT,
          ocpiendpoint.getID(),
          560,
          'OcpiendpointService', 'handleUpdateOcpiendpoint',
          req.user);
      }
      // Update
      Database.updateOcpiendpoint(filteredRequest, ocpiendpoint.getModel());
      // Update timestamp
      ocpiendpoint.setLastChangedBy(new User(req.user.tenantID, {'id': req.user.id}));
      ocpiendpoint.setLastChangedOn(new Date());
      // Update Ocpiendpoint
      const updatedOcpiendpoint = await ocpiendpoint.save();
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, module: 'OcpiendpointService', method: 'handleUpdateOcpiendpoint',
        message: `Ocpiendpoint '${updatedOcpiendpoint.getName()}' has been updated successfully`,
        action: action, detailedMessages: updatedOcpiendpoint
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

module.exports = OcpiendpointService;
