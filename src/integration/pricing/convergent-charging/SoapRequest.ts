export default class SoapRequest {
  public constructor(
    readonly name: string,
    readonly requestName: string,
    readonly headers: {Security: {Username: string; Password: string; Nonce: string}},
    readonly data: any
  ) {}
}
