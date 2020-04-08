export default interface Lock {
  id?: string;
  lockHashId: string;
  name: string;
  type: string;
  timestamp: Date;
  hostname: string;
}
