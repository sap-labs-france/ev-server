import { BUTTON, CONFIG, FOOTER, HEADER, TEXT1, TEXT2, TITLE } from '../mjmlComponents';

import express from 'express';
import mjmlBuilder from '../MjmlBuilder/MjmlBuilder';
import mjmlContext from '../MjmlContext/MjmlContext';

const app = express();
const port = 3000;


function testHtml(): string {
  const context = new mjmlContext('Account Created', 'Claude Rossi', 'Create Your Account');

  return '';
}
