# 🏰 Arena Kingdom — Hướng dẫn chạy dự án

Tài liệu này hướng dẫn cài đặt, chạy và phát triển Arena Kingdom v0.2 trên máy local.

---

## 1. Yêu cầu

| Công cụ | Phiên bản     | Kiểm tra  |
| ------- | ------------- | --------- |
| Node.js | **22.13** trở lên (khuyến nghị 24) | `node -v` |
| npm     | 9 trở lên     | `npm -v`  |

> Đã chạy thử thành công với **Node.js v24.12.0** và **npm 11.6.2** trên Windows 11.

**Không cần cài database.** Server dùng SQLite tích hợp sẵn trong Node (`node:sqlite`), file dữ liệu được tạo tự động tại `database/arena.db` ở lần chạy đầu tiên.

---

## 2. Cấu trúc dự án

Dự án là **npm workspaces monorepo** gồm 3 package:

```
Arena Kingdom/
├── shared/                 # Dùng chung cho client và server
│   ├── src/rules.ts        #   Luật chơi & chỉ số (GAME_RULES, BUILDING_STATS, UNIT_STATS)
│   ├── src/engine.ts       #   Engine mô phỏng trận đấu (MatchEngine)
│   ├── src/ai.ts           #   AI đối thủ 3 cấp độ (BotController)
│   ├── src/network.ts      #   Định dạng snapshot gửi qua mạng
│   ├── src/api.ts          #   Kiểu dữ liệu REST API
│   ├── test/               #   Test engine (node:test)
│   └── scripts/simulate.ts #   Cho bot đấu bot để cân bằng game
├── server/                 # Express + Colyseus + SQLite       → cổng 2567
│   ├── src/http/           #   REST API (/api/...)
│   ├── src/db/             #   Schema, migration, truy vấn SQLite
│   ├── src/auth/           #   Băm mật khẩu (scrypt)
│   └── src/rooms/          #   ArenaRoom — phòng PvP, server làm trọng tài
├── client/                 # Vite + Phaser + TypeScript         → cổng 5173
│   ├── src/pages/          #   Các trang: home, play, battle, profile, history...
│   ├── src/game/           #   BattleScene (Phaser), GameController (HUD), session
│   ├── src/components/     #   Layout, component UI
│   └── src/lib/            #   Router, API client, template HTML an toàn
├── database/               # File SQLite (tự tạo, đã gitignore)
└── docs/GAMEPLAY.md        # Luật chơi chi tiết
```

---

## 3. Chạy lần đầu

Mở terminal tại thư mục gốc dự án:

```bash
# 1. Cài dependencies cho cả 3 workspace
npm install

# 2. Chạy shared (watch) + client + server cùng lúc
npm run dev
```

`npm run dev` tự build `shared` trước khi khởi động. Khi thành công, terminal hiện:

```
[client]   VITE v7.x  ready in ... ms
[client]   ➜  Local:   http://localhost:5173/
[server] Arena Kingdom server v0.2.0 listening on http://localhost:2567
```

Mở trình duyệt tại **http://localhost:5173**.

Dừng: nhấn `Ctrl + C`.

> Trong môi trường dev, Vite proxy `/api` và `/colyseus` sang server, nên trình duyệt (kể cả máy khác trong mạng LAN) chỉ cần truy cập cổng 5173.

---

## 4. Các lệnh có sẵn

Chạy tại thư mục gốc:

| Lệnh                     | Tác dụng                                                          |
| ------------------------ | ----------------------------------------------------------------- |
| `npm run dev`            | Chạy shared (watch) + client + server song song                   |
| `npm run dev:client`     | Chỉ chạy client (đủ để chơi với AI, không có tài khoản/online)    |
| `npm run dev:server`     | Chỉ chạy server (cần `npm run build:shared` trước)                |
| `npm run build`          | Build production cả 3 workspace (shared → client → server)        |
| `npm start`              | Chạy bản production: server phục vụ luôn client trên cổng 2567    |
| `npm test`               | Chạy test engine & AI                                             |
| `npm run typecheck`      | Kiểm tra kiểu TypeScript cho cả 3 workspace                       |
| `npm run simulate`       | Bot đấu bot, ví dụ `npm run simulate -- hard normal 20`           |

### Chạy bản production

```bash
npm run build
npm start
```

Mở **http://localhost:2567** — một cổng duy nhất phục vụ web, API và phòng game.

---

## 5. Cấu hình

Tạo file `server/.env` (xem mẫu [server/.env.example](server/.env.example)):

| Biến                | Mặc định            | Ý nghĩa                                              |
| ------------------- | ------------------- | ---------------------------------------------------- |
| `PORT`              | `2567`              | Cổng server                                          |
| `DATABASE_PATH`     | `database/arena.db` | Đường dẫn file SQLite (tính từ thư mục gốc dự án)    |
| `SESSION_TTL_DAYS`  | `30`                | Thời hạn phiên đăng nhập                             |
| `RECONNECT_SECONDS` | `30`                | Thời gian chờ người chơi PvP kết nối lại trước khi xử thua |

Nếu đổi cổng server khi chạy dev, báo cho Vite biết:

```powershell
# PowerShell
$env:ARENA_SERVER = "http://localhost:3000"; npm run dev:client
```

Nếu client được host tách biệt khỏi server, build client với `VITE_SERVER_URL=https://your-server`.

---

## 6. Tính năng & trang web

| Đường dẫn           | Nội dung                                                            |
| ------------------- | ------------------------------------------------------------------- |
| `/`                 | Trang chủ: số liệu trực tiếp, top người chơi, trận gần đây          |
| `/play`             | Sảnh chơi: đấu AI, tìm trận xếp hạng, tạo/vào phòng riêng bằng mã   |
| `/battle`           | Màn chơi                                                            |
| `/register`, `/login` | Đăng ký / đăng nhập                                               |
| `/profile`          | Hồ sơ: thống kê, đổi tên hiển thị, avatar, mật khẩu                 |
| `/history`          | Lịch sử trận đấu (lọc Online / AI)                                  |
| `/matches/:id`      | Báo cáo chi tiết một trận                                           |
| `/leaderboard`      | Bảng xếp hạng Elo                                                   |
| `/players/:username`| Hồ sơ công khai của người chơi                                      |
| `/guide`            | Hướng dẫn chơi (sinh tự động từ luật trong `shared`)                |

**Chế độ chơi**

- **Đấu AI** — chạy hoàn toàn trong trình duyệt, 3 cấp độ Squire / Knight / Warlord. Khách vẫn chơi được; người đã đăng nhập được lưu kết quả vào lịch sử (không ảnh hưởng Elo).
- **Xếp hạng 1v1** — ghép trận online, server làm trọng tài, tính Elo (K = 32, khởi điểm 1000).
- **Phòng riêng** — tạo phòng, gửi mã cho bạn bè. Trận giao hữu: lưu lịch sử, không đổi Elo.
- Mất kết nối hoặc tải lại trang giữa trận online → tự động vào lại trận trong 30 giây.

Luật chơi và phím điều khiển: xem [docs/GAMEPLAY.md](docs/GAMEPLAY.md).

---

## 7. Kiểm tra hoạt động

| Dịch vụ | URL                              | Kết quả mong đợi                                        |
| ------- | -------------------------------- | ------------------------------------------------------- |
| Client  | http://localhost:5173            | Trang chủ Arena Kingdom                                 |
| Server  | http://localhost:2567/health     | `{"ok":true,"game":"arena-kingdom","version":"0.2.0"}` |
| API     | http://localhost:2567/api/overview | Số người chơi, số trận, phòng đang mở                 |

```bash
curl http://localhost:2567/health
npm test
```

---

## 8. Xử lý sự cố

### Server báo `No such built-in module: node:sqlite`

Node.js quá cũ. Cài Node **22.13+** (khuyến nghị 24).

### Client báo `Cannot reach the Arena Kingdom server`

Server chưa chạy hoặc chạy ở cổng khác. Chạy `npm run dev` (hoặc `npm run dev:server`) và kiểm tra http://localhost:2567/health. Chế độ đấu AI vẫn chơi được khi không có server.

### Server báo `Cannot find module '@arena-kingdom/shared'` hoặc `shared/dist`

```bash
npm run build:shared
```

### Không vào được trận online từ máy khác trong mạng LAN

Truy cập bằng địa chỉ `Network` mà Vite in ra (ví dụ `http://192.168.x.x:5173`) và cho phép Node.js qua Windows Firewall. Hai tài khoản khác nhau mới ghép trận được với nhau.

### Cổng 5173 hoặc 2567 đã bị chiếm

```powershell
Get-NetTCPConnection -LocalPort 2567 | Select-Object OwningProcess
Stop-Process -Id <PID>
```

Hoặc đổi cổng qua biến `PORT` (xem mục 5).

### Muốn xóa toàn bộ tài khoản & lịch sử trận

Dừng server rồi xóa `database/arena.db*`. File mới sẽ được tạo ở lần chạy tiếp theo.

### Cài lại từ đầu

```powershell
Remove-Item -Recurse -Force node_modules, shared/dist, client/dist, server/dist -ErrorAction SilentlyContinue
npm install
npm run dev
```

### Cảnh báo có thể bỏ qua

- `Some chunks are larger than 500 kB` khi build client — Phaser lớn; chunk này chỉ tải khi vào trận.
- `npm audit` báo vulnerabilities — đến từ dependencies bên thứ ba, không chặn việc chạy local.

---

## 9. Ghi chú kỹ thuật

- **Engine dùng chung**: `MatchEngine` chạy tick cố định 50 ms. Trận AI chạy engine trong trình duyệt; trận online chạy cùng engine trên server và gửi snapshot nén 10 lần/giây.
- **Bảo mật**: mật khẩu băm scrypt; token phiên chỉ lưu dạng SHA-256 trong DB; giới hạn số lần đăng nhập/đăng ký theo IP; mọi lệnh từ client đều được kiểm tra (`parseCommand`) và giới hạn 20 lệnh/giây.
- **Database**: schema và migration nằm trong [server/src/db/database.ts](server/src/db/database.ts) — thêm migration mới vào cuối mảng `MIGRATIONS`, không sửa migration đã chạy.
- **Cân bằng game**: sửa số liệu trong [shared/src/rules.ts](shared/src/rules.ts), rồi chạy `npm run simulate -- normal normal 50` để kiểm tra.
