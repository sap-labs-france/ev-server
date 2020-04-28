
export default interface Lock {
  id?: string;
  tenantID: string;
  name: string;
  type: LockType;
  timestamp: Date;
  hostname: string;
}

export enum LockType {
  EXCLUSIVE = 'E'
}
