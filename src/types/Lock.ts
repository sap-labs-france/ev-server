import { ObjectID } from 'mongodb';

export default interface Lock {
  id?: ObjectID;
  keyHash: string;
  name: string;
  type: string;
  timestamp: Date;
  hostname: string;
  onMultipleHosts: boolean;
}
