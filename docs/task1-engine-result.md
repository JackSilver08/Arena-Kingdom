# Task 1 — Engine và protocol

Ngày: 11/10/2026. Độ phức tạp: Phức tạp. Thực hiện bằng coding agent theo model của phiên cha, dùng regression test trước khi sửa. Không commit, stage, push hoặc deploy; không thêm dependency.

## Thay đổi

- `shared/src/network.ts`: xuất `SNAPSHOT_PROTOCOL_VERSION = 6`; encode luôn v6, decode từ chối thiếu version hoặc version khác 6 bằng lỗi rõ ràng yêu cầu cập nhật client/server cùng nhau. Server admission/client session owner đã được thông báo.
- Unit flags: side bit 0; moving bit 1; attacking bit 2; unit type bits 3–5; rearguard bit 6; retreat bit 7; formation bits 8–9 và presence bit 10. Giữ stride 6 số/unit, 9 số/building. Train type và 8 fence rotations giữ nguyên.
- Player wire stride là `3 + STAT_KEYS.length`: disclosure flag, gold, income, stats. `privateInfoVisible=false` nghĩa là dữ liệu riêng đã redacted về zero, không phải số zero thật. Encoder/decoder giữ marker và không đưa giá trị riêng vào payload khi marker false. Own player và full authoritative engine state vẫn giữ số thật.
- `shared/src/engine.ts`, `formations.ts`: incoming damage chia cho defense multiplier; Square 1.18 bảo vệ tốt hơn. Knight counter 3% và Fall Back rearguard 35% tiếp tục áp dụng theo cùng công thức.
- Commands move/army có target ID chỉ được nhận khi enemy sống và visible. Hidden, missing, friendly, dead ID trả cùng lỗi; rejected command không đổi order. Coordinate attack-move vẫn hợp lệ.
- Attack order lưu/cập nhật last visible point. Mất vision chuyển sang attack-move đến point này, reset tracking/navigation; có thể explicit retarget khi enemy hiện lại. Auto acquisition/current target (đặc biệt Cannon range > vision) cũng dùng visibility predicate chung.
- Observer DTO được tạo từ field công khai; không trải `MatchState`/`UnitState`, không lộ target/order/path/private cooldown. Live enemy economy/statistics redacted; ended view reveal players và entities. Enemy projectile event chỉ được gửi khi cả hai endpoint visible, tránh lộ hidden origin/destination.
- Pathfinding vẫn biết static collision walls để quân đến được tường cần phá. Hidden wall chỉ là obstacle navigation; targetId và shot/damage chỉ xuất hiện sau khi visible. Regression breach pathing vẫn pass.
- `shared/scripts/balance.ts` (scope bổ sung do owner cha giao): controller chỉ đọc enemy targets/incursions từ `viewForSide`; khi chưa thấy mục tiêu thì attack-move đến castle spawn từ public starting layout, không đọc hidden castle ID/position. Module có CLI guard để tests import controller mà không chạy lab. Local `BotController` tiếp tục dùng authoritative state cho own economy, không bị snapshot redaction sửa state.

## Regression và kiểm tra

- Viết `competitive-engine.test.ts` trước sửa: 8 failures tái hiện các lỗi codec, version, defense, fog commands/tracking, Cannon targeting và opponent data leak. Training/fence compatibility test đã pass trên baseline, giữ làm regression bảo toàn.
- Viết test enemy projectile endpoint leak: fail trên filter cũ, pass sau sửa.
- Viết formation metadata test: fail vì decode trả undefined, pass sau packing mới.
- Viết `balance-controller.test.ts`: blind advance fail khi controller gửi hidden ID, pass sau dùng public spawn; visible explicit targeting cũng pass.
- Cập nhật existing tests theo luật mới: divide defense, test Knight counter trong cùng formation, target phải được reveal trước lệnh, Cannon siege dùng spotter. Không bỏ assertion core hoặc bỏ test.
- `npm --workspace shared run test`: **74/74 pass**, 0 fail. Bao gồm matrix 224 unit flag combinations, 112 training/fence combinations, mọi formation, hai sides, unit/building targets, lost vision sau cập nhật latest visible point, ended snapshots, raw parsed commands, local bot full-match invariant.
- `npm run build:shared`: **pass**.
- `git diff --check` trong phạm vi shared task: **pass**, chỉ có cảnh báo line ending LF/CRLF của Git.
- Server typecheck đã pass trong lượt tương thích. Full client/server/build/QA cần chạy sau khi các owner hoàn tất; lượt giữa implementation không phải gate bàn giao cuối toàn dự án.

## Balance smoke thực tế

`npm run simulate:balance -- 1`: **pass**, 6 scripted matches, 43.7 giây; invariant không âm/NaN gold pass. Run cũ trước sửa controller đã được dừng bằng Ctrl+C vì hidden-ID commands không còn hợp lệ.

| Pair | First strategy wins | Draw | Simulated duration |
| --- | --- | --- | --- |
| rush / economy | 0/1 | 0 | 8.99 phút |
| rush / defensive | 1/1 | 0 | 6.62 phút |
| rush / balanced | 0/1 | 0 | 9.93 phút |
| economy / defensive | 1/1 | 0 | 5.69 phút |
| economy / balanced | 1/1 | 0 | 12.08 phút |
| defensive / balanced | 0/1 | 0 | 13.81 phút |

Đây là smoke/invariant, không kết luận balance: chỉ 1 repeat/pair, chưa mirror sides trong lab này, RNG chưa seed. Combat regressions riêng kiểm cả blue/red. So với baseline, controller nay advance bằng luật fog hợp lệ; không dùng số cũ để suy ra cải thiện cân bằng.

## Giới hạn

- Protocol v5 không tương thích v6: release client/server cùng nhau; admission và decode đều cần giữ kiểm version.
- `militia.ts` vẫn có lifecycle AI scan theo full state: village trigger edge distance 150 có thể tương đương center 176, lớn hơn village vision 160; leash có thể lớn hơn vision. Engine updateUnits chặn hidden target trước combat, nhưng mở rộng chính sách fog cho toàn bộ decision-making của AI/garrison là phase riêng. Không sửa militia module trong task này.
- Quality/render/browser/online admission integration không thuộc owner task 1; owner cha chạy gate tổng và review cuối. Chưa deploy hoặc kiểm production.
