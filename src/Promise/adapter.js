const MyPromise = require('./Promise.js');
// const MyPromise = require('./PromiseV2.js');

module.exports = {
  resolve: MyPromise.resolve,
  reject: MyPromise.reject,
  deferred: MyPromise.withResolvers,
};
