import { Action, Entity } from '../../../../types/Authorization';
import { NextFunction, Request, Response } from 'express';

import AppAuthError from '../../../../exception/AppAuthError';
import Authorizations from '../../../../authorization/Authorizations';
import Constants from '../../../../utils/Constants';
import { EndUserErrorNotification } from '../../../../types/UserNotifications';
import { HTTPAuthError } from '../../../../types/HTTPError';
import NotificationHandler from '../../../../notification/NotificationHandler';
import NotificationSecurity from './security/NotificationSecurity';
import NotificationStorage from '../../../../storage/mongodb/NotificationStorage';
import { ServerAction } from '../../../../types/Server';
import UserStorage from '../../../../storage/mongodb/UserStorage';
import Utils from '../../../../utils/Utils';
import UtilsService from './UtilsService';

const MODULE_NAME = 'NotificationService';

export default class NotificationService {
  static async handleGetNotifications(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = NotificationSecurity.filterNotificationsRequest(req.query);
    // Check User
    let userProject: string[] = [];
    if (Authorizations.canListUsers(req.user)) {
      userProject = [ 'userID', 'user.id', 'user.name', 'user.firstName', 'user.email', 'data' ];
    }
    // Check Charging Station
    let chargingStationProject: string[] = [];
    if (Authorizations.canListChargingStations(req.user)) {
      chargingStationProject = [ 'chargeBoxID' ];
    }
    // Get the Notification
    const notifications = await NotificationStorage.getNotifications(req.user.tenantID, {
      'userID': filteredRequest.UserID,
      'dateFrom': filteredRequest.DateFrom,
      'channel': filteredRequest.Channel
    }, {
      limit: filteredRequest.Limit,
      skip: filteredRequest.Skip,
      sort: filteredRequest.Sort
    },
    [
      'id', 'timestamp', 'channel', 'sourceId', 'sourceDescr', 'chargeBoxID',
      ...userProject, ...chargingStationProject
    ]);
    // Return
    res.json(notifications);
    next();
  }

  static async handleEndUserReportError(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!Authorizations.canEndUserReportError(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.CREATE, entity: Entity.NOTIFICATION,
        module: MODULE_NAME, method: 'handleEndUserReportError'
      });
    }
    // Filter
    const filteredRequest = NotificationSecurity.filterEndUserReportErrorRequest(req.body);
    // Check if Notification is valid
    Utils.checkIfEndUserErrorNotificationValid(filteredRequest, req);
    // Get the User
    const user = await UserStorage.getUser(req.user.tenantID, req.user.id);
    UtilsService.assertObjectExists(action, user, `User '${req.user.id}' does not exist`,
      MODULE_NAME, 'handleEndUserReportError', req.user);
    // Save mobile number
    if (filteredRequest.mobile && (user.mobile !== filteredRequest.mobile)) {
      user.mobile = filteredRequest.mobile;
      await UserStorage.saveUserMobilePhone(req.user.tenantID, user.id, { mobile: filteredRequest.mobile });
    }
    // Set
    const endUserErrorNotification: EndUserErrorNotification = {
      userID: user.id,
      email: user.email,
      phone: user.mobile,
      name: Utils.buildUserFullName(user, false, false),
      errorTitle: filteredRequest.subject,
      errorDescription: filteredRequest.description,
      evseDashboardURL: Utils.buildEvseURL(),
    };
    // Send Notification
    await NotificationHandler.sendEndUserErrorNotification(req.user.tenantID, endUserErrorNotification);
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }
}

