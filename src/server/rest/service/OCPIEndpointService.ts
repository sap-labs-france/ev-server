import Logging from '../../../utils/Logging';
import Database from '../../../utils/Database';
import AppError from '../../../exception/AppError';
import AppAuthError from '../../../exception/AppAuthError';
import Authorizations from '../../../authorization/Authorizations';
import Constants from '../../../utils/Constants';
import OCPIEndpoint from '../../../entity/OCPIEndpoint';
import User from '../../../entity/User';
import OCPIEndpointSecurity from './security/OCPIEndpointSecurity';
import OCPIClient from '../../../client/ocpi/OCPIClient';

export default class OCPIEndpointService {
  static async handleDeleteOcpiEndpoint(action, req, res, next) {
    try {
      // Filter
      const filteredRequest = OCPIEndpointSecurity.filterOcpiEndpointDeleteRequest(req.query, req.user);
      // Check Mandatory fields
      if (!filteredRequest.ID) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Ocpi Endpoint's ID must be provided`, 500,
          'OCPIEndpointService', 'handleDeleteOcpiEndpoint', req.user);
      }
      // Get
      const ocpiendpoint = await OCPIEndpoint.getOcpiEndpoint(req.user.tenantID, filteredRequest.ID);
      if (!ocpiendpoint) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `Ocpi Endpoint with ID '${filteredRequest.ID}' does not exist`, 550,
          'OCPIEndpointService', 'handleDeleteOcpiEndpoint', req.user);
      }
      // Check auth
      if (!Authorizations.canDeleteOcpiEndpoint(req.user, ocpiendpoint.getModel())) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_DELETE,
          Constants.ENTITY_OCPI_ENDPOINT,
          ocpiendpoint.getID(),
          560,
          'OCPIEndpointService', 'handleDeleteOcpiEndpoint',
          req.user);
      }
      // Delete
      await ocpiendpoint.delete();
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, module: 'OCPIEndpointService', method: 'handleDeleteOcpiEndpoint',
        message: `Ocpi Endpoint '${ocpiendpoint.getName()}' has been deleted successfully`,
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

  static async handleGetOcpiEndpoint(action, req, res, next) {
    try {
      // Filter
      const filteredRequest = OCPIEndpointSecurity.filterOcpiEndpointRequest(req.query, req.user);
      // ID is mandatory
      if (!filteredRequest.ID) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Ocpi Endpoint's ID must be provided`, 500,
          'OCPIEndpointService', 'handleGetOcpiEndpoint', req.user);
      }
      // Get it
      const ocpiendpoint = await OCPIEndpoint.getOcpiEndpoint(req.user.tenantID, filteredRequest.ID);
      if (!ocpiendpoint) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Ocpi Endpoint with ID '${filteredRequest.ID}' does not exist anymore`, 550,
          'OCPIEndpointService', 'handleGetOcpiEndpoint', req.user);
      }
      // Return
      res.json(
        // Filter
        OCPIEndpointSecurity.filterOcpiEndpointResponse(
          ocpiendpoint.getModel(), req.user)
      );
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleGetOcpiEndpoints(action, req, res, next) {
    try {
      // Check auth
      if (!Authorizations.canListOcpiEndpoints(req.user)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_LIST,
          Constants.ENTITY_OCPI_ENDPOINTS,
          null,
          560,
          'OCPIEndpointService', 'handleGetOcpiEndpoints',
          req.user);
      }
      // Filter
      const filteredRequest = OCPIEndpointSecurity.filterOcpiEndpointsRequest(req.query, req.user);
      // Get all ocpiendpoints
      const ocpiendpoints = await OCPIEndpoint.getOcpiEndpoints(req.user.tenantID,
        {
          'search': filteredRequest.Search
        },
        filteredRequest.Limit, filteredRequest.Skip, filteredRequest.Sort);
      // Set
      ocpiendpoints.result = ocpiendpoints.result.map((ocpiendpoint) => { return ocpiendpoint.getModel(); });
      // Filter
      ocpiendpoints.result = OCPIEndpointSecurity.filterOcpiEndpointsResponse(
        ocpiendpoints.result, req.user);
      // Return
      res.json(ocpiendpoints);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleCreateOcpiEndpoint(action, req, res, next) {
    try {
      // Check auth
      if (!Authorizations.canCreateOcpiEndpoint(req.user)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_CREATE,
          Constants.ENTITY_OCPI_ENDPOINT,
          null,
          560,
          'OCPIEndpointService', 'handleCreateOcpiEndpoint',
          req.user);
      }
      // Filter
      const filteredRequest = OCPIEndpointSecurity.filterOcpiEndpointCreateRequest(req.body, req.user);
      // Check Mandatory fields
      OCPIEndpoint.checkIfOcpiEndpointValid(filteredRequest, req);

      // Create ocpiendpoint
      const ocpiendpoint = new OCPIEndpoint(req.user.tenantID, filteredRequest);
      // Set status
      ocpiendpoint.setStatus(Constants.OCPI_REGISTERING_STATUS.OCPI_NEW);
      // Update timestamp
      ocpiendpoint.setCreatedBy(new User(req.user.tenantID, { 'id': req.user.id }));
      ocpiendpoint.setCreatedOn(new Date());
      // Save OcpiEndpoint
      const newOcpiEndpoint = await ocpiendpoint.save();
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, module: 'OCPIEndpointService', method: 'handleCreateOcpiEndpoint',
        message: `Ocpi Endpoint '${newOcpiEndpoint.getName()}' has been created successfully`,
        action: action, detailedMessages: newOcpiEndpoint
      });
      // Ok
      res.json(Object.assign({ id: newOcpiEndpoint.getID() }, Constants.REST_RESPONSE_SUCCESS));
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleUpdateOcpiEndpoint(action, req, res, next) {
    try {
      // Filter
      const filteredRequest = OCPIEndpointSecurity.filterOcpiEndpointUpdateRequest(req.body, req.user);
      // Get OcpiEndpoint
      const ocpiendpoint = await OCPIEndpoint.getOcpiEndpoint(req.user.tenantID, filteredRequest.id);
      if (!ocpiendpoint) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Ocpi Endpoint with ID '${filteredRequest.id}' does not exist anymore`, 550,
          'OCPIEndpointService', 'handleUpdateOcpiEndpoint', req.user);
      }
      // Check Mandatory fields
      OCPIEndpoint.checkIfOcpiEndpointValid(filteredRequest, req);
      // Check auth
      if (!Authorizations.canUpdateOcpiEndpoint(req.user, ocpiendpoint.getModel())) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_UPDATE,
          Constants.ENTITY_OCPI_ENDPOINT,
          ocpiendpoint.getID(),
          560,
          'OCPIEndpointService', 'handleUpdateOcpiEndpoint',
          req.user);
      }
      // Update
      Database.updateOcpiEndpoint(filteredRequest, ocpiendpoint.getModel());
      // Update timestamp
      ocpiendpoint.setLastChangedBy(new User(req.user.tenantID, { 'id': req.user.id }));
      ocpiendpoint.setLastChangedOn(new Date());
      // Update OcpiEndpoint
      const updatedOcpiEndpoint = await ocpiendpoint.save();
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, module: 'OCPIEndpointService', method: 'handleUpdateOcpiEndpoint',
        message: `Ocpi Endpoint '${updatedOcpiEndpoint.getName()}' has been updated successfully`,
        action: action, detailedMessages: updatedOcpiEndpoint
      });
      // Ok
      res.json(Constants.REST_RESPONSE_SUCCESS);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handlePingOcpiEndpoint(action, req, res, next) {
    try {
      // Check auth
      if (!Authorizations.canPingOcpiEndpoint(req.user)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_PING,
          Constants.ENTITY_OCPI_ENDPOINT,
          null,
          560,
          'OCPIEndpointService', 'handlePingOcpiEndpoint',
          req.user);
      }
      // Filter
      const filteredRequest = OCPIEndpointSecurity.filterOcpiEndpointPingRequest(req.body, req.user);
      // Check Mandatory fields
      OCPIEndpoint.checkIfOcpiEndpointValid(filteredRequest, req);
      // Create temporary ocpiendpoint
      const ocpiendpoint = new OCPIEndpoint(req.user.tenantID, filteredRequest);
      // Build OCPI Client
      const ocpiClient = new OCPIClient(ocpiendpoint);
      // Try to ping
      const pingResult = await ocpiClient.ping();
      // Check ping result
      if (pingResult.statusCode === 200) {
        // Log
        Logging.logSecurityInfo({
          tenantID: req.user.tenantID,
          user: req.user, module: 'OCPIEndpointService', method: 'handlePingOcpiEndpoint',
          message: `Ocpi Endpoint '${ocpiendpoint.getName()}' can be reached successfully`,
          action: action, detailedMessages: pingResult
        });
        res.json(Object.assign(pingResult, Constants.REST_RESPONSE_SUCCESS));
      } else {
        // Log
        Logging.logSecurityError({
          tenantID: req.user.tenantID,
          user: req.user, module: 'OCPIEndpointService', method: 'handlePingOcpiEndpoint',
          message: `Ocpi Endpoint '${ocpiendpoint.getName()}' cannot be reached`,
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

  static async handleSendEVSEStatusesOcpiEndpoint(action, req, res, next) {
    try {
      // Check auth
      if (!Authorizations.canSendEVSEStatusesOcpiEndpoint(req.user)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_SEND_EVSE_STATUSES,
          Constants.ENTITY_OCPI_ENDPOINT,
          null,
          560,
          'OCPIEndpointService', 'handleSendEVSEStatusesOcpiEndpoint',
          req.user);
      }
      // Filter
      const filteredRequest = OCPIEndpointSecurity.filterOcpiEndpointSendEVSEStatusesRequest(req.body, req.user);
      // Check Mandatory fields
      OCPIEndpoint.checkIfOcpiEndpointValid(filteredRequest, req);
      // Get ocpiendpoint
      const ocpiendpoint = await OCPIEndpoint.getOcpiEndpoint(req.user.tenantID, filteredRequest.id);
      // Build OCPI Client
      const ocpiClient = new OCPIClient(ocpiendpoint);
      // Send EVSE statuses
      const sendResult = await ocpiClient.sendEVSEStatuses();
      // Return result
      res.json(sendResult);

      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleRegisterOcpiEndpoint(action, req, res, next) {
    try {
      // Filter
      const filteredRequest = OCPIEndpointSecurity.filterOcpiEndpointRegisterRequest(req.body, req.user);
      // Get OcpiEndpoint
      const ocpiendpoint = await OCPIEndpoint.getOcpiEndpoint(req.user.tenantID, filteredRequest.id);
      if (!ocpiendpoint) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Ocpi Endpoint with ID '${filteredRequest.id}' does not exist anymore`, 550,
          'OCPIEndpointService', 'handleRegisterOcpiEndpoint', req.user);
      }
      // Check Mandatory fields
      OCPIEndpoint.checkIfOcpiEndpointValid(filteredRequest, req);
      // Check auth
      if (!Authorizations.canRegisterOcpiEndpoint(req.user, ocpiendpoint.getModel())) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_REGISTER,
          Constants.ENTITY_OCPI_ENDPOINT,
          null,
          560,
          'OCPIEndpointService', 'handleRegisterOcpiEndpoint',
          req.user);
      }
      // Build OCPI Client
      const ocpiClient = new OCPIClient(ocpiendpoint);
      // Try to ping
      const pingResult = await ocpiClient.register();

      // Check ping result
      if (pingResult.statusCode === 200) {
        // Log
        Logging.logSecurityInfo({
          tenantID: req.user.tenantID,
          user: req.user, module: 'OCPIEndpointService', method: 'handleRegisterOcpiEndpoint',
          message: `Ocpi Endpoint '${ocpiendpoint.getName()}' can be reached successfully`,
          action: action, detailedMessages: pingResult
        });
        res.json(Object.assign(pingResult, Constants.REST_RESPONSE_SUCCESS));
      } else {
        // Log
        Logging.logSecurityError({
          tenantID: req.user.tenantID,
          user: req.user, module: 'OCPIEndpointService', method: 'handleRegisterOcpiEndpoint',
          message: `Ocpi Endpoint '${ocpiendpoint.getName()}' cannot be reached`,
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

  static async handleGenerateLocalTokenOcpiEndpoint(action, req, res, next) {
    try {
      // Check auth
      if (!Authorizations.canGenerateLocalTokenOcpiEndpoint(req.user)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_GENERATE_LOCAL_TOKEN,
          Constants.ENTITY_OCPI_ENDPOINT,
          null,
          560,
          'OCPIEndpointService', 'handleGenerateLocalTokenOcpiEndpoint',
          req.user);
      }
      // Filter
      const filteredRequest = OCPIEndpointSecurity.filterOcpiEndpointGenerateLocalTokenRequest(req.body, req.user);
      // Check Mandatory fields
      OCPIEndpoint.checkIfOcpiEndpointValid(filteredRequest, req);
      // Create ocpiendpoint
      const ocpiendpoint = new OCPIEndpoint(req.user.tenantID, filteredRequest);
      // Generate new local token
      const localToken = await ocpiendpoint.generateLocalToken();
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, module: 'OCPIEndpointService', method: 'handleGenerateLocalTokenOcpiEndpoint',
        message: `Local Token for Ocpi Endpoint '${ocpiendpoint.getName()}' has been generatd successfully`,
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


