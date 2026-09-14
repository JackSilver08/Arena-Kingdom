# 🏰 Arena Kingdom — Hướng dẫn chạy dự án

Tài liệu này hướng dẫn cài đặt và chạy Arena Kingdom v0.1 trên máy local.

---

## 1. Yêu cầu

| Công cụ | Phiên bản  | Kiểm tra  |
| ------- | ---------- | --------- |
| Node.js | 20 trở lên | `node -v` |
| npm     | 9 trở lên  | `npm -v`  |

> Đã chạy thử thành công với **Node.js v24.12.0** và **npm 11.6.2** trên Windows 11.

Không cần cài PostgreSQL — bản prototype hiện chưa dùng database.

---

## 2. Cấu trúc dự án

Dự án là **npm workspaces monorepo** gồm 3 package:

```
Arena Kingdom/
├── client/     # Game: Phaser 3 + TypeScript + Vite   → cổng 5173
├── server/     # Multiplayer: Colyseus + Express     → cổng 2567
├── shared/     # Kiểu dữ liệu & luật chơi dùng chung (GAME_RULES)
├── database/   # (trống — dành cho PostgreSQL sau này)
└── docs/       # Tài liệu gameplay
```

`client` và `server` đều import từ `@arena-kingdom/shared`, nên **`shared` phải được build trước**.

---

## 3. Chạy lần đầu

Mở terminal tại thư mục gốc dự án:

```bash
# 1. Cài toàn bộ dependencies cho cả 3 workspace
npm install

# 2. Build package shared (bắt buộc — tạo ra shared/dist/)
npm run build:shared

# 3. Chạy client + server cùng lúc
npm run dev
```

Khi thành công, terminal sẽ hiện:

```
[dev:client]   VITE v7.x  ready in ... ms
[dev:client]   ➜  Local:   http://localhost:5173/
[dev:server] Arena Kingdom server listening on http://localhost:2567
```

Mở trình duyệt tại **http://localhost:5173** để chơi.

Dừng server: nhấn `Ctrl + C` trong terminal.

---

## 4. Những lần chạy sau

```bash
npm run dev
```

Chỉ cần chạy lại `npm run build:shared` khi bạn **sửa file trong `shared/src/`**.

---

## 5. Các lệnh có sẵn

Chạy tại thư mục gốc:

| Lệnh                   | Tác dụng                                                   |
| ---------------------- | ---------------------------------------------------------- |
| `npm run dev`          | Chạy client + server song song                             |
| `npm run dev:client`   | Chỉ chạy client (đủ để chơi prototype offline)             |
| `npm run dev:server`   | Chỉ chạy server Colyseus                                   |
| `npm run build`        | Build production cả 3 workspace (shared → client → server) |
| `npm run build:shared` | Chỉ build shared                                           |
| `npm run build:client` | Build client ra `client/dist/`                             |
| `npm run build:server` | Build server ra `server/dist/`                             |
| `npm run format`       | Format code bằng Prettier                                  |

Chạy bản production của server sau khi build:

```bash
npm --workspace server run start
```

Xem trước bản build của client:

```bash
npm --workspace client run preview
```

---

## 6. Kiểm tra hoạt động

| Dịch vụ | URL                          | Kết quả mong đợi                                        |
| ------- | ---------------------------- | ------------------------------------------------------- |
| Client  | http://localhost:5173        | Màn chơi nền xanh, bản đồ 1280×720                      |
| Server  | http://localhost:2567/health | `{"ok":true,"game":"arena-kingdom","version":"0.1.0"}` |

Kiểm tra nhanh bằng terminal:

```bash
curl http://localhost:2567/health
```

Client lắng nghe trên `0.0.0.0`, nên máy khác cùng mạng LAN có thể truy cập qua địa chỉ `Network` mà Vite in ra (ví dụ `http://192.168.x.x:5173`).

---

## 7. Cách chơi (v0.1)

**Mục tiêu:** phá hủy lâu đài chính (Castle) của đối thủ.

### Điều khiển

| Phím / Thao tác            | Chức năng                                                       |
| -------------------------- | --------------------------------------------------------------- |
| `B`                        | Chế độ xây dựng → click vào lãnh thổ của bạn để đặt **Village** |
| `T`                        | Chế độ ra lệnh quân → click vào điểm đến                        |
| `M`                        | Mở / đóng menu Messenger (Cầu hòa / Đầu hàng)                   |
| `ESC`                      | Hủy chế độ hiện tại, quay về IDLE                               |
| Click vào Barracks của bạn | Tuyển 1 Soldier                                                 |

### Kinh tế

| Mục              | Giá trị            |
| ---------------- | ------------------ |
| Vàng khởi đầu    | 100                |
| Giá 1 Village    | 75 vàng            |
| Thu nhập Village | +5 vàng mỗi 5 giây |
| Giá 1 Soldier    | 20 vàng            |

Số liệu lấy từ `GAME_RULES` trong [shared/src/game.ts](shared/src/game.ts).

### Giới hạn hiện tại của prototype

- Chế độ `B` chỉ xây được **Village**; chưa xây được Barracks hoặc Tower.
- Chế độ `T` luôn điều **toàn bộ quân**. Logic chia quân 1/3 và 2/3 đã có trong code nhưng chưa được gán phím/nút nên chưa dùng được.
- Game chạy **local** hoàn toàn ở client. Server Colyseus mới là khung sườn — client chưa kết nối tới server.
- "Propose Peace" chỉ hiện thông báo, chưa có tác dụng.

---

## 8. Xử lý sự cố

### `npm install` báo `ERESOLVE could not resolve` với `@colyseus/schema`

`colyseus@0.16.x` yêu cầu `@colyseus/schema` **v3**. Kiểm tra [server/package.json](server/package.json):

```json
"@colyseus/schema": "^3.0.76"
```

Không dùng `^4.x`.

### Server crash: `TypeError: Cannot read properties of undefined (reading 'constructor')`

`@colyseus/schema` dùng decorator kiểu cũ. [server/tsconfig.json](server/tsconfig.json) phải có:

```json
"experimentalDecorators": true,
"useDefineForClassFields": false
```

### Client báo `Failed to resolve import "@arena-kingdom/shared"`

1. Chắc chắn đã chạy `npm run build:shared` (phải có thư mục `shared/dist/`).
2. [client/package.json](client/package.json) phải có `"@arena-kingdom/shared": "0.1.0"` trong `dependencies`.
3. Chạy lại `npm install` để npm tạo liên kết workspace.

### `npm run build` báo `TS7016: Could not find a declaration file for module 'express'`

```bash
npm install --workspace server --save-dev @types/express@^5
```

### Cổng 5173 hoặc 2567 đã bị chiếm

Đổi cổng server bằng biến môi trường `PORT`:

```powershell
# PowerShell
$env:PORT = "3000"; npm run dev:server
```

```bash
# Git Bash
PORT=3000 npm run dev:server
```

Cổng client được cấu hình trong [client/vite.config.ts](client/vite.config.ts). Nếu 5173 bị chiếm, Vite sẽ tự chuyển sang cổng kế tiếp — xem URL in ra terminal.

Hoặc tìm và tắt tiến trình đang chiếm cổng (PowerShell):

```powershell
Get-NetTCPConnection -LocalPort 5173 | Select-Object OwningProcess
Stop-Process -Id <PID>
```

### Cài lại từ đầu

```powershell
# PowerShell
Remove-Item -Recurse -Force node_modules, package-lock.json, shared/dist, client/dist, server/dist -ErrorAction SilentlyContinue
npm install
npm run build:shared
npm run dev
```

### Cảnh báo có thể bỏ qua

- `DEPRECATION WARNING: 'pingInterval', ... 'server' ... Server options will be permanently moved to WebSocketTransport` — cảnh báo từ Colyseus, server vẫn chạy bình thường.
- `Some chunks are larger than 500 kB after minification` khi build client — do thư viện Phaser lớn, không ảnh hưởng.
- `npm audit` báo vulnerabilities — đến từ dependencies của bên thứ ba, không chặn việc chạy local.

---

## 9. Các thay đổi đã áp dụng để dự án chạy được

Mã nguồn gốc không chạy được ngay bằng `npm install && npm run dev`. Các file sau đã được sửa:

| File                   | Thay đổi                                                        | Lý do                                        |
| ---------------------- | --------------------------------------------------------------- | -------------------------------------------- |
| `server/package.json`  | `@colyseus/schema` `^4.0.3` → `^3.0.76`                         | Xung đột peer dependency với `colyseus@0.16` |
| `server/package.json`  | Thêm devDependency `@types/express@^5`                          | `npm run build` lỗi thiếu type               |
| `server/tsconfig.json` | Thêm `experimentalDecorators`, `useDefineForClassFields: false` | Server crash khi khởi động                   |
| `shared/package.json`  | Thêm `main`, `types`, `exports` trỏ tới `dist/game.js`          | Package không resolve được khi import        |
| `client/package.json`  | Thêm dependency `@arena-kingdom/shared`                         | Client import shared nhưng không khai báo    |
