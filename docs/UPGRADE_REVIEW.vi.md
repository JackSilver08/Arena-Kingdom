# Arena Kingdom — Đánh giá và đề xuất nâng cấp toàn diện

Ngày đánh giá: **11/10/2026**. Nguồn: https://github.com/JackSilver08/Arena-Kingdom.

Commit được đánh giá: `cc5d681e134136a36124ba3c14df4f6eddec4c3e`, branch `main`.

Repo local: `D:\Summer Train\Arena-Kingdom`. Độ phức tạp: **Phức tạp**; cấp model đề xuất: Codex mạnh nhất cho implementation liên quan simulation, protocol và ranked.

**Ưu tiên do người dùng chọn: RTS 1v1 cạnh tranh, online công bằng; đồ họa lấy cảm hứng từ Liên Minh Huyền Thoại.** Nội dung bên dưới là đánh giá tại mốc gốc, trước khi triển khai. Đợt nâng cấp đầu v0.8 và yêu cầu bỏ sông/đường đã được thực hiện; trạng thái mới, kiểm thử và giới hạn nằm trong [báo cáo triển khai](IMPLEMENTATION_RESULT.vi.md). Chưa deploy production.

## 1. Kết luận và hướng phát triển

Game có nền tảng tốt để tiếp tục phát triển: engine TypeScript dùng chung cho offline/online, Phaser tách khỏi luật chơi, Colyseus chạy authoritative simulation, SQLite lưu tài khoản/trận đấu. Nên giữ kiến trúc này và nâng cấp theo từng phần có kiểm thử.

Ưu tiên trước mắt là **tính đúng đắn và công bằng của trận đấu**, rồi đến điều khiển, cân bằng và mỹ thuật. Chưa nên mở rộng ranked công khai trước khi sửa codec, fog targeting và quyền ghép trận. Production build pass không chứng minh các luật chơi và chính sách ranked đang đúng.

Ba hướng có thể chọn:

| Hướng | Lợi ích | Đánh đổi | Đề xuất |
| --- | --- | --- | --- |
| Củng cố RTS 1v1 cạnh tranh | Phù hợp engine, tài khoản/Elo và ưu tiên người dùng; có thể phát hành từng đợt | Cần đầu tư integration tests, admission policy, reconnect và cân bằng | **Chọn làm trục chính** |
| AI/offline với thử thách và nhiệm vụ | Dễ thu hút người mới, ít phụ thuộc số người online | Không giải quyết trực tiếp công bằng ranked | Dùng làm onboarding và luyện tập |
| Nâng đồ họa MOBA fantasy 2.5D lấy cảm hứng từ Liên Minh Huyền Thoại | Bản đồ vẽ tay có chiều sâu, sprite dễ nhận diện, HUD fantasy thống nhất | Tăng công làm asset, tải xuống và chi phí render | **Hướng mỹ thuật được người dùng chọn**, thực hiện theo đợt có ngân sách |

Hướng mỹ thuật đã chọn: **MOBA fantasy 2.5D lấy cảm hứng từ Liên Minh Huyền Thoại**: địa hình vẽ tay, rừng xanh sâu, đá có mặt sáng/tối, nước turquoise, công trình fantasy và ánh sáng phép thuật tiết chế; quân có sprite/silhouette rõ, HUD xanh đen với viền đồng/vàng cũ. Vẫn dùng Phaser 2D và world coordinates hiện tại. Blue/crimson nhận diện đội; vàng dành cho selection/orders. Mọi skin phải thể hiện cùng địa hình vật lý. Asset, bản đồ, huy hiệu và nhân vật được thiết kế nguyên bản cho Arena Kingdom.

Chi tiết asset, HUD, hiệu ứng, camera, ngân sách hiệu năng và tiêu chí nghiệm thu: [Kế hoạch nâng cấp đồ họa MOBA](GRAPHICS_MOBA_UPGRADE.vi.md). Định hướng mới này thay cho đề xuất parchment/sa bàn ở bản báo cáo trước; các tài liệu graphics cũ trong repo được giữ làm lịch sử.

## 2. Những phần đã có — tránh làm lại

- Bot ba độ khó, ranked 1v1, private room, tài khoản, hồ sơ, lịch sử và Elo leaderboard.
- Economy, supply/upkeep; Soldier, Archer, Knight, Scout, Cannon, Militia, Royal Guard.
- Fog of war, last-known markers, bốn formation, Tactical Fall Back, hàng rào có xoay, núi vật cản và pathfinding.
- Ba map style; command arrows, frontline/influence, sóng, rừng và thời tiết thị giác.
- Hotkeys, guide, menu xây dựng/tuyển quân, tùy chỉnh hiển thị và hỗ trợ reduced motion một phần.
- Battle Recap trong RAM với timeline và tốc độ 0.25–2×. Đây chưa phải replay lưu lâu dài trên server.
- Shared engine tests, CI QA workflow, bundle budget và balance lab.

README/package vẫn ghi v0.2 trong khi health/gameplay hiện là v0.7.0. Tài liệu cần đồng bộ với implementation thực tế.

## 3. Các vấn đề cần xử lý trước

P1 là lỗi cần ưu tiên trước khi phát hành ranked rộng rãi; P2 là cải thiện tiếp theo. Mức ưu tiên sản phẩm không đồng nghĩa với severity của advisory dependency.

### AK-01 — P1: Codec online làm đổi loại quân

**Vị trí:** `shared/src/network.ts:50`, `:51`, `:110`, `:111`.

`unitType << 3` chiếm các bit 8/16/32, nhưng `rearguard` dùng lại bit 32. Probe round-trip xác nhận bảy tổ hợp sai: Soldier hậu quân thành Scout, Archer hậu quân thành Cannon, Knight hậu quân thành Soldier; Scout/Royal Guard/Cannon có thể bị đánh dấu hậu quân dù đầu vào false. Bit retreating 64 không chồng ba bit loại quân hiện tại.

**Sửa:** phân bổ bit riêng, tăng wire version, định nghĩa xử lý client/server khác phiên bản. Thêm test mọi `unitType × side × moving × attacking × rearguard × retreating`; test trainType và fence rotation cùng protocol. Nghiệm thu: không đổi loại/flag khi encode→decode và lỗi phiên bản phải được báo rõ.

### AK-02 — P1: Bonus phòng thủ formation bị đảo nghĩa

**Vị trí:** `shared/src/formations.ts:48`, `shared/src/engine.ts:1522`, `client/src/game/GameController.ts:879`.

Square ghi `defenseMultiplier=1.18` và UI quảng bá +18% defence, nhưng engine nhân sát thương nhận vào với 1.18. Probe sát thương gốc 10: Line nhận 10.5, Column 9.8, Wedge 9.5, Square 11.8.

**Sửa:** chốt rõ hệ số là defence hay incoming damage; sửa công thức và wording tương ứng. Nghiệm thu bằng test outcome của giao tranh, bao gồm tương tác Knight counter và Fall Back; không chỉ assert hằng số. Chạy lại balance sau sửa.

### AK-03 — P1: Lệnh có thể truy đuổi mục tiêu khuất trong fog

**Vị trí:** `shared/src/engine.ts:747`, `:933`; phản hồi lệnh tại `:454`.

Probe: red unit ID 14 không có trong view của blue nhưng lệnh có targetId đó vẫn trả `ok:true` và tạo attack order. Engine lấy vị trí thật của entity để tiếp tục truy đuổi. ID tuần tự và phản hồi khác nhau còn tạo tín hiệu dò entity.

**Sửa:** dùng chung visibility predicate cho snapshot và explicit targeting; chỉ chấp nhận target đã thấy. Khi mất vision, chuyển tới last-known position theo luật đã định. Lệnh move đến tọa độ tùy chọn vẫn được phép, nhưng không tự bám tọa độ thật của mục tiêu ẩn. Test raw network commands và các trạng thái reveal→hidden→reveal.

### AK-04 — P1: Snapshot tiết lộ kinh tế/thống kê đối thủ

**Vị trí:** `shared/src/engine.ts:295`, `shared/src/network.ts:40`.

View lọc units/buildings nhưng vẫn serialize gold, income và toàn bộ stats của hai bên. Dữ liệu này cho phép suy ra phát triển kinh tế/quân đội ngoài vision. Việc gửi dữ liệu đã được xác nhận; xem đây là lỗi gameplay phụ thuộc quy tắc thông tin công khai.

**Đề xuất cho hướng cạnh tranh:** live observer DTO chỉ chứa dữ liệu được phép biết; full economy/stats mở sau trận. UI, replay và spectator phải dùng perspective rõ ràng, không chỉ ẩn text ở HUD.

### AK-05 — P1: Ranked admission cho phép chủ động chọn cặp và nhiều phòng

**Vị trí:** `server/src/index.ts:41`, `server/src/rooms/ArenaRoom.ts:49`, `:63`, `:227`.

Kiểm tra local bằng hai tài khoản test xác nhận: client gọi create public room rồi tài khoản thứ hai joinById; surrender sau countdown vẫn lưu trận và đổi Elo −16/+16. Một tài khoản cũng tạo được phòng thứ hai khi đang ở phòng đầu. Đây là điều kiện cho farm Elo, không phải bằng chứng người thật đã gian lận.

**Sửa:** server-owned ranked queue/ticket; tách policy ranked/private; một active match hoặc queue/user; hạn mức tạo phòng theo tài khoản/IP; TTL cho phòng chờ. Private invite không được tự biến thành ranked. Matchmaking dùng rating window nới theo thời gian; theo dõi cặp đấu lặp và kết quả quá ngắn để review, tránh auto-ban chỉ từ một tín hiệu.

Nghiệm thu: raw create/joinById không mở đường vòng vào ranked; user không chiếm nhiều seat; private trận không đổi Elo; reconnect giữ đúng match/side.

### AK-06 — P1: Hai panel Display Settings, phím O mở panel sai

**Vị trí:** `client/src/pages/battle.ts:38`, `client/src/game/BattleScene.ts:170`, `displaySettingsPanel.ts:50`.

Browser xác nhận hai `.display-settings-root`. Phím O mở panel ngoài `.battle` có callback rỗng, trong khi panel nối renderer vẫn đóng. Panel ngoài thiếu CSS variable `--s` của battle và hiện thêm nút Display ở góc trái mobile.

**Sửa:** một owner cho panel/state/hotkeys; renderer subscribe cùng state. Nghiệm thu O/click điều khiển cùng panel, settings áp dụng ngay và giữ đúng khi vào lại route; destroy không để listener/DOM sót.

### AK-07 — P1: Mỹ thuật MOBA không thể hiện rõ collision thật

**Vị trí:** `client/src/game/mobaMapArt.ts:369`, `:171`; `shared/src/island.ts:161`, `:183`.

MOBA vẽ neutral strip thành sông, nhưng phần đó vẫn walkable theo luật chung, trừ các vật cản. Năm mountain ridges đã tồn tại trong shared geometry; map MOBA không lấy danh sách này để vẽ cùng vị trí. Người chơi có thể gặp chỗ bị chặn mà khó nhận ra từ hình ảnh.

**Sửa:** terrain art sinh từ cùng geometry với navigation/build placement. Mỗi vùng phải phân biệt rõ đi được, bị chặn, xây được và không xây được. Nếu sông là shallow/walkable thì hình và legend phải diễn đạt điều đó. Test tọa độ tiêu biểu ở mọi skin, cả lệnh di chuyển và ghost xây dựng.

### AK-08 — P1: Replay recorder ghi liên tục sau khi kết thúc

**Vị trí:** `client/src/game/BattleScene.ts:210`, `battleRecap.ts:82`, `:84`.

Khi view có result, recorder bỏ giới hạn cadence và clone toàn bộ view mỗi frame. Probe gửi 300 lần cùng một final view ở thời điểm 0 ghi ra 300 frame giống nhau. Với cap 9.000, để lâu màn hình kết quả có thể cắt dần phần đầu replay và tạo GC churn.

**Sửa:** ghi final snapshot một lần rồi freeze; tách event stream khỏi snapshot cadence, dùng ring buffer và giới hạn byte/thời lượng. Test phần đầu/cuối trận được giữ, recorder không tăng sau end, mở/đóng recap không thay đổi kết quả. Event labels cũng cần bao phủ arrowShot/cannonShot, hiện switch label tại `battleRecap.ts:38` chưa xử lý hai loại đó.

### AK-09 — P1: QA gate đang fail và test chưa bao phủ các lỗi trên

**Vị trí:** `tools/check-documentary.mjs:23`, `client/src/game/displaySettings.ts:21`, `.github/workflows/qa.yml`, `package.json:22`.

`npm run qa` fail ở static check yêu cầu default Documentary, trong khi code chọn MOBA. Typecheck/build và 61 shared tests chạy riêng đều pass. Điều này cho thấy suite hiện tại chưa đủ coverage cho các lỗi semantics/protocol và online lifecycle.

**Sửa:** xác định default style chính thức, đồng bộ docs/test theo spec; chuyển các gate so chuỗi sang test hành vi nơi phù hợp. Giữ CI gate, thêm API/DB/Colyseus integration tests; không bỏ check hoặc continue-on-error để làm pipeline xanh.

### AK-10 — P2: Thời tiết quảng bá luật chưa được engine áp dụng

**Vị trí:** `shared/src/weather.ts:34`, `:45`; `client/src/game/BattleScene.ts:243`; movement `engine.ts:928`, vision `:336`.

Badge nói mưa làm chậm 20%, construction chậm 30%, fog giảm vision 35%; hiện modifier được tiêu thụ ở lớp hình ảnh, chưa tích hợp vào simulation. Construction hiện tức thời.

**Sửa trước mắt:** mô tả đúng là hiệu ứng môi trường. Tactical weather chỉ triển khai thành phase riêng: server/shared engine là nguồn luật, lịch chu kỳ công khai/seeded, báo trước cho hai bên, cân bằng và test AI/PvP parity. Với ranked, giữ ruleset ổn định và có thể tắt tactical weather theo mode.

### AK-11 — P1/P2: Mobile dọc khó điều khiển và HUD bị phủ

**Vị trí:** `client/src/styles.css:2616`, `:2679`, `:2686`; `game/visuals.ts:40`, `symbols.ts:32`.

Đã kiểm tra 390×844 và 360×800: battlefield fit toàn bộ chiều ngang nên unit rất nhỏ, có nhiều khoảng letterbox; HUD tài nguyên đè vùng timer/player/leave. Ở 360px, top-right HUD rộng 405.5px và bắt đầu x=−45.5; Display trong battle cao 26.6px, font khoảng 8.75px. Không có horizontal page scroll nhưng clipping/overlap vẫn xảy ra. Messenger ở 390px chỉ vượt mép khoảng 0.23px; không có bằng chứng cả nút bị mất.

**Sửa:** HUD theo breakpoint; giữ Leave, clock, supply và gold luôn nhìn thấy. Touch mode có tap-select nhóm, Move/Attack rõ ràng, hit-area theo screen pixels; nút chính tối thiểu 44px. Pan/pinch zoom triển khai cùng minimap/camera viewport; desktop dùng control groups và camera hotkeys. Có thể khuyến nghị landscape để chơi tốt hơn nhưng vẫn cần giao diện dọc sử dụng được.

### AK-12 — P1/P2: Matchmaking HTTP cần giới hạn đúng lớp

**Vị trí:** `server/src/index.ts:36`; dependency đã cài `node_modules/@colyseus/core/build/Server.js:192`, `:225`.

Colyseus intercept `/matchmake` trước Express và gom body trước JSON.parse. Vì vậy `express.json({limit:'32kb'})` không tự bảo vệ đường này. Chưa thực hiện tải request lớn/DoS; đây là rủi ro xác nhận qua code, còn mức phơi nhiễm phụ thuộc reverse proxy.

**Sửa:** body/rate/timeout caps trên HTTP path thực sự nhận matchmaking và ở edge; test request quá lớn bị từ chối trước tạo room/auth. WebSocket đã có default maxPayload 4KB; không coi WS là unbounded.

### AK-13 — P2: Kết quả AI tự khai và persistence chưa có recovery

**Vị trí:** `server/src/http/api.ts:252`, `db/users.ts:56`, `rooms/ArenaRoom.ts:239`.

AI chạy client rồi tự khai winner/duration/stats; hiện có validation/cooldown nhưng không chứng minh đã chơi/thắng. **AI không đổi Elo hiện tại**, tuy nhiên totals hồ sơ có gộp AI. Khi ghi PvP vào DB lỗi, room gửi matchId=null rồi hết TTL; không thấy durable retry/outbox.

**Sửa:** đánh dấu AI local là unverified, tách stats khỏi competitive achievements/rewards. Trusted AI result cần server simulation hoặc verification thật; start ticket đơn lẻ không đủ. PvP dùng stable match ID từ đầu, idempotent persistence, pending-result/outbox và retry có giới hạn. Test database busy/disk failure/restart và không ghi Elo hai lần.

### AK-14 — P2: Auth, kiến trúc tick và documentation cần chuẩn hóa

- `client/src/lib/session.ts:25`, `:35`: bearer token lưu localStorage, TTL mặc định 30 ngày ở `server/src/config.ts:16`. Chưa tìm thấy khai thác XSS; rủi ro là XSS tương lai có thể lấy token lâu dài. Đánh giá một phase auth riêng: HttpOnly cookie same-origin kèm CSRF phù hợp hoặc bearer ngắn hạn trong memory; rotation/revocation và disconnect room khi session bị thu hồi. Không thay auth âm thầm trong một PR UI.
- `shared/src/militia.ts:231`: monkey-patch prototype/lifecycle theo outer update làm khó hiểu state và parity tick. Tích hợp lifecycle vào fixed tick, tách controllable army/all units; serialize được Militia/Royal Guard khi làm replay hoặc recovery.
- `client/src/pages/guide.ts:55`: guide ghi 2 village/4 soldier; thực tế start 3 village/3 soldier. Sinh guide/hints từ rules, cập nhật Fence/Scout/Cannon/formation/upkeep; đồng bộ v0.2/v0.7 và các docs về núi/default style.
- Modal trong `GameController.ts:552`, `:726` cần accessible name, focus trap/restore và inert nền. Patch text/progress thay vì dựng lại các nút recruit mỗi lần queue đổi.

## 4. Dependency và giới hạn kết luận bảo mật

Audit tại ngày đánh giá:

| Phạm vi | Low | Moderate | High | Critical | Tổng |
| --- | ---: | ---: | ---: | ---: | ---: |
| `npm audit` toàn bộ dependency | 2 | 10 | 2 | 3 | 17 |
| `npm audit --omit=dev` | 2 | 10 | 1 | 1 | 14 |

Đây là số package entries bị đánh dấu, có cả chuỗi dependency; không phải 17 lỗ hổng độc lập đã chứng minh khai thác trên game.

`proxy-addr` có advisory critical và bản vá 2.0.8. Điều kiện advisory liên quan trust subnet IPv4-mapped IPv6 cấu hình sai; app hiện dùng `trust proxy='loopback'`, nên **chưa chứng minh cấu hình này bị exploit**. Nguồn: [GitHub advisory GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h).

`shell-quote`/`concurrently` thuộc dev tooling, có critical advisory; cần update lockfile sau đánh giá tương thích, không suy ra browser/server production có command injection. Nguồn: [GitHub advisory GHSA-pqg4-j6r4-53mv](https://github.com/advisories/GHSA-pqg4-j6r4-53mv).

Colyseus/nanoid và các transitive dependency khác cần kế hoạch patch hoặc migration được test. Không chạy `npm audit fix --force` tự động. Gỡ dependency/plugin không dùng chỉ sau khi kiểm tra import/runtime; version mục tiêu phải xác minh lại lúc implementation.

Nền tảng bảo mật đang có cần giữ: scrypt với salt ngẫu nhiên/timing-safe comparison; token ngẫu nhiên lưu hash trong SQLite; SQL parameter binding; Elo transaction; WAL/FK; server kiểm tra ownership/resource/queue; auth và command rate limit.

Chưa kiểm tra deployment thực tế: TLS/WSS, CSP/frame protections, cache/compression, real IP, backup/restore và CORS policy. Không kết luận production đang thiếu những lớp đó chỉ vì repo không có cấu hình. Cấu hình cross-origin cần allowlist nhất quán REST/matchmaking/WS; hiện auth bearer nên không kết luận classic cookie CSRF.

## 5. Lộ trình nâng cấp đề xuất

### Đợt 1 — Correctness và online công bằng

Phạm vi: AK-01 đến AK-09, ranked admission AK-05, HTTP caps AK-12; ghi rõ weather hiện là cosmetic.

- Chốt protocol version và public-information policy trước khi sửa DTO.
- Sửa formation damage và fog targeting; bảo đảm local/online cùng luật.
- Tạo server-owned ranked queue và active-match lease; private invitation riêng.
- Sửa settings/recorder, map collision readability và QA baseline.
- Thêm regression/integration tests; release đầu nhỏ và có rollback code/protocol.

**Nghiệm thu:** QA xanh; matrix wire round-trip xanh; không target enemy ẩn; private không Elo; đường raw create/joinById không vượt policy ranked; reconnect một side đúng quyền; duplicate result không đổi Elo lần hai. Client cũ nhận thông báo version thay vì hiển thị dữ liệu sai.

### Đợt 2 — Trải nghiệm competitive hoàn chỉnh

- Matchmaking theo Elo và thời gian chờ; region/latency khi thực sự có nhiều server. Hiển thị queue state, ping và reconnect countdown.
- Reconnect test ở countdown/playing/ended; xử lý duplicate tab, expired token, mất mạng, reload và server restart theo chính sách rõ ràng.
- HUD responsive, hotkey help/remap, control groups, Shift queue orders, Attack/Move/Stop/Hold rõ; mobile touch mode, zoom/pan/minimap.
- Tutorial AI 3–5 phút theo nhiệm vụ: chọn quân → xây → tuyển → supply/upkeep → tấn công → rút lui. Guide và tutorial lấy rules thật.
- Stable match IDs, result outbox/recovery và màn báo save status rõ ràng.
- Dictionary VI/EN, audio feedback ngắn sau user gesture, mute/volume. Visual ping/alert vẫn đủ dùng khi tắt âm.

**Nghiệm thu:** người mới hoàn thành tutorial và tự vào trận; các controls chính luôn thấy/chạm được ở 1440/1366/390/360; keyboard focus không bị mất khi queue đổi; reconnect không tạo thêm match hoặc nhân kết quả.

### Đợt 3 — Cân bằng, AI và replay đáng tin

- RNG seed thuộc match state; log command/tick + ruleset/protocol version, checkpoint serialize đầy đủ.
- AI dùng visible/last-known information, Scout, counter composition, sức mạnh theo HP/DPS/role; Cannon có hộ tống, formation theo nhiệm vụ và Fall Back khi rút lui. Difficulty khác nhau ở phản ứng/chiến thuật, giữ kinh tế và luật công bằng.
- Balance lab seeded với mixed army, siege, rush/economy/defence, terrain choke và mirror sides; xuất JSON gồm win rate, duration, castle destruction, resource idle, army losses.
- Replay giữ nguyên perspective người chơi; lưu server, xem từ history, export/share sau trận. Spectator live chỉ thêm sau khi có policy delay và fog tránh stream-sniping.
- Điều tra stalemate trước khi thay timeout. Sau khi có dữ liệu, thử một mục tiêu trung lập hoặc điểm kiểm soát để khuyến khích di chuyển; không đồng thời thêm nhiều tài nguyên/faction.

**Nghiệm thu:** cùng seed+commands cho cùng kết quả/state hash; replay online khớp kết quả lưu DB; thay bot/formation có số liệu nhiều seed; ruleset mới không áp giữa một trận đang chạy. AI local unverified không cấp competitive rewards.

### Đợt 4 — Mỹ thuật, hiệu năng và vận hành

- Triển khai [kế hoạch đồ họa MOBA fantasy](GRAPHICS_MOBA_UPGRADE.vi.md): terrain vẽ tay có chiều sâu, sprite quân/công trình, HUD fantasy, fog và VFX rõ; đồng bộ lobby, battle và recap. Terrain/HUD có thể làm sau correctness trong đợt 1, còn sprite/VFX triển khai theo từng gói được profile.
- Một design system nhỏ: màu đội/selection, typography, entity silhouettes, icon/legend, state disabled/error/loading. Màu tối xanh đen và viền kim loại thống nhất; không che khuất gameplay bằng trang trí.
- Quality Low/Medium/High; toggle nature/weather riêng. Reduced motion phủ bob/rotation/spawn overshoot/fog drift; cache layer tĩnh và giảm cadence trang trí khi profiling chứng minh cần.
- Đo p95 frame time, GC/heap, simulation tick, bytes/s và match concurrency. Fog hiện clear/stamp RenderTexture mỗi frame, rừng/sóng cũng redraw; profiling quyết định dùng atlas/caching/batching.
- Tối ưu PNG Cannon khoảng 909.68kB và icon inline khi có lợi đo được; budget riêng cho initial route, battle route và asset nhị phân, không chỉ tổng JS/CSS/HTML.
- PM2 fork instance ban đầu, HTTPS/WSS qua reverse proxy, graceful drain rooms, health/readiness, structured logs không token và alert lỗi tick/save.
- SQLite WAL tiếp tục dùng khi tải cho phép; backup nhất quán bằng SQLite backup/VACUUM INTO, retention và restore drill. Không copy riêng file `.db` đang ghi WAL. Đo DatabaseSync/event-loop lag trước khi quyết định worker/cache/database khác.
- Chỉ thêm Redis/shared presence/đa process khi load test chứng minh cần. PM2 cluster không thể tự giải quyết room/user lease hoặc migration coordination. PostgreSQL là bước theo workload, không phải điều kiện tiên quyết.
- Sau nền tảng ổn: hai map đối xứng đã test, mùa ranked/provisional rating, profile ranked tách AI, cosmetic banners. Progression không tăng sức mạnh trong ranked.

**Mục tiêu đề xuất, chưa phải số đo đạt được:** desktop tham chiếu p95 frame ≤16.7ms; thiết bị yếu Low preset p95 ≤33.3ms; server tick p95 thấp hơn ngân sách 50ms với số room mục tiêu được chọn trước load test. Không cam kết 60FPS mọi thiết bị. Giảm initial payload so với baseline; heap không tăng liên tục khi đứng ở màn kết quả hoặc vào/ra trận nhiều lần.

## 6. Kết quả kiểm tra đã thực hiện

Môi trường: Windows, Node v24.16.0, npm 11.13.0. Không có Prisma; không dùng quy trình Next.js/Mushroomie cho repo này.

| Kiểm tra | Kết quả |
| --- | --- |
| Git clone/status | Clone thành công; source sạch trước khi thêm báo cáo |
| `npm ci` | Pass; dependency audit có findings như mục 4 |
| `npm run typecheck --if-present` | Pass shared/client/server |
| `npm test` | **61/61 pass**, 0 fail |
| `npm run build` | Pass shared/client/server |
| `npm run qa` | **Fail ở qa:static**: documentary default style; không chạy hết chain |
| `npm run check:bundle` | Pass: JS/CSS/HTML **1675.3KiB**, budget 4096KiB; không tính PNG |
| `npm run simulate:balance -- 4` | Pass invariant; **24 trận**, 308.7 giây chạy lab |
| HTTP GET local | `/`, `/play`, `/battle`, `/guide`, `/login`, `/register`, `/profile`, `/history`, `/leaderboard`: 200 app shell; `/health`, `/api/overview`: 200 JSON |
| CSS/JS/PNG local | Tất cả 2 CSS, 2 JS, 1 PNG trong build: HEAD 200; CSS text/css, JS text/javascript, PNG image/png |
| HEAD local page routes | **404** vì SPA fallback chỉ nhận GET (`server/src/index.ts:30`); cần hỗ trợ HEAD cho route checks/monitor |
| Browser | Kiểm tra battle ở 1440×900, 1366×768, 390×844, 360×800; AI chơi/render được, không thấy console error trong lượt kiểm tra; lỗi mobile/settings như trên |
| Battle Recap | Mở được timeline/speed sau surrender trong trận AI guest; recorder probe xác nhận duplicate final frames |
| Online smoke local | Hai account test; auth sai bị 401; nhận snapshot v5; surrender lưu match và Elo; xác nhận đường public create+joinById và nhiều room/account |

HTTP 200 ở protected SPA routes chỉ chứng minh app shell tải được, không thay thế kiểm thử auth và page behavior. Chưa có complete E2E suite cho register/login/profile/history/private/reconnect và chưa load test mạng lag/packet loss/server concurrency. Không đo PageSpeed hoặc p95 FPS. Không kiểm tra hay sửa deployment/GitHub Actions run từ xa.

Build baseline: initial JS 338.58kB (gzip 138.27kB), battle JS 1316.00kB (gzip 365.70kB), initial CSS 57.63kB, Cannon PNG 909.68kB. Đây là output build, chưa bao gồm phân tích transfer cache và parse/render trên thiết bị thật.

Balance lab (4 trận/cặp, có đảo side):

| Cặp | Thắng của chiến thuật đầu | Hòa | Thời lượng trung bình |
| --- | ---: | ---: | ---: |
| rush vs economy | 0/4 | 1 | 20.00 phút |
| rush vs defensive | 2/4 | 2 | 20.00 phút |
| rush vs balanced | 0/4 | 2 | 20.00 phút |
| economy vs defensive | 2/4 | 2 | 20.00 phút |
| economy vs balanced | 2/4 | 2 | 20.00 phút |
| defensive vs balanced | 0/4 | 0 | 20.00 phút |

Tất cả cặp đều có average 20 phút, là tín hiệu về khả năng stalemate/khả năng kết thúc của controller. Lab chủ yếu train Soldier (`shared/scripts/balance.ts:146`), RNG chưa seed và formation đang lỗi; mẫu này **không đủ kết luận quân hay chiến thuật nào cân bằng**. Lab còn hardcode ngưỡng vàng 20 trong khi Soldier giá 18.

## 7. Trạng thái bàn giao và cách chạy

- Source và lockfile giữ nguyên commit gốc. Các tài liệu thêm mới là báo cáo này và `docs/GRAPHICS_MOBA_UPGRADE.vi.md`, cùng ảnh `docs/concepts/moba-graphics-concept.png`; concept chỉ minh họa đề xuất, chưa phải asset/runtime đã tích hợp.
- Screenshots nằm ngoài repo tại `D:\Summer Train\Arena-Kingdom-review`: `battle-desktop-1440.png`, `battle-mobile-390.png`, `battle-mobile-360.png`, `display-O-duplicate.png`, `recap-desktop.png`, `home-desktop-1440.png`.
- Test server dùng riêng `database/audit-local-20261011.db` với hai account và một trận test; DB được gitignore, không dùng dữ liệu production. Không xóa DB/test accounts.
- Chưa commit, push, tạo PR hoặc deploy. Chưa apply bất kỳ nâng cấp nào nêu trên.

Đã cài dependency và build. Chạy từ PowerShell:

```powershell
Set-Location -LiteralPath 'D:\Summer Train\Arena-Kingdom'
npm start
```

Mở http://localhost:2567. Hoặc dùng `npm run dev` và http://localhost:5173 khi phát triển.

Implementation đầu tiên nên là một PR nhỏ **protocol + formation + regression tests**, tiếp theo **fog policy + ranked admission + integration tests**. Thay auth/schema/production migration cần kế hoạch riêng, backup và rollback theo dữ liệu thực tế.
