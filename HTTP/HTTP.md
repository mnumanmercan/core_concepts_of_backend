# Node.js ile HTTP — Öğrenme Notları

> Vanilla `http` modülünden Express.js'e geçiş sürecinde edinilen temel kavramlar.

---

## İçindekiler

- [1. HTTP Temelleri](#1-http-temelleri)
- [2. Vanilla HTTP ile Sunucu](#2-vanilla-http-ile-sunucu)
- [3. Express.js ile Sunucu](#3-expressjs-ile-sunucu)
- [4. Karşılaştırma](#4-karşılaştırma)
- [5. Kritik Notlar](#5-kritik-notlar)

---

## 1. HTTP Temelleri

### Request Anatomisi
Her HTTP isteği üç parçadan oluşur:
- **Method:** Ne yapmak istediğini belirtir (`GET`, `POST`, `PUT`, `DELETE`)
- **URL:** Hangi kaynağa erişildiği (`/users`, `/users/42`)
- **Body:** Sadece `POST`, `PUT`, `PATCH` isteklerinde bulunur. `GET` isteklerinde body olmaz.

### Body Formatları
HTML formları ile JSON farklı formatlarda veri gönderir:

| Kaynak | Content-Type | Body Görünümü |
|--------|-------------|---------------|
| HTML `<form>` | `application/x-www-form-urlencoded` | `name=Ahmet&age=25` |
| fetch / axios / curl | `application/json` | `{"name":"Ahmet","age":25}` |

---

## 2. Vanilla HTTP ile Sunucu

```javascript
import http from 'node:http';
import fs from 'fs';
import path from 'path';

const users = [
    { id: 1, name: 'Ahmet' },
    { id: 2, name: 'Ayşe' },
];

const server = http.createServer((req, res) => {
    const filePath = path.join(new URL('.', import.meta.url).pathname, 'index.html');

    // GET / → HTML dosyası dön
    if (req.method === 'GET' && req.url === '/') {
        fs.readFile(filePath, 'utf-8', (err, data) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Internal Server Error');
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(data);
            }
        });
        return;
    }

    // GET /users → JSON dön
    if (req.method === 'GET' && req.url === '/users') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(users));
        return;
    }

    // POST /users → Yeni kullanıcı ekle
    if (req.method === 'POST' && req.url === '/users') {
        let body = '';

        // Body stream olarak parça parça gelir, biriktirmek gerekir
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            // Form verisi urlencoded formatında gelir, JSON.parse() değil
            // URLSearchParams ile parse edilmesi gerekir
            const parsed = new URLSearchParams(body);

            const newUser = {
                id: users.length + 1,
                name: parsed.get('name')
            };

            users.push(newUser);
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(newUser));
        });
    }
});

server.listen(8080, () => {
    console.log('Server is alive now: http://localhost:8080/');
});
```

### Önemli Noktalar

**Routing elle yapılır:**
`req.method` ve `req.url` kontrol edilerek hangi bloğun çalışacağı belirlenir. Express'teki `app.get()`, `app.post()` gibi yapılar burada yoktur.

**`res.end()` string veya Buffer alır, dosya yolu almaz:**
```javascript
res.end('/index.html') // ❌ Bu "/index.html" yazısını gönderir, dosyayı değil
res.end(data)          // ✅ fs.readFile ile okunan içerik gönderilir
```

**Body stream olarak gelir:**
`req.on('data')` ile parçalar biriktirilir, `req.on('end')` ile işlenir.

**`fs.readFile` asenkron kullanılmalıdır:**
```javascript
// ❌ Sunucuyu bloklar — başka istekler beklemek zorunda kalır
const data = fs.readFileSync(filePath);

// ✅ Non-blocking — dosya okunurken diğer istekler işlenmeye devam eder
fs.readFile(filePath, (err, data) => { ... });
```

**`return` kullanımı zorunludur:**
`if / else if` yerine bağımsız `if` blokları kullanıldığında, bir blok çalıştıktan sonra alttaki blokların da çalışmaması için `return` eklenmelidir. Aksi halde `res.end()` iki kez çağrılarak hata alınır.

---

## 3. Express.js ile Sunucu

```javascript
import express from 'express';
import path from 'path';

const app = express();

// Middleware — route tanımlarından ÖNCE yazılmalıdır
app.use(express.urlencoded({ extended: true })); // Form verisini parse eder
app.use(express.json());                          // JSON body'yi parse eder

const users = [
    { id: 1, name: 'Ahmet' },
    { id: 2, name: 'Ayşe' },
];

// GET / → HTML dosyası dön
app.get('/', (req, res) => {
    const filePath = path.join(new URL('.', import.meta.url).pathname, 'index.html');
    res.sendFile(filePath);
});

// GET /users → JSON dön
app.get('/users', (req, res) => {
    res.json(users);
});

// POST /users → Yeni kullanıcı ekle
app.post('/users', (req, res) => {
    const newUser = {
        id: users.length + 1,
        name: req.body.name
    };

    users.push(newUser);
    res.status(201).json(newUser);
});

app.listen(8080, () => {
    console.log('Server listening on http://localhost:8080/');
});
```

### Önemli Noktalar

**`express.urlencoded()` nedir?**
HTML formlarından gelen `application/x-www-form-urlencoded` formatındaki veriyi parse ederek `req.body`'ye bağlar. Vanilla HTTP'de `URLSearchParams` ile elle yaptığımız işi Express bu middleware ile otomatik halleder.

**`express.json()` nedir?**
`application/json` formatındaki body'yi parse eder. fetch, axios veya Postman ile JSON gönderildiğinde bu middleware devreye girer.

**Middleware sırası önemlidir:**
```javascript
// ✅ Doğru — middleware'ler route'lardan önce tanımlanır
app.use(express.urlencoded({ extended: true }));
app.post('/users', (req, res) => { console.log(req.body) }); // dolu gelir

// ❌ Yanlış — req.body undefined olur
app.post('/users', (req, res) => { console.log(req.body) });
app.use(express.urlencoded({ extended: true }));
```

**HTML dosyası göndermek için `res.sendFile()` kullanılır:**
```javascript
// ❌ Uzun yol
fs.readFile(filePath, (err, data) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(data);
});

// ✅ Express'in kısa yolu
res.sendFile(filePath); // Content-Type, hata yönetimi, stream — hepsini halleder
```

**Birden fazla statik dosya varsa `express.static()` kullanılır:**
```javascript
app.use(express.static('public'));
// public/index.html → http://localhost:8080/
// public/style.css  → http://localhost:8080/style.css
```

---

## 4. Karşılaştırma

| | Vanilla HTTP | Express.js |
|---|---|---|
| **Routing** | `req.method` ve `req.url` ile elle | `app.get()`, `app.post()` |
| **Body parse** | `req.on('data')` + `URLSearchParams` | `express.urlencoded()` / `express.json()` |
| **HTML dosyası** | `fs.readFile()` + `res.end(data)` | `res.sendFile()` |
| **JSON yanıt** | `JSON.stringify()` + `res.end()` | `res.json()` |
| **Hata yönetimi** | Elle yazılır | Middleware ile merkezi yönetim |

---

## 5. Kritik Notlar

### `if` ile `&&` — Virgül Operatörüne Dikkat
```javascript
// ❌ Yanlış — virgül operatörü soldaki ifadeyi yok sayar
if (req.method === 'POST', req.url === '/users')

// ✅ Doğru
if (req.method === 'POST' && req.url === '/users')
```

### `fs.readFile` — Buffer mı, String mi?
```javascript
// Buffer döner — binary dosyalar (resim, PDF) için uygundur
fs.readFile(filePath, (err, data) => { });

// String döner — metin dosyaları (HTML, JSON) için kullanılabilir
fs.readFile(filePath, 'utf-8', (err, data) => { });
```

`res.end()` her ikisini de kabul eder. `res.sendFile()` ise bunu tamamen soyutlar.

### Form Verisini Yanlış Parse Etmek
```javascript
// ❌ Yanlış — form verisi JSON değildir
const newUser = JSON.parse(body); // SyntaxError fırlatır

// ✅ Doğru
const parsed = new URLSearchParams(body);
const name = parsed.get('name');
```