const http = require('http');

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(path, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

function post(path, obj) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(obj);
    const url = new URL(path);
    const opts = { hostname: url.hostname, port: url.port, path: url.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } };
    const req = http.request(opts, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

(async () => {
  try {
    console.log('GET /api/payments');
    console.log(await get('http://localhost:5001/api/payments'));

    console.log('POST /api/payments');
    console.log(await post('http://localhost:5001/api/payments', { studentName: 'Scripted Student', regNo: 'S1', course: 'IT', year: '1', semesterType: 'First', payment: 500 }));

    console.log('GET /api/payments after POST');
    console.log(await get('http://localhost:5001/api/payments'));
  } catch (err) {
    console.error('ERR', err);
  }
})();