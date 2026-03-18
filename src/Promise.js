const STATE = {
  PENDING: 'pending',
  FULFILLED: 'fulfilled',
  REJECTED: 'rejected',
};

class MyPromise {
  constructor(executor) {
    this.state = STATE.PENDING;
    this.value = undefined;
    this.reason = undefined;
    this.onFulfilledCallbacks = [];
    this.onRejectedCallbacks = [];

    const resolve = value => {
      this.state = STATE.FULFILLED;
      this.value = value;
      this.onFulfilledCallbacks.forEach(fn => fn());
      this.onFulfilledCallbacks = [];
    };

    const reject = reason => {
      if (this.state != STATE.PENDING) return;

      this.state = STATE.REJECTED;
      this.reason = reason;
      this.onRejectedCallbacks.forEach(fn => fn());
      this.onRejectedCallbacks = [];
    };

    const realResolve = value => {
      if (this.state != STATE.PENDING) return;

      this.resolvePromise(this, value, resolve, reject);
    };

    try {
      executor(realResolve, reject);
    } catch (e) {
      reject(e);
    }
  }

  resolvePromise(promise2, x, resolve, reject) {
    if (promise2 === x) {
      return reject(new TypeError('Chaining cycle detected for promise #<MyPromise>'));
    }

    let called = false;
    if ((typeof x === 'object' && x !== null) || typeof x === 'function') {
      try {
        const then = x.then;

        if (typeof then === 'function') {
          then.call(
            x,
            y => {
              if (called) return;
              called = true;
              this.resolvePromise(promise2, y, resolve, reject);
            },
            r => {
              if (called) return;
              called = true;
              reject(r);
            }
          );
        } else {
          resolve(x);
        }
      } catch (e) {
        if (called) return;
        called = true;
        reject(e);
      }
    } else {
      resolve(x);
    }
  }

  then(onFulfilled, onRejected) {
    const realOnFulfilled = typeof onFulfilled === 'function' ? onFulfilled : value => value;
    const realOnRejected =
      typeof onRejected === 'function'
        ? onRejected
        : reason => {
            throw reason;
          };

    const promise2 = new MyPromise((resolve, reject) => {
      const onFulfilledCallback = () =>
        queueMicrotask(() => {
          try {
            const x = realOnFulfilled(this.value);
            this.resolvePromise(promise2, x, resolve, reject);
          } catch (e) {
            reject(e);
          }
        });

      const onRejectedCallback = () =>
        queueMicrotask(() => {
          try {
            const x = realOnRejected(this.reason);
            this.resolvePromise(promise2, x, resolve, reject);
          } catch (e) {
            reject(e);
          }
        });

      switch (this.state) {
        case STATE.FULFILLED:
          onFulfilledCallback();
          break;
        case STATE.REJECTED:
          onRejectedCallback();
          break;
        case STATE.PENDING:
          this.onFulfilledCallbacks.push(onFulfilledCallback);
          this.onRejectedCallbacks.push(onRejectedCallback);
          break;
      }
    });

    return promise2;
  }

  catch(onRejected) {
    return this.then(null, onRejected);
  }

  finally(callback) {
    return this.then(
      value => MyPromise.resolve(callback()).then(() => value),
      reason =>
        MyPromise.resolve(callback()).then(() => {
          throw reason;
        })
    );
  }

  static resolve(value) {
    if (value instanceof MyPromise) {
      return value;
    }

    return new MyPromise(resolve => resolve(value));
  }

  static reject(reason) {
    return new MyPromise((_, reject) => reject(reason));
  }

  static all(iterable) {
    return new MyPromise((resolve, reject) => {
      try {
        const promises = [...iterable].map(MyPromise.resolve);
        const result = [];
        let completedCount = 0;
        let called = false;

        if (!promises.length) {
          resolve([]);
        }

        promises.forEach((promise, index) =>
          promise.then(
            value => {
              if (called) return;
              result[index] = value;
              completedCount++;
              if (completedCount === promises.length) {
                called = true;
                resolve(result);
              }
            },
            reason => {
              if (called) return;
              called = true;
              reject(reason);
            }
          )
        );
      } catch (e) {
        reject(e);
      }
    });
  }

  static race(iterable) {
    return new MyPromise((resolve, reject) => {
      try {
        const promises = [...iterable].map(MyPromise.resolve);
        let called = false;

        if (!promises.length) {
          resolve([]);
        }

        promises.forEach(promise =>
          promise.then(
            value => {
              if (called) return;
              called = true;
              resolve(value);
            },
            reason => {
              if (called) return;
              called = true;
              reject(reason);
            }
          )
        );
      } catch (e) {
        reject(e);
      }
    });
  }

  static allSettled(iterable) {
    return new MyPromise(resolve => {
      try {
        const promises = [...iterable].map(MyPromise.resolve);
        const result = [];
        let completedCount = 0;

        if (!promises.length) {
          resolve([]);
        }

        promises.forEach((promise, index) =>
          promise
            .then(
              value => (result[index] = { status: 'fulfilled', value }),
              reason => (result[index] = { status: 'rejected', reason })
            )
            .finally(() => {
              if (++completedCount === promises.length) {
                resolve(result);
              }
            })
        );
      } catch (e) {
        resolve({ status: 'rejected', reason: e });
      }
    });
  }

  static any(iterable) {
    return new MyPromise((resolve, reject) => {
      try {
        const promises = [...iterable].map(MyPromise.resolve);
        const errors = [];
        let errorCount = 0;
        let called = false;

        if (!promises.length) {
          reject(new AggregateError([], 'All promises were rejected'));
        }

        promises.forEach((promise, index) =>
          promise.then(
            value => {
              if (called) return;
              called = true;
              resolve(value);
            },
            reason => {
              if (called) return;
              errors[index] = reason;
              errorCount++;
              if (errorCount === promises.length) {
                called = true;
                reject(new AggregateError(errors, 'All promises were rejected'));
              }
            }
          )
        );
      } catch (e) {
        reject(e);
      }
    });
  }

  static withResolvers() {
    let resolve = undefined;
    let reject = undefined;

    const promise = new MyPromise((res, rej) => {
      resolve = res;
      reject = rej;
    });

    return { promise, resolve, reject };
  }
}

module.exports = MyPromise;
