import User from './User';
import ChargingStation from './ChargingStation';

export interface NotifySessionNotStarted {
  chargingStation: ChargingStation;
  tagID: string;
  authDate: Date;
  user: User;
}
