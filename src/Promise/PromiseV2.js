const STATE = {
  PENDING: 'pending',
  FULFILLED: 'fulfilled',
  REJECTED: 'rejected',
};

module.exports = class MyPromise {
  constructor(executor) {
    this.state = STATE.PENDING;
    this.value = undefined;
    this.reason = undefined;
    this.onFulfilledCallbacks = [];
    this.onRejectedCallbacks = [];

    const realResolve = value => {
      this.state = STATE.FULFILLED;
      this.value = value;
      this.onFulfilledCallbacks.forEach(fn => fn());
      this.onFulfilledCallbacks = [];
    };

    const reject = reason => {
      this.state = STATE.REJECTED;
      this.reason = reason;
      this.onRejectedCallbacks.forEach(fn => fn());
      this.onRejectedCallbacks = [];
    };

    const resolve = value => {
      if (this.state !== STATE.PENDING) return;

      this.resolvePromise(this, value, realResolve, reject);
    };

    try {
      executor(resolve, reject);
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
        default:
          this.onFulfilledCallbacks.push(onFulfilledCallback);
          this.onRejectedCallbacks.push(onRejectedCallback);
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
      let called = false;

      try {
        const arr = [...iterable];
        const result = [];
        let completedCount = 0;

        if (!arr.length) {
          return resolve(result);
        }

        for (let i = 0; i < arr.length; i++) {
          if (called) return;

          MyPromise.resolve(arr[i]).then(
            value => {
              if (called) return;
              result[i] = value;

              if (++completedCount === arr.length) {
                called = true;
                resolve(result);
              }
            },
            reason => {
              if (called) return;
              called = true;
              reject(reason);
            }
          );
        }
      } catch (e) {
        if (called) return;
        called = true;
        reject(e);
      }
    });
  }

  static any(iterable) {
    return new MyPromise((resolve, reject) => {
      let called = false;

      try {
        const arr = [...iterable];
        const errors = [];
        let errorCount = 0;

        if (!arr.length) {
          return reject(new AggregateError([], 'All promises were rejected'));
        }

        for (let i = 0; i < arr.length; i++) {
          if (called) return;

          MyPromise.resolve(arr[i]).then(
            value => {
              if (called) return;
              called = true;
              resolve(value);
            },
            reason => {
              if (called) return;
              errors[i] = reason;

              if (++errorCount === arr.length) {
                called = true;
                reject(new AggregateError(errors, 'All promises were rejected'));
              }
            }
          );
        }
      } catch (e) {
        if (called) return;
        called = true;
        reject(e);
      }
    });
  }

  static race(iterable) {
    return new MyPromise((resolve, reject) => {
      let called = false;

      try {
        const arr = [...iterable];

        for (let i = 0; i < arr.length; i++) {
          if (called) return;

          MyPromise.resolve(arr[i]).then(
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
          );
        }
      } catch (e) {
        if (called) return;
        called = true;
        reject(e);
      }
    });
  }

  static allSettled(iterable) {
    return new MyPromise(resolve => {
      try {
        const arr = [...iterable];
        const result = [];
        let completedCount = 0;

        if (!arr.length) {
          return resolve([]);
        }

        for (let i = 0; i < arr.length; i++) {
          MyPromise.resolve(arr[i]).then(
            value => {
              result[i] = { status: STATE.FULFILLED, value };

              if (++completedCount === arr.length) {
                resolve(result);
              }
            },
            reason => {
              result[i] = { status: STATE.REJECTED, reason };

              if (++completedCount === arr.length) {
                resolve(result);
              }
            }
          );
        }
      } catch (e) {
        resolve({ status: STATE.REJECTED, reason: e });
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
};
