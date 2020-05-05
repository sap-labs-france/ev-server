import ChargingStation from './ChargingStation';
import User from './User';

export interface NotifySessionNotStarted {
  chargingStation: ChargingStation;
  tagID: string;
  authDate: Date;
  user: User;
}
