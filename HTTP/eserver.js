import express from 'express';
import path from 'path';

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const users = [
    { id: 1, name: 'Ahmet' },
    { id: 2, name: 'Ayşe' },
];

app.get('/', (req, res) => {
    const filePath = path.join(new URL('.', import.meta.url).pathname, 'index.html');
    res.sendFile(filePath);
})

app.get('/users', (req, res) => {
    res.json(users)
})

app.post('/users', (req, res) => {
    users.push(req.body);
    res.json(req.body)
})

app.listen(8080, () => {
    console.log('server listening on http://localhost:8080/')
})