# Node.js Static File Server

Herhangi bir framework kullanmadan, yalnızca Node.js'in yerleşik modülleriyle yazılmış basit bir statik dosya sunucusu.

---

## Nasıl Çalışır?

### 1. Modüller ve Temel Ayarlar

```js
import * as fs   from "node:fs";
import * as http from "node:http";
import * as path from "node:path";

const PORT = 8000;
```

Node.js'in üç yerleşik modülünü kullanıyoruz:

- **`fs`** — Dosya sistemine erişim (okuma, yazma vb.)
- **`http`** — HTTP sunucusu oluşturma
- **`path`** — Dosya yollarını güvenli şekilde birleştirme

Sunucu `8000` numaralı portu dinleyecek.

---

### 2. MIME Türleri

```js
const MIME_TYPES = {
    default: "application/octet-stream",
    html: "text/html; charset=UTF-8",
    js: "text/javascript",
    css: "text/css",
    // ...
};
```

Tarayıcı bir dosya istediğinde, sunucunun o dosyanın **ne tür bir içerik** olduğunu söylemesi gerekir. Buna `Content-Type` header'ı denir. Bu nesne, dosya uzantısını (`html`, `css`, `js`...) doğru MIME türüyle eşleştirir.

> Örneğin `.js` uzantılı bir dosya için tarayıcıya `text/javascript` denir.

---

### 3. Statik Dosya Klasörü

```js
const STATIC_PATH = path.join(process.cwd(), "./static");
```

Sunucu, dosyaları proje kökündeki `static/` klasöründen servis eder. `path.join` ile bu klasörün tam yolu belirlenir.

---

### 4. `toBool` — Küçük Ama Zekice Bir Yardımcı

```js
const toBool = [() => true, () => false];
```

`fs.promises.access()` bir dosyaya erişilebilir olup olmadığını kontrol eder; başarılı olursa Promise resolve, başarısız olursa reject olur. `.then(...toBool)` bunu düzgünce `true`/`false`'a dönüştürür:

```js
const exists = await fs.promises.access(filePath).then(...toBool);
// dosya varsa → true, yoksa → false
```

---

### 5. `prepareFile` — Dosyayı Hazırla

```js
const prepareFile = async (url) => {
    const paths = [STATIC_PATH, url];
    if (url.endsWith("/")) paths.push("index.html");
    const filePath = path.join(...paths);
    const pathTraversal = !filePath.startsWith(STATIC_PATH);
    const exists = await fs.promises.access(filePath).then(...toBool);
    const found = !pathTraversal && exists;
    const streamPath = found ? filePath : `${STATIC_PATH}/404.html`;
    const ext = path.extname(streamPath).substring(1).toLowerCase();
    const stream = fs.createReadStream(streamPath);
    return { found, ext, stream };
};
```

Bu fonksiyon, gelen URL'yi alıp sunulacak dosyayı hazırlar. Adım adım:

| Adım | Ne Yapar? |
|---|---|
| `url.endsWith("/")` | URL `/` ile bitiyorsa `index.html` ekler |
| `path.join(...)` | URL'yi `static/` klasörüyle birleştirip tam yolu oluşturur |
| `pathTraversal` kontrolü | `../../etc/passwd` gibi klasör dışına çıkma saldırılarını engeller |
| `exists` | Dosyanın gerçekten var olup olmadığını kontrol eder |
| `streamPath` | Dosya bulunamazsa `404.html`'e yönlendirir |
| `createReadStream` | Dosyayı belleğe tamamen yüklemek yerine **stream** olarak açar (büyük dosyalar için verimli) |

---

### 6. HTTP Sunucusu

```js
http
    .createServer(async (req, res) => {
        const file = await prepareFile(req.url);
        const statusCode = file.found ? 200 : 404;
        const mimeType = MIME_TYPES[file.ext] || MIME_TYPES.default;
        res.writeHead(statusCode, { "Content-Type": mimeType });
        file.stream.pipe(res);
        console.log(`${req.method} ${req.url} ${statusCode}`);
    })
    .listen(PORT);
```

Her HTTP isteği bu callback ile karşılanır:

1. `prepareFile` ile istenilen dosya hazırlanır
2. Dosya bulunduysa `200 OK`, bulunamadıysa `404 Not Found` döner
3. `Content-Type` header'ı ayarlanır
4. `file.stream.pipe(res)` — Dosya içeriği, yanıt akışına yönlendirilir (stream → response)
5. İstek terminale loglanır

---

## Kod — Bütünü

```js
import * as fs from "node:fs";
import * as http from "node:http";
import * as path from "node:path";

const PORT = 8000;

const MIME_TYPES = {
    default: "application/octet-stream",
    html: "text/html; charset=UTF-8",
    js: "text/javascript",
    css: "text/css",
    png: "image/png",
    jpg: "image/jpeg",
    gif: "image/gif",
    ico: "image/x-icon",
    svg: "image/svg+xml",
};

const STATIC_PATH = path.join(process.cwd(), "./static");

const toBool = [() => true, () => false];

const prepareFile = async (url) => {
    const paths = [STATIC_PATH, url];
    if (url.endsWith("/")) paths.push("index.html");
    const filePath = path.join(...paths);
    const pathTraversal = !filePath.startsWith(STATIC_PATH);
    const exists = await fs.promises.access(filePath).then(...toBool);
    const found = !pathTraversal && exists;
    const streamPath = found ? filePath : `${STATIC_PATH}/404.html`;
    const ext = path.extname(streamPath).substring(1).toLowerCase();
    const stream = fs.createReadStream(streamPath);
    return { found, ext, stream };
};

http
    .createServer(async (req, res) => {
        const file = await prepareFile(req.url);
        const statusCode = file.found ? 200 : 404;
        const mimeType = MIME_TYPES[file.ext] || MIME_TYPES.default;
        res.writeHead(statusCode, { "Content-Type": mimeType });
        file.stream.pipe(res);
        console.log(`${req.method} ${req.url} ${statusCode}`);
    })
    .listen(PORT);

console.log(`Server running at http://127.0.0.1:${PORT}/`);
```

---

## Çalıştırmak İçin

```bash
# Proje klasöründe static/ dizini oluştur
mkdir static

# index.html ve diğer dosyalarını static/ içine koy, ardından:
node server.js
```

Sunucu `http://127.0.0.1:8000` adresinde çalışmaya başlayacak.