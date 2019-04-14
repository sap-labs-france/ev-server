const Logging = require('../../../utils/Logging');
const Database = require('../../../utils/Database');
const AppError = require('../../../exception/AppError');
const AppAuthError = require('../../../exception/AppAuthError');
const Authorizations = require('../../../authorization/Authorizations');
const Constants = require('../../../utils/Constants');
const OCPIEndpoint = require('../../../entity/OCPIEndpoint');
const User = require('../../../entity/User');
const OCPIEndpointSecurity = require('./security/OCPIEndpointSecurity');
const OCPIClient = require('../../../client/ocpi/OCPIClient');

class OCPIEndpointService {
  static async handleDeleteOcpiendpoint(action, req, res, next) {
    try {
      // Filter
      const filteredRequest = OCPIEndpointSecurity.filterOcpiendpointDeleteRequest(req.query, req.user);
      // Check Mandatory fields
      if (!filteredRequest.ID) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Ocpiendpoint's ID must be provided`, 500,
          'OCPIEndpointService', 'handleDeleteOcpiendpoint', req.user);
      }
      // Get
      const ocpiendpoint = await OCPIEndpoint.getOcpiendpoint(req.user.tenantID, filteredRequest.ID);
      if (!ocpiendpoint) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `Ocpiendpoint with ID '${filteredRequest.ID}' does not exist`, 550,
          'OCPIEndpointService', 'handleDeleteOcpiendpoint', req.user);
      }
      // Check auth
      if (!Authorizations.canDeleteOcpiendpoint(req.user, ocpiendpoint.getModel())) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_DELETE,
          Constants.ENTITY_OCPIENDPOINT,
          ocpiendpoint.getID(),
          560,
          'OCPIEndpointService', 'handleDeleteOcpiendpoint',
          req.user);
      }
      // Delete
      await ocpiendpoint.delete();
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, module: 'OCPIEndpointService', method: 'handleDeleteOcpiendpoint',
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
      const filteredRequest = OCPIEndpointSecurity.filterOcpiendpointRequest(req.query, req.user);
      // ID is mandatory
      if (!filteredRequest.ID) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Ocpiendpoint's ID must be provided`, 500,
          'OCPIEndpointService', 'handleGetOcpiendpoint', req.user);
      }
      // Get it
      const ocpiendpoint = await OCPIEndpoint.getOcpiendpoint(req.user.tenantID, filteredRequest.ID);
      if (!ocpiendpoint) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Ocpiendpoint with ID '${filteredRequest.ID}' does not exist anymore`, 550,
          'OCPIEndpointService', 'handleGetOcpiendpoint', req.user);
      }
      // Return
      res.json(
        // Filter
        OCPIEndpointSecurity.filterOcpiendpointResponse(
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
          'OCPIEndpointService', 'handleGetOcpiendpoints',
          req.user);
      }
      // Filter
      const filteredRequest = OCPIEndpointSecurity.filterOcpiendpointsRequest(req.query, req.user);
      // Get all ocpiendpoints
      const ocpiendpoints = await OCPIEndpoint.getOcpiendpoints(req.user.tenantID,
        {
          'search': filteredRequest.Search
        },
        filteredRequest.Limit, filteredRequest.Skip, filteredRequest.Sort);
      // Set
      ocpiendpoints.result = ocpiendpoints.result.map((ocpiendpoint) => ocpiendpoint.getModel());
      // Filter
      ocpiendpoints.result = OCPIEndpointSecurity.filterOcpiendpointsResponse(
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
          'OCPIEndpointService', 'handleCreateOcpiendpoint',
          req.user);
      }
      // Filter
      const filteredRequest = OCPIEndpointSecurity.filterOcpiendpointCreateRequest(req.body, req.user);
      // Check Mandatory fields
      OCPIEndpoint.checkIfOcpiendpointValid(filteredRequest, req);

      // Create ocpiendpoint
      const ocpiendpoint = new OCPIEndpoint(req.user.tenantID, filteredRequest);
      // set status
      ocpiendpoint.setStatus(Constants.OCPI_REGISTERING_STATUS.OCPI_NEW);
      // Update timestamp
      ocpiendpoint.setCreatedBy(new User(req.user.tenantID, { 'id': req.user.id }));
      ocpiendpoint.setCreatedOn(new Date());
      // Save Ocpiendpoint
      const newOcpiendpoint = await ocpiendpoint.save();
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, module: 'OCPIEndpointService', method: 'handleCreateOcpiendpoint',
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
      const filteredRequest = OCPIEndpointSecurity.filterOcpiendpointUpdateRequest(req.body, req.user);
      // Get Ocpiendpoint
      const ocpiendpoint = await OCPIEndpoint.getOcpiendpoint(req.user.tenantID, filteredRequest.id);
      if (!ocpiendpoint) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Ocpiendpoint with ID '${filteredRequest.id}' does not exist anymore`, 550,
          'OCPIEndpointService', 'handleUpdateOcpiendpoint', req.user);
      }
      // Check Mandatory fields
      OCPIEndpoint.checkIfOcpiendpointValid(filteredRequest, req);
      // Check auth
      if (!Authorizations.canUpdateOcpiendpoint(req.user, ocpiendpoint.getModel())) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_UPDATE,
          Constants.ENTITY_OCPIENDPOINT,
          ocpiendpoint.getID(),
          560,
          'OCPIEndpointService', 'handleUpdateOcpiendpoint',
          req.user);
      }
      // Update
      Database.updateOcpiEndpoint(filteredRequest, ocpiendpoint.getModel());
      // Update timestamp
      ocpiendpoint.setLastChangedBy(new User(req.user.tenantID, { 'id': req.user.id }));
      ocpiendpoint.setLastChangedOn(new Date());
      // Update Ocpiendpoint
      const updatedOcpiendpoint = await ocpiendpoint.save();
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, module: 'OCPIEndpointService', method: 'handleUpdateOcpiendpoint',
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

  static async handlePingOcpiendpoint(action, req, res, next) {
    try {
      // Check auth
      if (!Authorizations.canPingOcpiendpoint(req.user)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_PING,
          Constants.ENTITY_OCPIENDPOINT,
          null,
          560,
          'OCPIEndpointService', 'handlePingOcpiendpoint',
          req.user);
      }
      // Filter
      const filteredRequest = OCPIEndpointSecurity.filterOcpiendpointPingRequest(req.body, req.user);
      // Check Mandatory fields
      OCPIEndpoint.checkIfOcpiendpointValid(filteredRequest, req);
      // Create temporary ocpiendpoint
      const ocpiendpoint = new OCPIEndpoint(req.user.tenantID, filteredRequest);
      // build OCPI Client
      const ocpiClient = new OCPIClient(ocpiendpoint);
      // try to ping
      const pingResult = await ocpiClient.ping();
      // check ping result
      if (pingResult.statusCode === 200) {
        // Log
        Logging.logSecurityInfo({
          tenantID: req.user.tenantID,
          user: req.user, module: 'OCPIEndpointService', method: 'handlePingOcpiendpoint',
          message: `Ocpiendpoint '${ocpiendpoint.getName()}' can be reached successfully`,
          action: action, detailedMessages: pingResult
        });
        res.json(Object.assign(pingResult, Constants.REST_RESPONSE_SUCCESS));
      } else {
        // Log
        Logging.logSecurityError({
          tenantID: req.user.tenantID,
          user: req.user, module: 'OCPIEndpointService', method: 'handlePingOcpiendpoint',
          message: `Ocpiendpoint '${ocpiendpoint.getName()}' cannot be reached`,
          action: action, detailedMessages: pingResult
        });
        res.json(pingResult);
      }
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleSendEVSEStatusesOcpiendpoint(action, req, res, next) {
    try {
      // Check auth
      if (!Authorizations.canSendEVSEStatusesOcpiendpoint(req.user)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_SEND_EVSE_STATUSES,
          Constants.ENTITY_OCPIENDPOINT,
          null,
          560,
          'OCPIEndpointService', 'handleSendEVSEStatusesOcpiendpoint',
          req.user);
      }
      // Filter
      const filteredRequest = OCPIEndpointSecurity.filterOcpiendpointSendEVSEStatusesRequest(req.body, req.user);
      // Check Mandatory fields
      OCPIEndpoint.checkIfOcpiendpointValid(filteredRequest, req);
      // get ocpiendpoint
      const ocpiendpoint = await OCPIEndpoint.getOcpiendpoint(req.user.tenantID, filteredRequest.id);
      // build OCPI Client
      const ocpiClient = new OCPIClient(ocpiendpoint);
      // send EVSE statuses
      const sendResult = await ocpiClient.sendEVSEStatuses();
      // return result
      res.json(sendResult);

      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleRegisterOcpiendpoint(action, req, res, next) {
    try {
      // Filter
      const filteredRequest = OCPIEndpointSecurity.filterOcpiendpointRegisterRequest(req.body, req.user);
      // Get Ocpiendpoint
      const ocpiendpoint = await OCPIEndpoint.getOcpiendpoint(req.user.tenantID, filteredRequest.id);
      if (!ocpiendpoint) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Ocpiendpoint with ID '${filteredRequest.id}' does not exist anymore`, 550,
          'OCPIEndpointService', 'handleRegisterOcpiendpoint', req.user);
      }
      // Check Mandatory fields
      OCPIEndpoint.checkIfOcpiendpointValid(filteredRequest, req);
      // Check auth
      if (!Authorizations.canRegisterOcpiendpoint(req.user, ocpiendpoint.getModel())) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_REGISTER,
          Constants.ENTITY_OCPIENDPOINT,
          null,
          560,
          'OCPIEndpointService', 'handleRegisterOcpiendpoint',
          req.user);
      }
      // build OCPI Client
      const ocpiClient = new OCPIClient(ocpiendpoint);
      // try to ping
      const pingResult = await ocpiClient.register();

      // check ping result
      if (pingResult.statusCode === 200) {
        // Log
        Logging.logSecurityInfo({
          tenantID: req.user.tenantID,
          user: req.user, module: 'OCPIEndpointService', method: 'handleRegisterOcpiendpoint',
          message: `Ocpiendpoint '${ocpiendpoint.getName()}' can be reached successfully`,
          action: action, detailedMessages: pingResult
        });
        res.json(Object.assign(pingResult, Constants.REST_RESPONSE_SUCCESS));
      } else {
        // Log
        Logging.logSecurityError({
          tenantID: req.user.tenantID,
          user: req.user, module: 'OCPIEndpointService', method: 'handleRegisterOcpiendpoint',
          message: `Ocpiendpoint '${ocpiendpoint.getName()}' cannot be reached`,
          action: action, detailedMessages: pingResult
        });
        res.json(pingResult);
      }
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleGenerateLocalTokenOcpiendpoint(action, req, res, next) {
    try {
      // Check auth
      if (!Authorizations.canGenerateLocalTokenOcpiendpoint(req.user)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_GENERATE_LOCAL_TOKEN,
          Constants.ENTITY_OCPIENDPOINT,
          null,
          560,
          'OCPIEndpointService', 'handleGenerateLocalTokenOcpiendpoint',
          req.user);
      }
      // Filter
      const filteredRequest = OCPIEndpointSecurity.filterOcpiendpointGenerateLocalTokenRequest(req.body, req.user);
      // Check Mandatory fields
      OCPIEndpoint.checkIfOcpiendpointValid(filteredRequest, req);
      // Create ocpiendpoint
      const ocpiendpoint = new OCPIEndpoint(req.user.tenantID, filteredRequest);
      // Generate new local token
      const localToken = await ocpiendpoint.generateLocalToken();
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, module: 'OCPIEndpointService', method: 'handleGenerateLocalTokenOcpiendpoint',
        message: `Local Token for Ocpiendpoint '${ocpiendpoint.getName()}' has been generatd successfully`,
        action: action, detailedMessages: ocpiendpoint
      });
      // Ok
      res.json(Object.assign({ id: ocpiendpoint.getID(), localToken: localToken }, Constants.REST_RESPONSE_SUCCESS));
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }
}

module.exports = OCPIEndpointService;
