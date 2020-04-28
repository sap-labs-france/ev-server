
export default interface Lock {
  id?: string;
  tenantID: string;
  entity: LockEntity;
  name: string;
  type: LockType;
  timestamp: Date;
  hostname: string;
}

export enum LockType {
  EXCLUSIVE = 'E'
}

export enum LockEntity {
  DATABASE = 'database',
  DATABASE_INDEX = 'database-index',
}
