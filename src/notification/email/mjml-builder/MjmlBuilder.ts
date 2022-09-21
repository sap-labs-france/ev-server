import EmailComponentManager, { EmailComponent } from '../email-component-manager/EmailComponentManager';

import mjmlTemplate from '../mjml-template/MjmlTemplate';

export default class MjmlBuilder {
  private header: string;
  private body: string[];
  private footer: string;
  private config: string;

  public constructor() {
    this.header = '';
    this.footer = '';
    this.config = '';
    this.body = [];
  }

  public static async initialize(): Promise<MjmlBuilder> {
    const instance = new MjmlBuilder();
    instance.addConfig(await EmailComponentManager.getComponent(EmailComponent.CONFIG))
      .addHeader(await EmailComponentManager.getComponent(EmailComponent.HEADER))
      .addFooter(await EmailComponentManager.getComponent(EmailComponent.FOOTER));
    return instance;
  }

  public addHeader(header: string): this {
    this.header = header;
    return this;
  }

  public addToBody(component: string): this {
    if (component) {
      this.body.push(component);
    }
    return this;
  }

  public addFooter(footer: string): this {
    this.footer = footer;
    return this;
  }

  public addConfig(config: string): this {
    this.config = config;
    return this;
  }

  public buildTemplate(): mjmlTemplate {
    const template =
      '<mjml>' +
      this.config +
      '<mj-body>' +
      this.header +
      this.body.join() +
      this.footer +
      '</mj-body>' +
      '</mjml>';
    return new mjmlTemplate(template);
  }
}
