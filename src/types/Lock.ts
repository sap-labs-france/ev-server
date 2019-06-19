export default interface Lock {
  _id?: string;
  name: string;
  type: string;
  timestamp: Date;
  hostname: string;
}
