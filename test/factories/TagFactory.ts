import { Factory } from 'rosie';
import { ObjectId } from 'mongodb';
import { faker } from '@faker-js/faker';

export default Factory.define('tag')
  .attr('id', () => faker.random.alphaNumeric(20).toString().toUpperCase())
  .attr('visualID', () => new ObjectId().toString())
  .attr('active', true)
  .attr('issuer', () => true)
  .attr('default', () => false)
  .attr('description', () => 'Tag for unit test');
