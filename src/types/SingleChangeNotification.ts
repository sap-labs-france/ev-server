import ChangeNotification from './ChangeNotification';
import { Data } from './GlobalType';

export default interface SingleChangeNotification extends ChangeNotification{
  data: NotificationData;
}

export interface NotificationData {
  id: string;
  type?: string;
  data?: Data;
}

export interface TransactionNotificationData {
  id: string;
  type?: string;
  data?: Data;
  connectorId?: number;
  chargeBoxID?: string;
}
