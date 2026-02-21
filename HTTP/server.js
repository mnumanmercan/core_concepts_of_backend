import http from 'node:http';
import fs from 'fs';
import path from 'path';

const users = [
    { id: 1, name: 'Ahmet' },
    { id: 2, name: 'Ayşe' },
];

const server = http.createServer((req, res) => {
    const filePath = path.join(new URL('.', import.meta.url).pathname, 'index.html');
    console.log(filePath)
    if(req.method === 'GET' && req.url === '/') {
        fs.readFile(filePath, 'utf-8', (err, data) => {
            if(err) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Internal Server Error');
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                
                res.end(data);
            }
        });
    }

    if (req.method === 'GET' && req.url === '/users') {
        res.writeHead(200, { 'content-type': 'application/json' });

        res.end(JSON.stringify(users));
    }

    if (req.method === 'POST' && req.url === '/users') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            console.log(req.headers['content-type']);
            const parsed = new URLSearchParams(body);
            console.log(parsed)
            const newUser = {
                id: users.length + 1,
                name: parsed.get('name')
            };

            users.push(newUser);
            res.writeHead(201, {'content-type': 'application/json'});
            console.log(users)
            res.end(JSON.stringify(newUser));
        })
    }

})

server.listen(8080, () => {
    console.log('Server is alive now: http://localhost:8080/')
});