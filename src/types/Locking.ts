
export default interface Lock {
  id?: string;
  tenantID: string;
  entity: LockEntity;
  key: string;
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
  SITE_AREA = 'site-area',
}
