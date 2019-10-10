import { NextFunction, Request, Response } from 'express';
import Logging from '../../../utils/Logging';
import NotificationSecurity from './security/NotificationSecurity';
import NotificationStorage from '../../../storage/mongodb/NotificationStorage';

export default class NotificationService {
  static async handleGetNotifications(action: string, req: Request, res: Response, next: NextFunction) {
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
}

