import { BUTTON, CONFIG, FOOTER, HEADER, TEXT1, TEXT2, TITLE } from '../mjmlComponents';

import express from 'express';
import mjmlBuilder from '../mjmlBuilder/mjmlBuilder';
import mjmlContext from '../mjmlContext/mjmlContext';

const app = express();
const port = 3000;


function testHtml(): string {
  const context = new mjmlContext('Account Created', 'Claude Rossi', 'Create Your Account');

  return '';
}
