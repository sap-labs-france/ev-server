import { Factory } from 'rosie';
import { ObjectID } from 'mongodb';
import faker from 'faker';

export default Factory.define('tag')
  .attr('id', () => faker.random.alphaNumeric(20).toString().toUpperCase())
  .attr('visualID', () => new ObjectID().toString())
  .attr('active', true)
  .attr('issuer', () => true)
  .attr('default', () => false)
  .attr('description', () => 'Tag for unit test');
