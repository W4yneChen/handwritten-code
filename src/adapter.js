const MyPromise = require('./Promise.js');

module.exports = {
  resolve: MyPromise.resolve,
  reject: MyPromise.reject,
  deferred: MyPromise.withResolvers,
};
