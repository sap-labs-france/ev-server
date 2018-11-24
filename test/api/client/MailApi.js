const CrudApi = require('./utils/CrudApi');

class MailApi extends CrudApi {
  constructor(baseApi) {
    super(baseApi);
  }

  readAllMails() {
    return super.read('/email', null);
  }

  deleteAllMails() {
    return super.delete('/email/all', null);
  }


  async isMailReceived(receiver, type) {
    const mails = await this.readAllMails();
    const receivedMails = mails.data.filter(mail => mail.to.length > 0 && mail.to[0].address === receiver);
    return !!receivedMails.find(mail => mail.html.includes(`id="${type}"`));
  }

}

module.exports = MailApi;