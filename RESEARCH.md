# 戰鬥陀螺構造與物理模型

核對日期：2026-09-10。用途：專題實作的模型觀察與參數實驗。產品構造依官方資料核對；尺寸與係數為本教材的設計值。

## 戰鬥陀螺是什麼

戰鬥陀螺是由發射器賦予自轉、在場地中互相碰撞的可組裝陀螺。BEYBLADE X 的基本結構包含 Blade、Ratchet、Bit。刀刃的形狀與重量影響撞擊，棘輪設定高度，軸尖影響移動。部分系列的刀刃可再細分。X Dash 來自軸尖齒輪與場地齒軌的接合。

- [TAKARA TOMY — Gear Structure](https://beyblade.takaratomy.co.jp/gear/)：核對基本三層功能、外圈配重與系列差異。
- [TAKARA TOMY — BEYBLADE](https://www.takaratomy.co.jp/english/products/brand/beyblade.html)：核對 X Dash 的定位。
- [Hasbro — Beyblade X 官方說明](https://instructions.hasbro.com/en-us/instruction/beyblade-x-x-treme-battlers-pack-3-takara-tomy-tops)：核對齒輪與齒軌接合的加速機構。

三維模型是上述結構的原創教學設計，使用自製旋翼徽章。觀察重點是金屬外環、倒角刀翼、樹脂嵌片、中心蓋、固定件、棘輪凸耳與軸尖齒部。

## 物理依據

### 轉動慣量與自轉能量

$$I=\int r^2\,dm,\qquad L=I\omega,\qquad E_{spin}=\frac12I\omega^2,\qquad \omega=\frac{2\pi\,RPM}{60}$$

相同轉速下，把質量移向外圈會提高轉動慣量與自轉能量。固定發射能量時，較大的轉動慣量對應較低轉速，因此比較配置時必須說明控制了什麼。本介面控制的是發射轉速。

慣量使用外側環形質量與內側圓柱質量加總：

$$I=\frac{m}{2}\left[f(R^2+(0.72R)^2)+(1-f)(0.48R)^2\right]$$

| 配置 | 質量 | 半徑 | 外圈質量比例 | 軸向慣量 |
| --- | --- | --- | --- | --- |
| 三翼攻擊型 | 48 g | 25 mm | 0.68 | 約 1.66 × 10⁻⁵ kg·m² |
| 五翼防禦型 | 52 g | 25 mm | 0.61 | 約 1.65 × 10⁻⁵ kg·m² |
| 六翼持久型 | 46 g | 25 mm | 0.79 | 約 1.79 × 10⁻⁵ kg·m² |

以上是原創模型的設計參數，未由商品實測校準。模型單位為公分；計算長度以公尺儲存，渲染時乘以 100。

### 進動與失速

重力與支點作用力產生力矩，改變角動量方向。高速、規則進動且自轉主導的對稱陀螺可用：

$$\Omega_p\approx\frac{mgh}{I\omega}$$

[OpenStax — Precession of a Gyroscope](https://openstax.org/books/university-physics-volume-1/pages/11-4-precession-of-a-gyroscope) 支持此高速近似；完整章動需要求解剛體姿態與接觸力矩。

本教材以連續混合函數在低速時降低此近似的權重，傾角逐步接近經驗目標。外圈低於接地高度時增加刮地阻力。碰撞對傾角的擾動與阻尼晃動是經驗效果；接觸閃線為視覺提示，依模擬時間播放。介面呈現的能量是自轉能量，並未包含進動與章動能量。

### 接地、耗能與碗面

碗面高度 $y=0.65(x^2+z^2)$，半徑 0.19 m。移動採淺碗投影近似與滾動阻力。由傾斜軸尖產生的牽引是有能量預算的近似：增加的平移動能由自轉能量扣除。自轉耗損包含常數接觸力矩、與角速度平方成正比的空氣阻力，以及外圈刮地項。係數見 `src/physics.mjs`。

### 碰撞

圓形包絡的法向衝量：

$$J_n=-\frac{(1+e)v_n}{1/m_A+1/m_B}$$

切向衝量包含自轉對有效質量的貢獻：

$$J_t=\operatorname{clamp}\left(\frac{-v_t}{1/m_A+1/m_B+R_A^2/I_A+R_B^2/I_B},-\mu J_n,\mu J_n\right)$$

接觸點速度由質心速度與自轉切向速度相加。切向衝量反對相對滑動，因此單次非彈性碰撞的總動能不增加。$ΔL=r\times J$ 同時改變兩方自轉；異向旋轉時可以把一方的部分自轉轉移給另一方。異向本身不保證加速。

[OpenStax — Types of Collisions](https://openstax.org/books/university-physics-volume-1/pages/9-4-types-of-collisions) 說明孤立系統的動量守恆與不同碰撞的動能條件。

刀翼接合另以單次接觸的經驗反彈近似：從兩方自轉能扣除最多 0.004 J，依相對滑動速度縮放，轉為等大反向衝量。此項保持平移動量與總動能收支，但未解析刀齒實際接觸幾何。

場地邊牆使用反彈與耗能切向衝量。持續接觸的求解迭代不重複計入碰撞次數。

## 模型適用範圍

- 使用可重現初始位置、SI 單位與 1/480 秒固定步進。
- 刀翼幾何以半徑 25 mm 的包絡圓處理水平碰撞；棘輪高度、刀刃凹凸、垂直跳躍與真正三維接觸需要擴充求解器。
- 進動採高速近似；低速傾倒與碰撞傾角採經驗式。平移使用淺碗近似，整段運動的精密能量守恆不在模型保證範圍內。
- 場地是封閉圓碗，勝負依模擬角速度低於 8 rad/s 判定停止；同一步雙停則平手。
- 齒部作構造展示；X Dash、爆裂鎖扣與出界賽制需要額外機構模型。
- 視覺自轉依實際角速度的平方根壓縮，6000 rpm 顯示約每秒 2.86 圈，方便辨識刀翼並呈現轉速差異；實際模擬轉速保留於遙測。頁面背景停留不累積物理時間；極慢裝置採上限 0.1 秒的單畫格時間，可能降低模擬相對於實際時鐘的速度。

## 三維製作

Three.js 0.180.0。使用帶孔擠出金屬環、倒角刀翼、車削軸尖、棘輪凸耳與原創 Canvas 徽章。三層零件獨立分組，可分解與點選。金屬和樹脂使用 PBR 材質、室內環境反射、透明傳輸、清漆與陰影。

[Three.js — MeshPhysicalMaterial](https://threejs.org/docs/pages/MeshPhysicalMaterial.html) 與 [MeshStandardMaterial](https://threejs.org/docs/pages/MeshStandardMaterial.html) 為材質實作參考。環境光源經 PMREM 預濾後提供金屬反射。

## 驗證

`node --test tests/physics.test.mjs`：SI 尺度、彈性碰撞動量與動能守恆、600 組摩擦耗能測試、異向轉速轉移、重疊分離、邊牆耗能、孤立自轉衰減、36 組極端配置停止、決定性重播與進動方向。

瀏覽器使用本機 HTML 載入。檢查組裝、分解、各種刀刃／軸尖、旋轉／俯視、雙方配置、發射／暫停／繼續／重設、慢動作、返回構造觀察、轉速曲線，以及桌面與手機寬度。
