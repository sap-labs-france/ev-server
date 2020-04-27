import { ObjectID } from 'mongodb';

export default interface Lock {
  id?: ObjectID;
  keyHash: string;
  name: string;
  type: LockType;
  timestamp: Date;
  hostname: string;
  onMultipleHosts: boolean;
}

export enum LockType {
  EXCLUSIVE = 'E'
}
