export default class InternalError extends Error {

  public readonly detailedMessages: Array<string>;

  constructor(message: string, detailedMessages: Array<string>) {
    super(message);
    this.detailedMessages = detailedMessages;
  }
}
