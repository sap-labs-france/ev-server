import { BUTTON, CONFIG, FOOTER, HEADER, TEXT1, TEXT2, TITLE } from '../mjmlComponents/index';

import express from 'express';
import mjmlBuilder from '../mjmlBuilder/mjmlBuilder';
import mjmlContext from '../mjmlContext/mjmlContext';

const app = express();
const port = 3000;


function testHtml(): string {
  const context = new mjmlContext('Account Created', 'Claude Rossi', 'Create Your Account');

  const template = new mjmlBuilder()
    .addConfig(CONFIG)
    .addHeader(HEADER)
    .addToBody(TITLE)
    .addToBody(TEXT1)
    .addToBody(BUTTON)
    .addFooter(FOOTER)
    .buildTemplate();

  template.resolve({
    user: { name: 'Nader Ouerdiane' },
    email: {
      buttonText: 'Verify your Account',
      title: 'Account Created',
      hidden: { hidden: true },
    },
    payment: { token: 'aze', amount: 4 },
  });

  const html = template.getHtml();
  return html;
}
