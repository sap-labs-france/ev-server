export default interface Lock {
  id?: string;
  lockID: string;
  name: string;
  type: string;
  timestamp: Date;
  hostname: string;
}
