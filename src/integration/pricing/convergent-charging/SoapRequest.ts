export default class SoapRequest {
  public constructor(
    readonly name: string,
    readonly requestName: string,
    readonly headers: {Security: {Username: string, Password: string, Nonce: string}},
    readonly data: any
  ) {}
};

//TODO: type of data (Payload)
// since it is variable maybe leave as any (justified)
