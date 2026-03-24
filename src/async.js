const executor = generator => {
  return new Promise((resolve, reject) => {
    const step = next => {
      let res;

      try {
        res = next();
      } catch (e) {
        return reject(e);
      }

      const { value, done } = res;
      if (done) {
        return resolve(value);
      }

      Promise.resolve(value)
        .then(value => step(() => generator.next(value)))
        .catch(e => step(() => generator.throw(e)));
    };

    step(() => generator.next());
  });
};

const asyncWrapper = generator => {
  return function (...args) {
    return executor(generator.apply(this, args));
  };
};

// ==================== demo1 ====================
const mockRequest1 = number => new Promise(resolve => setTimeout(() => resolve(number * 2)), 1000);

const mockRequest2 = number => new Promise(resolve => setTimeout(resolve(number * 4)), 2000);

const fn = asyncWrapper(function* (number) {
  try {
    console.log('number: ', number);

    const data1 = yield mockRequest1(number);
    console.log('data1', data1);

    const data2 = yield mockRequest2(data1);
    console.log('data2', data2);

    return data2;
  } catch (e) {
    console.error('e:', e);
    throw e;
  }
});

fn(100)
  .then(value => console.log('value:', value))
  .catch(e => console.error('e:', e));

// ==================== demo2 ====================
const login = (account, password) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (account === 123 && password === 456) {
        resolve({
          ok: true,
          json: () => ({
            userId: '001',
            token: '456',
          }),
        });
      } else {
        reject({
          ok: false,
          error: 'account or password error',
        });
      }
    }, 1000);
  });
};

const getList = (userId, token) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (userId === '001' && token === '456') {
        resolve({
          ok: true,
          json: () => [
            { id: 1, name: 'Jack', age: 13 },
            { id: 2, name: 'Tom', age: 14 },
            { id: 3, name: 'Jerry', age: 15 },
          ],
        });
      } else {
        reject({
          ok: false,
          error: 'userId or token error',
        });
      }
    }, 1000);
  });
};

const promise1 = asyncWrapper(function* (account, password) {
  try {
    const loginRes = yield login(account, password);
    const { userId, token } = yield loginRes.json();
    console.log('loginRes: ', userId, token);

    const getListRes = yield getList(userId, token);
    const data = yield getListRes.json();
    console.log('getListRes: ', data);

    return data;
  } catch (e) {
    console.error('promise1 error: ', e);
    throw e;
  }
});

const main = asyncWrapper(function* () {
  try {
    const res = yield promise1(123, 456);
    console.log('res: ', res);
  } catch (e) {
    console.error('promise2 e: ', e);
    console.error('exit');
  }
});

main();
