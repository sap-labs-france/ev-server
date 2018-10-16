const Factory = require('rosie').Factory;
const faker = require('faker');

module.exports = Factory.define('address')
  .attr('firstName', () => faker.name.firstName())
  .attr('name', () => faker.name.lastName() + '_' + faker.random.alphaNumeric(8).toUpperCase())
  .attr('email', () => faker.random.alphaNumeric(8).toLowerCase() + '_' + faker.internet.email())
  .attr('captcha', '03AHqfIOkrqjt2RAg3fYA5zheYBKQKwPGppT69OdbWEFaMAXpe-dAcTsAZi-G7Lwdb6BYhKT_hJxIvDktmZ7EB9i3Ifq8LmeDrr5KMFy5tJ_6cuqT1T0MwuYe_uOkvZ9bH07nCaI6P0fWwaUZcoar_-0rKefUVLipvO4thr3-zQjIk5OO6dEY16H5JF1b1EdOoORGzPkXdUbIRH-QcfkykhfAf7UOHpB7V4_Y8P3ZRUXkoS7RQREFfT8tYU4ZWN4LbUPRqi8jxhi2Ye_i7frsFOIDuvOwVwgB77LZSaPOLpkH8lTpm3Na_dT9BPH-WwX7jDk40zpa0wp00ozcpb-7vrPRNZtEnmTSfl7jJpHAbzA5DbkSRgZLphkS6s6x4TfEtWv4dyC8ECZofasu098KMFDgR8_4xLkZ7X18rCAFS77MAyLi7CyHIys0')
  .attr('passwords', () => {
    const password = faker.internet.password() + "@1Aa";
    return {
      password: password,
      repeatPassword: password
    }
  })
  .attr('role', 'B')
  .attr('status', 'A')
  .attr('tagIDs',() =>  [faker.random.alphaNumeric(8).toUpperCase()])
  .attr('acceptEula', true);
