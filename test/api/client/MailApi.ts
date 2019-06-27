import CrudApi from './utils/CrudApi';

export default class MailApi extends CrudApi {
  public constructor(baseApi) {
    super(baseApi);
  }

  public readAllMails() {
    return super.read(null, '/email');
  }

  public deleteAllMails() {
    return super.delete(null, '/email/all');
  }


  public async isMailReceived(receiver, type) {
    const mails = await this.readAllMails();
    const receivedMails = mails.data.filter((mail) => {
      return mail.to.length > 0 && mail.to[0].address === receiver;
    });
    return !!receivedMails.find((mail) => {
      return mail.html.includes(`id="${type}"`);
    });
  }

}
