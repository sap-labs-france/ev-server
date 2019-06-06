export default class InternalError extends Error {

  public readonly detailedMessages: any;//TODO: in codebase sometimes passes arary of strings, sometimes payload,... be consistent, type this.

  constructor(message: string, detailedMessages?: any) {
    super(message);
    this.detailedMessages = detailedMessages;
  }
}
