# KẾ HOẠCH NÂNG CẤP ĐỒ HỌA & MÔI TRƯỜNG CHIẾN THUẬT: ARENA KINGDOM
## *"The Living Medieval War Map"* — Bản Đồ Sa Bàn Quân Sự Cổ Sống Động

---

## 1. TỔNG QUAN TẦM NHÌN (VISION & ART DIRECTION)

Mục tiêu là biến chiến trường của **Arena Kingdom** từ một bản đồ 2D phẳng thành một **Sa bàn chiến sự cổ sống động (Living Historical War Room)**, lấy cảm hứng từ các video tái hiện trận đánh lịch sử đỉnh cao (*Kings and Generals, BazBattles, Epic History TV, SandRhoman History*), kết hợp hoàn hảo giữa 4 trụ cột:

1. **Medieval Military Cartography (Nghệ thuật bản đồ quân sự Trung Cổ)**: Mặt giấy da dê cổ (vellum/parchment), vết ố mực loang màu nước, nét khắc đồng hachures, la bàn hoa gió chạm khắc tinh xảo, thước đo dặm cổ điển và các đường hải trình (portolan lines).
2. **Historical Tactical Counters (Ký hiệu quân sự sa bàn 2D)**: Thẻ quân bài sa bàn bằng gỗ/da mang tính biểu tượng (NATO kết hợp huy hiệu kỵ sĩ), mũi tên hành quân uốn lượn phong cách chiến dịch lịch sử, vạch chỉ số quân số thực tế (strength pips).
3. **Living Dynamic Map (Thiên nhiên sống động)**: Sóng biển vỗ bờ bọt trắng nhịp nhàng, mặt nước động theo luồng hải lưu, những cánh rừng bạt ngàn với tán lá rì rào đung đưa trước gió, dãy núi đá hiểm trở chia cắt chiến trường.
4. **Dynamic Weather & Campaign Challenges (Thời tiết & Thử thách vận mệnh quốc gia)**: Sương mù che giấu động thái, mưa bão sa lầy hành quân và cản trở xây dựng, gió bão ảnh hưởng đường tên bắn.

```
+-----------------------------------------------------------------------------------+
|                            LIVING WAR MAP ARCHITECTURE                            |
+-----------------------------------------------------------------------------------+
|  [HUD & Orders]      Thước đo tỷ lệ, con dấu sáp, đồng hồ chiến sự, lệnh hành quân  |
|  [Weather FX]        Màn mưa xiên, sương mù dày, luồng gió lốc, chớp lóe, lá bay     |
|  [Tactical Layer]    Khối Counter sa bàn 2D, Mũi tên chiến dịch Bezier, Tiền tuyến   |
|  [Living Nature]     Rừng cây đung đưa theo gió, Sóng biển dập dềnh bọt trắng       |
|  [Obstacle Terrain]  Dãy núi đá hachure (Impassable Ridges) -> Tạo Hẻm Núi Đèo Cửa  |
|  [Base Cartography]  Giấy da dê cổ (Vellum), Nếp gấp hành quân, Hoa gió, Bờ biển SVG |
+-----------------------------------------------------------------------------------+
```

---

## 2. NỘI DUNG NÂNG CẤP CHI TIẾT THEO TỪNG HẠNG MỤC

### A. Bản Đồ Quân Sự Cổ & Phong Cách Phim Tài Liệu Lịch Sử

* **Nền bản đồ Giấy da dê vellum thượng hạng**:
  * Tăng cường độ sâu texture với các nếp gấp bản đồ hành quân 4 góc (quarter folds), vết ố mực trà/màu nước khô ở viền mép, hạt giấy sần (organic grain).
  * Hiệu ứng ám sáng viền (vignette) và đổi tone màu theo thời gian trong trận đánh (từ sáng sớm đến chiều tà).
* **Trang trí bản đồ tài liệu (Cartographic Ornaments)**:
  * **La bàn hoa gió (Compass Rose)**: Nâng cấp hình khắc chi tiết với 16 hướng gió, vòng hoa văn Gothic trung cổ, mũi tên chỉ Bắc trang trí hoa bách hợp (Fleur-de-lis).
  * **Hộp tiêu đề bản đồ cổ (Calligraphic Cartouche)**: Khung viền chạm khắc kiểu thế kỷ 16 đặt ở góc: *"ARENA ISLAND - THE WAR OF SUCCESSION - MAP SHEET I"*.
  * **Thước đo tỉ lệ (Scale & Distance)**: Thước chia vạch khắc họa đơn vị "Leagues" hoặc "Paces", vạch kinh vĩ độ chữ nhật bao quanh neatline chuẩn phong cách quân sự.

---

### B. Ký Hiệu Quân Sự 2D (Tactical Military Counters) & Mũi Tên Sa Bàn

* **Khối thẻ bài sa bàn (Historical Battalion Counters)**:
  * Thay thế các icon đơn lẻ bằng **khối quân bài sa bàn** (như những quân cờ gỗ/da đặt trên bàn tác chiến sa bàn của các vị tướng):
    * **Bộ binh (Soldier)**: Khối chữ nhật viền mực với ký hiệu chữ **X** (biểu tượng bộ binh tiêu chuẩn lịch sử) + khiên hiệp sĩ.
    * **Cung thủ (Archer)**: Khối sa bàn với biểu tượng cánh cung căng dây và mũi tên nhọn.
    * **Kỵ binh (Knight)**: Khối sa bàn với vạch chéo đơn **/** (ký hiệu kỵ binh cổ điển) + biểu tượng móng ngựa/đầu tuấn mã.
    * **Dân quân (Militia)**: Khiên gỗ tròn đơn sơ với hai ngọn giáo chéo nhau.
    * **Vệ binh (Royal Guard)**: Khối sa bàn mạ vàng với chữ thập Templar và vương miện.
    * **Pháo binh (Cannon)**: Khối sa bàn với nòng pháo đúc đồng và chấm tròn pháo kích.
* **Hệ thống hiển thị sĩ khí & quân số (Strength Pips)**:
  * Thay vì thanh máu màu mè kiểu game arcade hiện đại làm mất chất lịch sử, sử dụng **vạch nấc quân số (strength pips/segments)** in chìm bên dưới khối quân (ví dụ: 4 vạch tượng trưng cho 4 phân đội; thương vong sẽ làm tắt dần các vạch).
* **Mũi tên chiến dịch lịch sử (Documentary Tactical Arrows)**:
  * Nâng cấp `commandArrows.ts`:
    * Mũi tên tiến công có thân dày, cong mềm theo đường cong Bezier, kẻ sọc chéo hoặc vạch đứt đoạn (chevron patterns) chỉ hướng tiến quân.
    * Khi tấn công mục tiêu: mũi tên có hình dáng ngọn giáo nhọn cắm thẳng vào vị trí địch.
    * Mũi tên rút lui (Fallback): mũi tên đứt đoạn màu sepia uốn ngược về sau.
* **Tiền tuyến chiến sự sống động (Frontline of Engagement)**:
  * Vạch răng cưa ranh giới giữa hai vương quốc khi chạm trán sẽ bốc các cụm khói mờ hoặc đốm lửa than li ti, thể hiện nơi chiến sự đang diễn ra ác liệt.

---

### C. Môi Trường Sống Động (Living Dynamic Nature)

#### 1. Sóng biển đánh bờ & Nước biển dao động (Ocean Dynamics)
* **Sóng bọt vỗ bờ (Shoreline Wave Foam)**:
  * Khai thác trực tiếp tọa độ pháp tuyến `coastSamples` từ `island.ts`.
  * Sinh ra 2-3 dải bọt sóng trắng chạy dọc theo mép bờ biển, nhấp nhô theo hàm sóng điều hòa:
    $$\text{offset}(s, t) = A \cdot \sin(\omega t + k \cdot s) + B \cdot \cos(2\omega t - k \cdot s)$$
  * Sóng dâng lên dạt vào mép cát vàng/bãi đá rồi tan biến để lại một dải bọt mỏng co giãn nhẹ nhàng.
* **Mặt nước biển cổ (Stylized Inked Waves)**:
  * Mặt biển ngoài khơi không để màu phẳng đơn điệu, mà được phủ các đường nét gợn sóng lượn nhỏ (woodcut water hatching) trôi nhẹ theo dòng hải lưu, tạo cảm giác biển đang thở.

#### 2. Rừng cây rì rào trước gió (Wind-Swaying Canopy)
* **Cụm rừng vẽ tay (Hand-inked Forest Groves)**:
  * Thay thế pattern cây SVG tĩnh bằng các cụm rừng nhiều lớp (Canopy Clusters):
    * Lớp bóng râm bên dưới (drop shadow trên nền đất).
    * Lớp thân cây và tán lá đan xen với màu xanh rêu, xanh ô-liu cổ điển.
* **Animation đung đưa theo gió (Procedural Wind Sway)**:
  * Mỗi cụm cây dao động nhẹ nhàng dựa theo vector gió toàn cục (Global Wind Vector). Tán cây trên ngọn lắc lư nhiều hơn phần gốc.
  * Hiệu ứng hạt lá bay (Leaf Drift Particles): Thi thoảng có vài chiếc lá khô bị gió cuốn bay là là qua các hàng quân.
* **Tương tác quân sự (Troop Concealment & Rustle)**:
  * Khi quân lính di chuyển xuyên qua khu rừng, tán cây rung lắc mạnh hơn kèm hiệu ứng chim bay vụt lên khỏi ngọn cây, cảnh báo người chơi về việc có phục kích trong rừng!

#### 3. Dãy núi dày làm chướng ngại vật hành quân (Tactical Mountain Ridges & Passes)
* **Hình tượng núi khắc họa cổ (Hachure Ridges)**:
  * Dựng các dãy núi đá hùng vĩ phong cách bản đồ thế kỷ 17-18: các đỉnh nhọn sắc nét, sườn núi phủ nét gạch bóng (hachures) tạo chiều sâu 3D trên mặt giấy 2D phẳng.
* **Tác động trực tiếp vào cơ chế di chuyển (Impassable Terrain & Chokepoints)**:
  * Đưa hình học các dãy núi vào `isWalkableLand` và `NavGrid` trong `navigation.ts`. Quân lính và kỵ binh **hoàn toàn không thể băng qua núi**.
  * Bố trí các dãy núi tạo thành **3 nút thắt chiến lược (Strategic Passes)**:
    1. **Hẻm Núi Trung Tâm (The Central Defile)**: Con đường ngắn nhất giữa 2 vương quốc nhưng hẹp, nơi các trận đánh đẫm máu kiểu *Thermopylae* diễn ra.
    2. **Đường Vòng Ven Biển (The Coastal Route)**: Rộng rãi hơn nhưng xa xôi, dễ bị pháo đài ven biển chặn đường.
    3. **Thung Lũng Rừng Rậm (The Forest Pass)**: Đường mòn bí mật xuyên rừng chân núi, nơi kỵ binh và trinh sát có thể luồn lách đột kích căn cứ địch.
  * **Cấm xây công trình trên vách đá**: Người chơi không thể cắm trại/tháp trên đỉnh núi, nhưng có thể dựng Tháp canh (Tower) và Hàng rào (Fence) ngay tại cửa ải để phong tỏa toàn bộ đường tiến quân của địch!

---

### D. Hệ Thống Thời Tiết Động & Thử Thách Xây Dựng / Chiến Lược

Thời tiết sẽ chuyển dịch theo chu kỳ hoặc ngẫu nhiên giữa các giai đoạn của trận đấu, đem lại cả trải nghiệm thị giác lẫn biến số chiến lược cân não:

| Hình thái thời tiết | Hiệu ứng thị giác (Visuals) | Ảnh hưởng Quân sự (Military Impact) | Ảnh hưởng Xây dựng & Kinh tế (Civil Impact) |
| :--- | :--- | :--- | :--- |
| **1. Quang đãng** *(Fair Weather)* | Nắng vàng dịu, bóng cây sắc nét, giấy da sáng ráo. | Tầm nhìn chuẩn (100%), tốc độ chuẩn, cung tên bay thẳng. | Nông dân làng mạc hoạt động tối đa (+10% tốc độ thu vàng). |
| **2. Mưa giông & Bão táp** *(Driving Rainstorm)* | Màn mưa xiên mờ ảo, vệt nước đọng loang lổ, chớp sáng lóe chân trời, mặt đất ngả màu bùn lầy. | **Bùn lầy (Mud)**: Toàn quân giảm 25% tốc độ di chuyển.<br>**Dây cung ướt**: Cung thủ & Pháo binh giảm 20% tầm bắn và độ chuẩn xác. | **Đình trệ thi công**: Thời gian xây công trình kéo dài thêm 30%. Sức bền hàng rào gỗ bị thử thách. |
| **3. Sương mù dày đặc** *(Heavy Rolling Fog)* | Dải mây mù xám trắng cuộn trôi sát mặt đất, che phủ địa hình và chiến trường. | **Mất dấu vết (Ambush Opportunity)**: Tầm nhìn Fog of War của toàn bộ quân lính và công trình giảm 40%. Tháp canh mất lợi thế bắn tỉa từ xa. | Quân trinh sát (Scout) trở thành đơn vị sống còn để mở đường và dò tìm kẻ địch. |
| **4. Gió lốc / Gió ngược** *(Gale Force Winds)* | Tán rừng rung lắc mạnh, bụi đất và lá bay cuốn theo chiều gió, sóng biển gầm vang dồn dập. | Đơn vị di chuyển **xuôi chiều gió được tăng 15% tốc độ**, **ngược chiều gió bị giảm 15%**. Tên bắn ngược gió bị rơi ngắn hơn. | Công trình đang xây dựng tốn nhiều tài nguyên giằng chống hơn. |

---

## 3. LỘ TRÌNH TRIỂN KHAI THEO TỪNG GIAI ĐOẠN (IMPLEMENTATION ROADMAP)

### 📍 Giai đoạn 1: Chuẩn hóa Mỹ thuật & Kiến trúc Pipeline Phaser 3
* **Mục tiêu**: Thiết lập nền tảng kỹ thuật và phân tầng hiển thị (Depth Layers) vững chắc.
* **Công việc cụ thể**:
  * Chuẩn hóa bảng màu Documentary / Vintage Parchment: chuyển đổi từ 1 texture phẳng thành hệ thống đa tầng trong `visuals.ts`:
    * `BATTLE_DEPTH.water_base` (0)
    * `BATTLE_DEPTH.water_waves` (5)
    * `BATTLE_DEPTH.parchment_land` (10)
    * `BATTLE_DEPTH.mountains` (15)
    * `BATTLE_DEPTH.forests` (18)
    * `BATTLE_DEPTH.frontline_influence` (20-30)
    * `BATTLE_DEPTH.entities_counters` (60)
    * `BATTLE_DEPTH.weather_particles` (1650)
  * Thiết lập custom Phaser WebGL Pipeline cơ bản để hỗ trợ các hiệu ứng đổ bóng mực và gợn sóng.

### 📍 Giai đoạn 2: Dãy Núi Đá Chướng Ngại Vật & Bản Đồ Cửa Đèo (Mountain Defiles)
* **Mục tiêu**: Biến núi thành vật cản vật lý và mỹ thuật sa bàn thực thụ.
* **Công việc cụ thể**:
  * **Mỹ thuật**: Vẽ bộ sprite/SVG vách núi hachure đổ bóng trung cổ (vừa khớp với phong cách mực in).
  * **Hạ tầng thuật toán**:
    * Mở rộng `shared/src/island.ts` với hàm `isMountainObstacle(x, y)`.
    * Cập nhật `isWalkableLand(x, y)`: một điểm chỉ đi được khi nằm trên đảo VÀ không nằm trong khối núi.
    * Cập nhật `shared/src/navigation.ts` để `NavGrid` tự động ghi nhận các ô núi đá là chướng ngại vật cứng (`this.terrain[i] = 1`).
    * Cập nhật `canPlaceBuilding`: cấm xây dựng trên núi hoặc trong lòng hẻm núi quá hẹp để tránh kẹt đường quân.

### 📍 Giai đoạn 3: Thiên Nhiên Sống Động — Sóng Biển & Rừng Cây Rì Rào
* **Mục tiêu**: Mang lại hơi thở thiên nhiên sống động trên nền bản đồ cổ.
* **Công việc cụ thể**:
  * **Sóng biển vỗ bờ**: Tạo class `ShorelineWaveRenderer.ts` trong `client/src/game/`.
    * Duyệt qua danh sách `coastSamples` lấy từ `island.ts`.
    * Dùng `Phaser.GameObjects.Graphics` hoặc Custom Mesh vẽ đường sóng bọt vỗ bờ co giãn mềm mại theo thời gian (`update(delta)`).
  * **Rừng cây đung đưa**: Tạo component `ForestGroveManager.ts`:
    * Chia các cánh rừng thành các cụm cây (Clusters) có tọa độ gốc.
    * Sử dụng biến dạng hình học nhẹ (sinusoidal sway offset) theo tần số gió: `offset = Math.sin(time * 0.002 + x * 0.01) * 3`.
    * Thêm particle emitter sinh lá rơi lất phất cuốn theo chiều gió.

### 📍 Giai đoạn 4: Bộ Ký Hiệu Quân Sự Sa Bàn 2D & Mũi Tên Tác Chiến
* **Mục tiêu**: Tái hiện cảm giác bàn chỉ huy quân sự (War Room Table) đỉnh cao.
* **Công việc cụ thể**:
  * Cải tiến `symbols.ts`:
    * Thiết kế lại toàn bộ 7 loại quân và 5 công trình theo dạng **Thẻ bài sa bàn (Tactical Counters)**: khối gỗ có gờ nổi, khắc chìm biểu tượng binh chủng, hiển thị phù hiệu xanh/đỏ trang nhã.
    * Thay thế thanh máu HP trơn bằng các **Vạch quân số (Strength Pips)**.
  * Cải tiến `commandArrows.ts`:
    * Tăng bề dày nét vẽ mũi tên chỉ huy, thêm sọc chevron tác chiến kiểu phim tài liệu lịch sử.
    * Hiệu ứng mờ dần (ink fade) khi lệnh đã hoàn tất.

### 📍 Giai đoạn 5: Hệ Thống Thời Tiết & Thử Thách Chiến Lược
* **Mục tiêu**: Đưa thời tiết từ hiệu ứng hình ảnh thành yếu tố chiến thuật sâu sắc.
* **Công việc cụ thể**:
  * **Shared Engine (`shared/src/rules.ts` & `engine.ts`)**:
    * Định nghĩa `WeatherState: 'fair' | 'rain' | 'fog' | 'gale'`.
    * Tích hợp các hệ số biến thiên (weather modifiers) vào tính toán tốc độ di chuyển của đơn vị, thời gian đào tạo/xây dựng, tầm nhìn của Fog of War, và độ phân tán sát thương cung thủ.
  * **Client Visuals (`client/src/game/weatherOverlay.ts`)**:
    * Bộ phát hạt mưa rơi nghiêng theo góc gió (`Phaser.GameObjects.Particles`).
    * Lớp sương mù trôi bồng bềnh sử dụng `RenderTexture` với chế độ hòa trộn mềm (soft blend).
    * Bộ lọc màu Post-FX nhẹ (mưa: tone trầm lạnh, nắng: tone vàng ấm parchment).
    * Hiệu ứng âm thanh môi trường nền (sóng biển vỗ về, gió rít nhẹ, mưa lộp độp) nếu tích hợp audio.

### 📍 Giai đoạn 6: Tối Ưu Hiệu Năng & Khả Năng Tùy Chỉnh (Performance & Accessibility)
* **Mục tiêu**: Đảm bảo game luôn chạy mượt mà 60 FPS trên mọi thiết bị và trình duyệt.
* **Công việc cụ thể**:
  * Tích hợp vào `DisplaySettingsPanel.ts` các tùy chọn:
    * `Dynamic Nature (Waves & Wind)`: Bật/Tắt hiệu ứng động để giảm tải cho máy yếu.
    * `Weather Effects`: Bật/Tắt hiệu ứng hạt mưa và sương mù.
    * `Graphic Quality`: High (Shader/Mesh) / Medium (Procedural Canvas) / Low (Static Vintage).
  * Gom nhóm các lệnh vẽ sóng và lá rơi vào chung Batch Draw Call để giữ FPS luôn ở mức 60.

---

## 4. KẾT QUẢ ĐẦU RA KỲ VỌNG (EXPECTED OUTCOME)

Khi hoàn thành kế hoạch này:
1. Người chơi mở trận đấu sẽ lập tức có cảm giác như đang đứng trước **bàn tác chiến sa bàn của một vị hoàng đế trung cổ**, theo dõi tường thuật sống động từng chiến dịch như trên kênh *Kings and Generals*.
2. Bản đồ không còn là một hình vẽ phẳng vô hồn: **biển thở qua từng đợt sóng vỗ bờ, rừng cây đung đưa xào xạc theo luồng gió, núi non hiểm trở ép quân đội vào những hẻm núi sinh tử**.
3. **Mỗi trận đấu sẽ mang một màu sắc mới nhờ thời tiết**: Một trận đánh trong sương mù mở ra cơ hội tập kích bất ngờ, trong khi một trận bão tuyết hay mưa giông thử thách khả năng quản lý hậu cần và giữ vững thành trì.
