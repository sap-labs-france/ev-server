import { NextFunction, Request, Response, request } from 'express';
import Authorizations from '../../../authorization/Authorizations';
import AppAuthError from '../../../exception/AppAuthError';
import NotificationHandler from '../../../notification/NotificationHandler';
import NotificationStorage from '../../../storage/mongodb/NotificationStorage';
import UserStorage from '../../../storage/mongodb/UserStorage';
import { Action, Entity } from '../../../types/Authorization';
import { HTTPAuthError } from '../../../types/HTTPError';
import { ServerAction } from '../../../types/Server';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import Utils from '../../../utils/Utils';
import NotificationSecurity from './security/NotificationSecurity';
import UtilsService from './UtilsService';


const MODULE_NAME = 'NotificationService';

export default class NotificationService {
  static async handleGetNotifications(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Filter
      const filteredRequest = NotificationSecurity.filterNotificationsRequest(req.query);
      // Get the Notification
      const notifications = await NotificationStorage.getNotifications(req.user.tenantID, {
        'userID': filteredRequest.UserID,
        'dateFrom': filteredRequest.DateFrom,
        'channel': filteredRequest.Channel
      }, {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: filteredRequest.Sort
      });
      // Filter
      NotificationSecurity.filterNotificationsResponse(notifications, req.user);
      // Return
      res.json(notifications);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleEndUserErrorNotification(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!Authorizations.canSendEndUserErrorNotification(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.CREATE, entity: Entity.NOTIFICATION,
        module: MODULE_NAME, method: 'handleEndUserErrorNotification'
      });
    }
    // Filter
    const filteredRequest = NotificationSecurity.filterEndUserErrorNotificationRequest(req.body);
    // Get the User
    const user = await UserStorage.getUser(req.user.tenantID, req.user.id);
    UtilsService.assertObjectExists(action, user, `User '${req.user.id}' does not exist`,
      MODULE_NAME, 'handleEndUserErrorNotification', req.user);
    // Set
    filteredRequest.userID = req.user.id;
    // Check if Notification is valid
    Utils.checkIfEndUserErrorNotificationValid(filteredRequest, request);
    // Build URL
    filteredRequest.evseDashboardURL = Utils.buildEvseURL();
    // Send Notification
    await NotificationHandler.sendEndUserErrorNotification(req.user.tenantID, filteredRequest);
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }
}

