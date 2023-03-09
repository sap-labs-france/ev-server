import { Action, Entity } from '../../../../types/Authorization';
import { NextFunction, Request, Response } from 'express';

import AppAuthError from '../../../../exception/AppAuthError';
import Authorizations from '../../../../authorization/Authorizations';
import Constants from '../../../../utils/Constants';
import { EndUserErrorNotification } from '../../../../types/UserNotifications';
import { HTTPAuthError } from '../../../../types/HTTPError';
import Logging from '../../../../utils/Logging';
import NotificationHandler from '../../../../notification/NotificationHandler';
import NotificationStorage from '../../../../storage/mongodb/NotificationStorage';
import NotificationValidatorRest from '../validator/NotificationValidatorRest';
import { ServerAction } from '../../../../types/Server';
import Utils from '../../../../utils/Utils';
import UtilsService from './UtilsService';

const MODULE_NAME = 'NotificationService';

export default class NotificationService {
  public static async handleGetNotifications(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = NotificationValidatorRest.getInstance().validateNotificationsGetReq(req.query);
    // Check User
    let userProject: string[] = [];
    if ((await Authorizations.canListUsers(req.user)).authorized) {
      userProject = [ 'userID', 'user.id', 'user.name', 'user.firstName', 'user.email', 'data' ];
    }
    // Check Charging Station
    let chargingStationProject: string[] = [];
    if (await Authorizations.canListChargingStations(req.user)) {
      chargingStationProject = [ 'chargeBoxID' ];
    }
    // Get the Notification
    const notifications = await NotificationStorage.getNotifications(req.tenant, {
      'userID': filteredRequest.UserID,
      'dateFrom': filteredRequest.DateFrom,
      'channel': filteredRequest.Channel
    }, {
      limit: filteredRequest.Limit,
      skip: filteredRequest.Skip,
      sort: filteredRequest.SortFields
    },
    [
      'id', 'timestamp', 'channel', 'sourceId', 'sourceDescr', 'chargeBoxID',
      ...userProject, ...chargingStationProject
    ]);
    res.json(notifications);
    next();
  }

  public static async handleEndUserReportError(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!(await Authorizations.canEndUserReportError(req.user)).authorized) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.CREATE, entity: Entity.NOTIFICATION,
        module: MODULE_NAME, method: 'handleEndUserReportError'
      });
    }
    // Filter
    const filteredRequest = NotificationValidatorRest.getInstance().validateEndUserErrorReportReq(req.body);
    // Check and Get User
    const user = await UtilsService.checkAndGetUserAuthorization(
      req.tenant, req.user, req.user.id, Action.READ, action);
    // Set
    const endUserErrorNotification: EndUserErrorNotification = {
      userID: user.id,
      email: user.email,
      phone: filteredRequest?.mobile ?? user?.mobile,
      name: Utils.buildUserFullName(user, false, false),
      errorTitle: filteredRequest.subject,
      errorDescription: filteredRequest.description,
      evseDashboardURL: Utils.buildEvseURL(req.tenant?.subdomain),
    };
    // Notify
    NotificationHandler.sendEndUserErrorNotification(req.tenant, endUserErrorNotification).catch((error) => {
      Logging.logPromiseError(error, req?.tenant?.id);
    });
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }
}

