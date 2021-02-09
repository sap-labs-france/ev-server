import { Action, Entity } from '../../../../types/Authorization';
import { Car, CarType } from '../../../../types/Car';
import ChargingStation, { ChargePoint } from '../../../../types/ChargingStation';
import { HTTPAuthError, HTTPError } from '../../../../types/HTTPError';
import { NextFunction, Request, Response } from 'express';
import User, { UserRole, UserStatus } from '../../../../types/User';

import AppAuthError from '../../../../exception/AppAuthError';
import AppError from '../../../../exception/AppError';
import Asset from '../../../../types/Asset';
import Authorizations from '../../../../authorization/Authorizations';
import { ChargingProfile } from '../../../../types/ChargingProfile';
import Company from '../../../../types/Company';
import Constants from '../../../../utils/Constants';
import { DataResult } from '../../../../types/DataResult';
import { HttpEndUserReportErrorRequest } from '../../../../types/requests/HttpNotificationRequest';
import Logging from '../../../../utils/Logging';
import OCPIEndpoint from '../../../../types/ocpi/OCPIEndpoint';
import PDFDocument from 'pdfkit';
import { ServerAction } from '../../../../types/Server';
import Site from '../../../../types/Site';
import SiteArea from '../../../../types/SiteArea';
import Tag from '../../../../types/Tag';
import TenantComponents from '../../../../types/TenantComponents';
import { TransactionInErrorType } from '../../../../types/InError';
import UserToken from '../../../../types/UserToken';
import Utils from '../../../../utils/Utils';
import countries from 'i18n-iso-countries';
import moment from 'moment';

const MODULE_NAME = 'UtilsService';

export default class UtilsService {
  public static sendEmptyDataResult(res: Response, next: NextFunction): void {
    res.json(Constants.DB_EMPTY_DATA_RESULT);
    next();
  }

  public static handleUnknownAction(action: ServerAction, req: Request, res: Response, next: NextFunction): void {
    // Action provided
    if (!action) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(
        null, new Error('No Action has been provided'), req, res, next);
    } else {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(
        action, new Error(`The Action '${action}' does not exist`), req, res, next);
    }
  }

  public static getTransactionInErrorTypes(user: UserToken): TransactionInErrorType[] {
    // For only charging station in e-Mobility (not the ones from the roaming)
    const allTypes = [
      TransactionInErrorType.LONG_INACTIVITY,
      TransactionInErrorType.NEGATIVE_ACTIVITY,
      TransactionInErrorType.NEGATIVE_DURATION,
      // TransactionInErrorType.OVER_CONSUMPTION, // To much time consuming + to check if calculation is right
      TransactionInErrorType.INVALID_START_DATE,
      TransactionInErrorType.NO_CONSUMPTION,
      TransactionInErrorType.MISSING_USER
    ];
    if (Utils.isComponentActiveFromToken(user, TenantComponents.PRICING)) {
      allTypes.push(TransactionInErrorType.MISSING_PRICE);
    }
    if (Utils.isComponentActiveFromToken(user, TenantComponents.BILLING)) {
      allTypes.push(TransactionInErrorType.NO_BILLING_DATA);
    }
    return allTypes;
  }

  public static assertIdIsProvided(action: ServerAction, id: string|number, module: string, method: string, userToken: UserToken): void {
    if (!id) {
      // Object does not exist
      throw new AppError({
        action,
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The ID must be provided',
        module: module,
        method: method,
        user: userToken
      });
    }
  }

  public static assertObjectExists(action: ServerAction, object: any, errorMsg: string, module: string, method: string, userToken?: UserToken): void {
    if (!object) {
      throw new AppError({
        action,
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
        message: errorMsg,
        module: module,
        method: method,
        user: userToken
      });
    }
  }

  public static checkIfOCPIEndpointValid(ocpiEndpoint: Partial<OCPIEndpoint>, req: Request): void {
    if (req.method !== 'POST' && !ocpiEndpoint.id) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The OCPI Endpoint ID is mandatory',
        module: MODULE_NAME,
        method: 'checkIfOCPIEndpointValid'
      });
    }
    if (!ocpiEndpoint.name) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The OCPI Endpoint name is mandatory',
        module: MODULE_NAME,
        method: 'checkIfOCPIEndpointValid',
        user: req.user.id
      });
    }
    if (!ocpiEndpoint.role) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The OCPI Endpoint role is mandatory',
        module: MODULE_NAME,
        method: 'checkIfOCPIEndpointValid',
        user: req.user.id
      });
    }
    if (!ocpiEndpoint.baseUrl) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The OCPI Endpoint base URL is mandatory',
        module: MODULE_NAME,
        method: 'checkIfOCPIEndpointValid',
        user: req.user.id
      });
    }
    if (ocpiEndpoint.countryCode && !countries.isValid(ocpiEndpoint.countryCode)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `The OCPI Endpoint ${ocpiEndpoint.countryCode} country code provided is invalid`,
        module: MODULE_NAME,
        method: 'checkIfOCPIEndpointValid',
        user: req.user.id
      });
    }
    if (!ocpiEndpoint.localToken) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The OCPI Endpoint local token is mandatory',
        module: MODULE_NAME,
        method: 'checkIfOCPIEndpointValid',
        user: req.user.id
      });
    }
    if (!ocpiEndpoint.token) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The OCPI Endpoint token is mandatory',
        module: MODULE_NAME,
        method: 'checkIfOCPIEndpointValid',
        user: req.user.id
      });
    }
  }

  public static httpSortFieldsToMongoDB(httpSortFields: string): any {
    // Exist?
    if (httpSortFields) {
      const dbSortField: any = {};
      // Sanitize
      const sortFields = httpSortFields.split('|');
      // Build
      for (let sortField of sortFields) {
        // Order
        const order = sortField.startsWith('-') ? -1 : 1;
        // Remove the '-'
        if (order === -1) {
          sortField = sortField.substr(1);
        }
        // Check field ID
        if (sortField === 'id') {
          // In MongoDB it's '_id'
          sortField = '_id';
        }
        // Set
        dbSortField[sortField] = order;
      }
      return dbSortField;
    }
  }

  public static assertComponentIsActiveFromToken(userToken: UserToken, component: TenantComponents,
    action: Action, entity: Entity, module: string, method: string): void {
    // Check from token
    const active = Utils.isComponentActiveFromToken(userToken, component);
    // Throw
    if (!active) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        entity: entity, action: action,
        module: module, method: method,
        inactiveComponent: component,
        user: userToken
      });
    }
  }

  public static async exportToCSV(req: Request, res: Response, attachementName: string,
    handleGetData: (req: Request) => Promise<DataResult<any>>,
    handleConvertToCSV: (req: Request, data: any[], writeHeader: boolean) => string): Promise<void> {
    // Override
    req.query.Limit = Constants.EXPORT_PAGE_SIZE.toString();
    // Set the attachment name
    res.attachment(attachementName);
    // Get the total number of Logs
    req.query.OnlyRecordCount = 'true';
    let data = await handleGetData(req);
    let count = data.count;
    delete req.query.OnlyRecordCount;
    let skip = 0;
    // Limit the number of records
    if (count > Constants.EXPORT_RECORD_MAX_COUNT) {
      count = Constants.EXPORT_RECORD_MAX_COUNT;
    }
    // Handle closed socket
    let connectionClosed = false;
    req.connection.on('close', () => {
      connectionClosed = true;
    });
    do {
      // Check if the socket is closed and stop the process
      if (connectionClosed) {
        break;
      }
      // Get the data
      req.query.Skip = skip.toString();
      data = await handleGetData(req);
      // Get CSV data
      const csvData = handleConvertToCSV(req, data.result, (skip === 0));
      // Send Transactions
      res.write(csvData);
      // Next page
      skip += Constants.EXPORT_PAGE_SIZE;
    } while (skip < count);
    // End of stream
    res.end();
  }

  public static async exportToPDF(req: Request, res: Response, attachementName: string,
    handleGetData: (req: Request) => Promise<DataResult<any>>,
    handleConvertToPDF: (req: Request, pdfDocument: PDFKit.PDFDocument, data: any[]) => Promise<string>): Promise<void> {
    // Override
    req.query.Limit = Constants.EXPORT_PDF_PAGE_SIZE.toString();
    // Set the attachment name
    res.attachment(attachementName);
    // Get the total number of Logs
    req.query.OnlyRecordCount = 'true';
    let data = await handleGetData(req);
    let count = data.count;
    delete req.query.OnlyRecordCount;
    let skip = 0;
    // Limit the number of records
    if (count > Constants.EXPORT_PDF_PAGE_SIZE) {
      count = Constants.EXPORT_PDF_PAGE_SIZE;
    }
    // Handle closed socket
    let connectionClosed = false;
    req.connection.on('close', () => {
      connectionClosed = true;
    });
    // Create the PDF
    const pdfDocument = new PDFDocument();
    pdfDocument.pipe(res);
    do {
      // Check if the socket is closed and stop the process
      if (connectionClosed) {
        break;
      }
      // Get the data
      req.query.Skip = skip.toString();
      data = await handleGetData(req);
      // Transform data
      await handleConvertToPDF(req, pdfDocument, data.result);
      // Next page
      skip += Constants.EXPORT_PAGE_SIZE;
    } while (skip < count);
    // Finish
    pdfDocument.end();
  }

  public static checkIfChargingProfileIsValid(chargingStation: ChargingStation, chargePoint: ChargePoint,
    filteredRequest: ChargingProfile, req: Request): void {
    if (!Utils.objectHasProperty(filteredRequest, 'chargingStationID')) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.CHARGING_PROFILE_UPDATE,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Charging Station ID is mandatory',
        module: MODULE_NAME, method: 'checkIfChargingProfileIsValid',
        user: req.user.id
      });
    }
    if (!Utils.objectHasProperty(filteredRequest, 'connectorID')) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.CHARGING_PROFILE_UPDATE,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Connector ID is mandatory',
        module: MODULE_NAME, method: 'checkIfChargingProfileIsValid',
        user: req.user.id
      });
    }
    if (!filteredRequest.profile) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.CHARGING_PROFILE_UPDATE,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Charging Profile is mandatory',
        module: MODULE_NAME, method: 'checkIfChargingProfileIsValid',
        user: req.user.id
      });
    }
    if (!filteredRequest.profile.chargingProfileId || !filteredRequest.profile.stackLevel ||
      !filteredRequest.profile.chargingProfilePurpose || !filteredRequest.profile.chargingProfileKind ||
      !filteredRequest.profile.chargingSchedule) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.CHARGING_PROFILE_UPDATE,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Invalid Charging Profile',
        module: MODULE_NAME, method: 'checkIfChargingProfileIsValid',
        user: req.user.id
      });
    }
    if (!filteredRequest.profile.chargingSchedule.chargingSchedulePeriod) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.CHARGING_PROFILE_UPDATE,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Invalid Charging Profile\'s Schedule',
        module: MODULE_NAME, method: 'checkIfChargingProfileIsValid',
        user: req.user.id
      });
    }
    if (filteredRequest.profile.chargingSchedule.chargingSchedulePeriod.length === 0) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.CHARGING_PROFILE_UPDATE,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Charging Profile\'s schedule must not be empty',
        module: MODULE_NAME, method: 'checkIfChargingProfileIsValid',
        user: req.user.id
      });
    }
    // Check End of Schedule <= 24h
    const endScheduleDate = new Date(new Date(filteredRequest.profile.chargingSchedule.startSchedule).getTime() +
      filteredRequest.profile.chargingSchedule.duration * 1000);
    if (!moment(endScheduleDate).isBefore(moment(filteredRequest.profile.chargingSchedule.startSchedule).add('1', 'd').add('1', 'm'))) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.CHARGING_PROFILE_UPDATE,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Charging Profile\'s schedule should not exeed 24 hours',
        module: MODULE_NAME, method: 'checkIfChargingProfileIsValid',
        user: req.user.id
      });
    }
    // Check Max Limitation of each Schedule
    // const numberOfPhases = Utils.getNumberOfConnectedPhases(chargingStation, null, filteredRequest.connectorID);
    // const numberOfConnectors = filteredRequest.connectorID === 0 ?
    //   (chargePoint ? chargePoint.connectorIDs.length : chargingStation.connectors.length) : 1;
    const maxAmpLimit = Utils.getChargingStationAmperageLimit(chargingStation, chargePoint, filteredRequest.connectorID);
    for (const chargingSchedulePeriod of filteredRequest.profile.chargingSchedule.chargingSchedulePeriod) {
      // Check Min
      if (chargingSchedulePeriod.limit < 0) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          action: ServerAction.CHARGING_PROFILE_UPDATE,
          errorCode: HTTPError.GENERAL_ERROR,
          message: 'Charging Schedule is below the min limitation (0A)',
          module: MODULE_NAME, method: 'checkIfChargingProfileIsValid',
          user: req.user.id,
          detailedMessages: { chargingSchedulePeriod }
        });
      }
      // Check Max
      if (chargingSchedulePeriod.limit > maxAmpLimit) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          action: ServerAction.CHARGING_PROFILE_UPDATE,
          errorCode: HTTPError.GENERAL_ERROR,
          message: `Charging Schedule is above the max limitation (${maxAmpLimit}A)`,
          module: MODULE_NAME, method: 'checkIfChargingProfileIsValid',
          user: req.user.id,
          detailedMessages: { chargingSchedulePeriod }
        });
      }
    }
  }

  public static checkIfSiteValid(site: Partial<Site>, req: Request): void {
    if (req.method !== 'POST' && !site.id) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Site ID is mandatory',
        module: MODULE_NAME, method: 'checkIfSiteValid',
        user: req.user.id
      });
    }
    if (!site.name) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Site Name is mandatory',
        module: MODULE_NAME, method: 'checkIfSiteValid',
        user: req.user.id
      });
    }
    if (!site.companyID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Company ID is mandatory for the Site',
        module: MODULE_NAME, method: 'checkIfSiteValid',
        user: req.user.id
      });
    }
  }

  public static checkIfSiteAreaValid(siteArea: Partial<SiteArea>, req: Request): void {
    if (req.method !== 'POST' && !siteArea.id) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Site Area ID is mandatory',
        module: MODULE_NAME, method: 'checkIfSiteAreaValid',
        user: req.user.id
      });
    }
    if (!siteArea.name) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Site Area name is mandatory',
        module: MODULE_NAME, method: 'checkIfSiteAreaValid',
        user: req.user.id
      });
    }
    if (!siteArea.siteID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Site ID is mandatory',
        module: MODULE_NAME, method: 'checkIfSiteAreaValid',
        user: req.user.id
      });
    }
    // Power
    if (siteArea.maximumPower <= 0) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Site maximum power must be a positive number but got ${siteArea.maximumPower} kW`,
        module: MODULE_NAME, method: 'checkIfSiteAreaValid',
        user: req.user.id
      });
    }
    if (siteArea.voltage !== 230 && siteArea.voltage !== 110) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Site voltage must be either 110V or 230V but got ${siteArea.voltage} kW`,
        module: MODULE_NAME, method: 'checkIfSiteAreaValid',
        user: req.user.id
      });
    }
    if (siteArea.numberOfPhases !== 1 && siteArea.numberOfPhases !== 3) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Site area number of phases must be either 1 or 3 but got ${siteArea.numberOfPhases}`,
        module: MODULE_NAME, method: 'checkIfSiteAreaValid',
        user: req.user.id
      });
    }
  }

  public static checkIfCompanyValid(company: Partial<Company>, req: Request): void {
    if (req.method !== 'POST' && !company.id) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Company ID is mandatory',
        module: MODULE_NAME, method: 'checkIfCompanyValid',
        user: req.user.id
      });
    }
    if (!company.name) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Company Name is mandatory',
        module: MODULE_NAME, method: 'checkIfCompanyValid',
        user: req.user.id
      });
    }
  }

  public static checkIfAssetValid(asset: Partial<Asset>, req: Request): void {
    if (req.method !== 'POST' && !asset.id) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Asset ID is mandatory',
        module: MODULE_NAME, method: 'checkIfAssetValid',
        user: req.user.id
      });
    }
    if (!asset.name) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Asset Name is mandatory',
        module: MODULE_NAME, method: 'checkIfAssetValid',
        user: req.user.id
      });
    }
    if (!asset.siteAreaID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Asset Site Area is mandatory',
        module: MODULE_NAME, method: 'checkIfAssetValid',
        user: req.user.id
      });
    }
    if (!asset.assetType) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Asset type is mandatory',
        module: MODULE_NAME, method: 'checkIfAssetValid',
        user: req.user.id
      });
    }
    if (!(typeof asset.staticValueWatt === 'number')) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Fallback value must be of type number',
        module: MODULE_NAME, method: 'checkIfAssetValid',
        user: req.user.id
      });
    }
    if (Utils.objectHasProperty(asset, 'fluctuationPercent')) {
      if (!(typeof asset.fluctuationPercent === 'number') || asset.fluctuationPercent < 0 || asset.fluctuationPercent > 100) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.GENERAL_ERROR,
          message: 'Fluctuation percentage should be between 0 and 100',
          module: MODULE_NAME, method: 'checkIfAssetValid',
          user: req.user.id
        });
      }
    }
    if (asset.dynamicAsset) {
      if (!asset.connectionID) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.GENERAL_ERROR,
          message: 'Asset connection is mandatory',
          module: MODULE_NAME, method: 'checkIfAssetValid',
          user: req.user.id
        });
      }
      if (!asset.meterID) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.GENERAL_ERROR,
          message: 'Asset meter ID is mandatory',
          module: MODULE_NAME, method: 'checkIfAssetValid',
          user: req.user.id
        });
      }
    }
  }

  public static async checkIfUserTagIsValid(tag: Partial<Tag>, req: Request): Promise<void> {
    // Check badge ID
    if (!tag.id) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Tag ID is mandatory',
        module: MODULE_NAME, method: 'checkIfUserTagIsValid',
        user: req.user.id
      });
    }
    // Check description
    if (!tag.description) {
      tag.description = `Tag ID '${tag.id}'`;
    }
    // Check user ID
    if (!tag.userID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'User ID is mandatory',
        module: MODULE_NAME, method: 'checkIfUserTagIsValid',
        user: req.user.id
      });
    }
    // Check user activation
    if (!Utils.objectHasProperty(tag, 'active')) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Tag Active property is mandatory',
        module: MODULE_NAME, method: 'checkIfUserTagIsValid',
        user: req.user.id
      });
    }
  }

  public static checkIfUserValid(filteredRequest: Partial<User>, user: User, req: Request): void {
    const tenantID = req.user.tenantID;
    if (!tenantID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Tenant is mandatory',
        module: MODULE_NAME,
        method: 'checkIfUserValid',
        user: req.user.id
      });
    }
    // Update model?
    if (req.method !== 'POST' && !filteredRequest.id) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'User ID is mandatory',
        module: MODULE_NAME,
        method: 'checkIfUserValid',
        user: req.user.id
      });
    }
    // Creation?
    if (req.method === 'POST') {
      if (!filteredRequest.role) {
        filteredRequest.role = UserRole.BASIC;
      }
    } else if (!Authorizations.isAdmin(req.user)) {
      filteredRequest.role = user.role;
    }
    if (req.method === 'POST' && !filteredRequest.status) {
      filteredRequest.status = UserStatus.BLOCKED;
    }
    // Creation?
    if ((filteredRequest.role !== UserRole.BASIC) && (filteredRequest.role !== UserRole.DEMO) &&
      !Authorizations.isAdmin(req.user) && !Authorizations.isSuperAdmin(req.user)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Only Admins can assign the role '${Utils.getRoleNameFromRoleID(filteredRequest.role)}'`,
        module: MODULE_NAME,
        method: 'checkIfUserValid',
        user: req.user.id,
        actionOnUser: filteredRequest.id
      });
    }
    // Only Basic, Demo, Admin user other Tenants (!== default)
    if (tenantID !== 'default' && filteredRequest.role && filteredRequest.role === UserRole.SUPER_ADMIN) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'User cannot have the Super Admin role in this Tenant',
        module: MODULE_NAME,
        method: 'checkIfUserValid',
        user: req.user.id,
        actionOnUser: filteredRequest.id
      });
    }
    // Only Admin and Super Admin can use role different from Basic
    if ((filteredRequest.role === UserRole.ADMIN || filteredRequest.role === UserRole.SUPER_ADMIN) &&
      !Authorizations.isAdmin(req.user) && !Authorizations.isSuperAdmin(req.user)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `User without role Admin or Super Admin tried to ${filteredRequest.id ? 'update' : 'create'} an User with the '${Utils.getRoleNameFromRoleID(filteredRequest.role)}' role`,
        module: MODULE_NAME,
        method: 'checkIfUserValid',
        user: req.user.id,
        actionOnUser: filteredRequest.id
      });
    }
    if (!filteredRequest.name) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'User Last Name is mandatory',
        module: MODULE_NAME,
        method: 'checkIfUserValid',
        user: req.user.id,
        actionOnUser: filteredRequest.id
      });
    }
    if (req.method === 'POST' && !filteredRequest.email) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'User Email is mandatory',
        module: MODULE_NAME,
        method: 'checkIfUserValid',
        user: req.user.id,
        actionOnUser: filteredRequest.id
      });
    }
    if (req.method === 'POST' && !Utils.isUserEmailValid(filteredRequest.email)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `User Email '${filteredRequest.email}' is not valid`,
        module: MODULE_NAME,
        method: 'checkIfUserValid',
        user: req.user.id,
        actionOnUser: filteredRequest.id
      });
    }
    if (filteredRequest.password && !Utils.isPasswordValid(filteredRequest.password)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'User Password is not valid',
        module: MODULE_NAME,
        method: 'checkIfUserValid',
        user: req.user.id,
        actionOnUser: filteredRequest.id
      });
    }
    if (filteredRequest.phone && !Utils.isPhoneValid(filteredRequest.phone)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `User Phone '${filteredRequest.phone}' is not valid`,
        module: MODULE_NAME,
        method: 'checkIfUserValid',
        user: req.user.id,
        actionOnUser: filteredRequest.id
      });
    }
    if (filteredRequest.mobile && !Utils.isPhoneValid(filteredRequest.mobile)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `User Mobile '${filteredRequest.mobile}' is not valid`,
        module: MODULE_NAME,
        method: 'checkIfUserValid',
        user: req.user.id,
        actionOnUser: filteredRequest.id
      });
    }
    if (filteredRequest.plateID && !Utils.isPlateIDValid(filteredRequest.plateID)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `User Plate ID '${filteredRequest.plateID}' is not valid`,
        module: MODULE_NAME,
        method: 'checkIfUserValid',
        user: req.user.id,
        actionOnUser: filteredRequest.id
      });
    }
  }

  public static checkIfCarValid(car: Partial<Car>, req: Request): void {
    if (req.method !== 'POST' && !car.id) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Car ID is mandatory',
        module: MODULE_NAME, method: 'checkIfCarValid',
        user: req.user.id
      });
    }
    if (!car.vin) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Vin Car is mandatory',
        module: MODULE_NAME, method: 'checkIfCarValid',
        user: req.user.id
      });
    }
    if (!car.licensePlate) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'License Plate is mandatory',
        module: MODULE_NAME, method: 'checkIfCarValid',
        user: req.user.id
      });
    }
    if (!Utils.isPlateIDValid(car.licensePlate)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Car License Plate ID '${car.licensePlate}' is not valid`,
        module: MODULE_NAME, method: 'checkIfCarValid',
        user: req.user.id,
        actionOnUser: car.id
      });
    }
    if (!car.carCatalogID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Car Catalog ID is mandatory',
        module: MODULE_NAME, method: 'checkIfCarValid',
        user: req.user.id
      });
    }
    if (!car.type) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Car type is mandatory',
        module: MODULE_NAME, method: 'checkIfCarValid',
        user: req.user.id
      });
    }
    if (!Authorizations.isAdmin(req.user)) {
      if (car.type === CarType.POOL_CAR) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.GENERAL_ERROR,
          message: 'Pool cars can only be created by admin',
          module: MODULE_NAME, method: 'checkIfCarValid',
          user: req.user.id
        });
      }
    }
    if (!car.converter) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Car Converter is mandatory',
        module: MODULE_NAME, method: 'checkIfCarValid',
        user: req.user.id
      });
    }
    if (!car.converter.amperagePerPhase) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Car Converter amperage per phase is mandatory',
        module: MODULE_NAME, method: 'checkIfCarValid',
        user: req.user.id
      });
    }
    if (!car.converter.numberOfPhases) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Car Converter number of phases is mandatory',
        module: MODULE_NAME, method: 'checkIfCarValid',
        user: req.user.id
      });
    }
    if (!car.converter.powerWatts) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Car Converter power is mandatory',
        module: MODULE_NAME, method: 'checkIfCarValid',
        user: req.user.id
      });
    }
    if (!car.converter.type) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Car Converter type is mandatory',
        module: MODULE_NAME, method: 'checkIfCarValid',
        user: req.user.id
      });
    }
  }

  public static checkIfEndUserErrorNotificationValid(endUserErrorNotificationValid: HttpEndUserReportErrorRequest, req: Request): void {
    if (!endUserErrorNotificationValid.subject) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Subject is mandatory.',
        module: MODULE_NAME, method: 'checkIfEndUserErrorNotificationValid',
        user: req.user.id
      });
    }
    if (!endUserErrorNotificationValid.description) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Description is mandatory.',
        module: MODULE_NAME, method: 'checkIfEndUserErrorNotificationValid',
        user: req.user.id
      });
    }
    if (endUserErrorNotificationValid.mobile && !Utils.isPhoneValid(endUserErrorNotificationValid.mobile)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Phone is invalid',
        module: MODULE_NAME, method: 'checkIfEndUserErrorNotificationValid',
        user: req.user.id
      });
    }
  }
}
