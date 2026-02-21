# Node.js HTTP Notları

---

## 1. Express Olmadan HTTP Sunucusu

Node.js'in built-in `http` modülü ile sunucu şöyle kurulur:

```javascript
import http from 'node:http';

const server = http.createServer((req, res) => {
    // Her istek buraya düşer
});

server.listen(8080, () => {
    console.log('http://localhost:8080/');
});
```

Gelen her isteğin iki önemli bilgisi vardır:

- `req.method` → İsteğin tipi: `GET`, `POST` gibi
- `req.url` → İsteğin hangi adrese gittiği: `/`, `/users` gibi

Route'lar bu ikisi kontrol edilerek elle yazılır:

```javascript
if (req.method === 'GET' && req.url === '/users') {
    // bu bloğu çalıştır
}
```

> ⚠️ Koşullar arasında mutlaka `&&` kullan, virgül değil.
> `if (req.method === 'POST', req.url === '/users')` yanlıştır — virgül soldaki koşulu yok sayar.

---

## 2. HTML Dosyası Göndermek

`res.end()` içine dosya yolu yazmak **çalışmaz:**

```javascript
res.end('/index.html') // ❌ Bu metin olarak gönderilir, dosya içeriği değil
```

`res.end()` sadece içine ne verirsen onu gönderir. Dosya yolu bir string'dir, onun içeriğini otomatik okumaz.

Doğru yol: önce `fs.readFile()` ile dosyayı oku, sonra içeriği gönder:

```javascript
import fs from 'fs';

fs.readFile(filePath, 'utf-8', (err, data) => {
    if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
    } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data); // artık dosyanın gerçek içeriği gönderiliyor
    }
});
```

### `fs.readFile` — encoding verilirse ne olur?

```javascript
// encoding yok → data bir Buffer döner
fs.readFile(filePath, (err, data) => { });

// encoding var → data bir string döner
fs.readFile(filePath, 'utf-8', (err, data) => { });
```

**Buffer nedir?** Dosya diskten okunduğunda ham veri byte'lar halinde gelir. Buffer bu byte'ları bellekte tutan bir yapıdır. `'utf-8'` verdiğinde Node.js o byte'ları okuyabilir metne çevirir. `res.end()` her ikisini de kabul eder, sonuç aynıdır.

---

## 3. POST — Body Nasıl Okunur?

POST isteğindeki body bir anda gelmez, parça parça (stream olarak) gelir. Bu yüzden biriktirmek gerekir:

```javascript
if (req.method === 'POST' && req.url === '/users') {
    let body = '';

    req.on('data', chunk => {
        body += chunk.toString(); // her parça geldiğinde ekle
    });

    req.on('end', () => {
        // tüm parçalar geldi, artık işlenebilir
        console.log(body); // name=Ahmet
    });
}
```

### Form verisi JSON değildir

HTML formları veriyi şu formatta gönderir:

```
name=Ahmet
```

Bu JSON formatı değildir. `JSON.parse(body)` hata verir. Bunun yerine `URLSearchParams` kullanılır:

```javascript
req.on('end', () => {
    const parsed = new URLSearchParams(body);
    const name = parsed.get('name'); // 'Ahmet'

    const newUser = { id: users.length + 1, name };
    users.push(newUser);

    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(newUser));
});
```

---

## 4. `return` Kullanımı

Her `if` bloğunun sonuna `return` ekle. Yoksa bir istek birden fazla bloğa girebilir ve `res.end()` iki kez çağrılarak hata alırsın:

```javascript
if (req.method === 'GET' && req.url === '/') {
    fs.readFile(filePath, 'utf-8', (err, data) => {
        res.end(data);
    });
    return; // ✅ alttaki if bloklarına girme
}

if (req.method === 'GET' && req.url === '/users') {
    res.end(JSON.stringify(users));
    return; // ✅
}
```

---

## 5. Express ile Aynı Yapı

Express, yukarıda elle yaptığın şeyleri senin yerine halleder.

### Routing

```javascript
// Vanilla HTTP — elle kontrol
if (req.method === 'GET' && req.url === '/users') { }

// Express — doğrudan tanımlanır
app.get('/users', (req, res) => { });
app.post('/users', (req, res) => { });
```

### HTML Dosyası Göndermek

```javascript
// Vanilla HTTP — fs.readFile + res.end
fs.readFile(filePath, 'utf-8', (err, data) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(data);
});

// Express — tek satır
res.sendFile(filePath); // okuma, hata yönetimi, Content-Type — hepsini halleder
```

### Body Parse — Middleware

Express'te `req.body` otomatik dolu gelmez. Middleware tanımlanmazsa `undefined` olur.

```javascript
app.use(express.urlencoded({ extended: true })); // form verisini parse eder
app.use(express.json());                          // JSON body'yi parse eder
```

Bu middleware'ler arka planda tam olarak şunu yapar: stream'i birleştirir, formatı tespit eder ve `req.body`'ye bağlar. Vanilla HTTP'de bunu `req.on('data')` ve `URLSearchParams` ile sen yapıyordun.

> ⚠️ Middleware'ler route tanımlarından **önce** yazılmalıdır. Sonra yazılırsa `req.body` undefined gelir.

```javascript
// ✅ Doğru sıra
app.use(express.urlencoded({ extended: true }));

app.post('/users', (req, res) => {
    console.log(req.body); // { name: 'Ahmet' }
});
```

---

## Özet

| | Vanilla HTTP | Express |
|---|---|---|
| Routing | `req.method` + `req.url` ile elle | `app.get()`, `app.post()` |
| HTML dosyası | `fs.readFile()` + `res.end(data)` | `res.sendFile()` |
| Form body parse | `req.on('data')` + `URLSearchParams` | `express.urlencoded()` middleware |
| JSON body parse | `req.on('data')` + `JSON.parse()` | `express.json()` middleware |