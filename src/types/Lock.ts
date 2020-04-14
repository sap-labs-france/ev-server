export default interface Lock {
  id?: string;
  keyHash: string;
  name: string;
  type: string;
  timestamp: Date;
  hostname: string;
  onMultipleHosts: boolean;
}
