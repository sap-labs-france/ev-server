import CrudApi from './utils/CrudApi';

export default class MailApi extends CrudApi {
  public constructor(baseApi) {
    super(baseApi);
  }

  public async readAllMails() {
    return super.read(null, '/email');
  }

  public async deleteAllMails() {
    return super.delete(null, '/email/all');
  }

  public async isMailReceived(receiver, type) {
    const mails = await this.readAllMails();
    const receivedMails = mails.data.filter((mail) => mail.to.length > 0 && mail.to[0].address === receiver);
    return !!receivedMails.find((mail) => mail.html.includes(`id="${type}"`));
  }

}
