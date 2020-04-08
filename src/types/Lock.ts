export default interface Lock {
  id?: string;
  lockHashKey: string;
  name: string;
  type: string;
  timestamp: Date;
  hostname: string;
}
