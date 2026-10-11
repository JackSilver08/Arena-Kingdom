# Triển khai Arena Kingdom — Competitive MOBA, bản đầu

Ngày bắt đầu: 11/10/2026. Nhánh: `upgrade/competitive-moba`. Mốc gốc: `cc5d681`.

User đã chốt RTS 1v1 online công bằng và đồ họa fantasy lấy cảm hứng từ Liên Minh, đồng ý bắt đầu triển khai. Bản đầu hoàn thành các nền tảng và đồ họa chơi được dưới đây. Season, nhiều region, spectator, deterministic replay server và production deployment thuộc các đợt tiếp theo trong báo cáo tổng thể.

## Ràng buộc chung

- Asset/huy hiệu nguyên bản; không dùng tài nguyên Riot. Giữ Phaser 2D và luật RTS, không thêm engine hay dependency nặng.
- Điều chỉnh mới nhất: bỏ sông và đường nối trên map; giữ mặt cỏ liên tục, biển ngoài đảo và nền công trình. Fallback không vẽ lại sông. Geometry/pathfinding giữ nguyên.
- Presentation không đổi geometry, HP/DPS/range, economy hoặc Elo. Formation/fog/protocol được sửa có regression tests.
- Fog là luật engine/server; không hiển thị đối tượng/sự kiện ẩn hoặc gửi kinh tế đối phương khi đang chơi. Thông tin cuối trận có thể công khai.
- Private không đổi Elo. Ranked chỉ ghép bởi server, một user có tối đa một trận online đang hoạt động, reconnect giữ seat.
- Không thay auth/session hoặc schema sản phẩm; không xóa database/ảnh/secret. Test dùng SQLite riêng, bị gitignore.
- Yêu cầu mới của người dùng: sau khi kiểm tra hoàn tất, commit và cập nhật GitHub `main`. Không deploy production. Mỗi nhóm thay đổi phải được review; QA/typecheck/tests/build/bundle và kiểm browser trước bàn giao.
- HUD 1440/1366/390/360 không đè nút chính; touch targets chính >=44px. Quality/reduced motion không thay gameplay.

## Các task và nghiệm thu

### 1. Engine và protocol

Owner: shared/src/{network,engine,types,formations}.ts và shared/test.

Sửa packed bits để mọi unit type x rearguard x retreat round-trip đúng; tăng protocol và từ chối phiên cũ rõ ràng. Defense multiplier >1 giảm damage nhận. Attack target phải visible lúc nhận command; khi mất vision chuyển sang last visible point, không theo tọa độ thật. Che gold/income/private stats của đối thủ khi trận đang chạy, giữ own player và reveal end. Test cả hai side, unit/building, lost vision, ended snapshots.

### 2. Online admission và HTTP

Owner: server/src và server/test; client/src/game/session.ts, client/src/pages/play.ts. Không sửa các file shared do task 1 sở hữu.

Server queue ghép hai tài khoản rồi cấp reservation/ticket. Raw create/joinById không thể tạo ranked tùy ý. Private vẫn tạo/join bằng code và không Elo. Global active-user lease giữ khi disconnect/reconnect, giải phóng khi leave-before-start/end/dispose. Validate protocol ở admission. Matchmaking HTTP có body/rate/time caps trước Colyseus collector. SPA HEAD hỗ trợ đúng MIME. Thêm integration tests auth/ranked/private/duplicate/reconnect/caps/result. Không đổi auth storage hoặc DB schema trong task này.

### 3. Terrain và entity art

Owner: client/src/game/{mobaMapArt,visuals}.ts và các file art mới; được sửa mapArt/symbols/art nếu cần, không sửa BattleScene/GameController/styles/settings.

Làm MOBA fantasy nguyên bản: cỏ/rừng/vách đá/bờ biển/căn cứ có chiều sâu, bỏ địa hình chặn giả; vách đá từ MOUNTAIN_RIDGES ở mọi skin. Không sông/đường nối trong đảo. Đủ 7 unit, 5 building với team accents, footprint anchor, silhouette rõ và texture nhẹ. Menu art đồng bộ nếu khả thi. Preload có fallback và texture budget; cache terrain; không thêm raster concept làm nền gameplay. Descriptor key/width/height/anchorY giữ API hiện có. Kiểm SVG/roster/geometry và typecheck.

### 4. Camera, fog và combat presentation

Owner: client/src/game/BattleScene.ts và file camera/minimap/helpers mới. Không sửa visuals/GameController/styles/settings; báo interface cần dùng cho controller.

Đọc settings thêm quality ('low'|'medium'|'high'), nature, weather. Giữ một settings panel do BattleScene sở hữu. Fog tối rõ vùng ẩn, cập nhật cadence có giới hạn, không cloud lớn trôi; event visibility từ engine. Sprite theo tọa độ chân, chuyển động quân/attack feedback gọn, reduced motion tắt bob/shake/overshoot. Zoom/pan/clamp desktop wheel/middle drag và touch pinch/pan có mode rõ; pointerToCamera dùng cho mọi lệnh. Minimap chỉ dùng view hiện tại, fog và click camera; không lộ enemy. Public scene camera methods có thể gọi từ HUD. Kiểm drag-select/build/fence zoom/replay/resize.

### 5. HUD, settings, recorder và QA (root)

Owner: GameController.ts, pages/battle.ts, styles.css, displaySettings*.ts/css, battleRecap.ts/css và recorder module mới, shared/src/weather.ts chỉ copy mô tả, tools QA, package scripts.

Một panel settings; preset Low/Medium/High, nature/weather riêng, focus/keyboard. HUD dark teal/brass, selected army info, camera controls/hints; responsive và touch targets >=44px. Recorder final một lần, không nhân view cuối và không cắt phần đầu do ngồi ở end; label arrow/cannon. Cosmetic weather mô tả đúng. MOBA là default chính thức, QA guard đồng bộ và có client/server test gates; asset budget gồm binary. Regression tests cho recorder/settings/camera math nơi có logic, browser cho UI.

### 6. Tích hợp, review và bàn giao

Chạy npm ci, typecheck, toàn bộ tests, build, QA, bundle/asset budgets. Server test riêng với DB test; kiểm local route/MIME, ranked/private admission/reconnect. Browser desktop/mobile, settings O, sprite/map/fog/command/camera/recap và console. Review độc lập toàn diff, sửa phát hiện quan trọng rồi kiểm lại phần liên quan. Ghi kết quả thực, giới hạn, đường dẫn và cách chạy trong docs/IMPLEMENTATION_RESULT.vi.md. Commit chỉ khi sạch test và không chứa dữ liệu/secret; push GitHub theo yêu cầu mới, không deploy production.

## Tiến độ

- Baseline: npm ci pass; 61 shared tests pass. QA static mismatch đã biết, thuộc task 5.
- Task 1–5: hoàn thành trong phạm vi v0.8, bao gồm yêu cầu bỏ sông/đường.
- Task 6: QA/typecheck/128 tests/build/bundle, browser và local route/MIME pass; review và báo cáo đã hoàn thành. Commit/push được xác nhận ở lần bàn giao.
- Giới hạn thực tế và roadmap còn lại: xem [IMPLEMENTATION_RESULT.vi.md](IMPLEMENTATION_RESULT.vi.md).
