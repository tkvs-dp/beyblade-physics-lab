# 戰鬥陀螺｜構造與動力實驗室 v2

本專案用於記錄 **GPT-5.6 Sol** 推出時的前端工程、3D 建模與物理模擬能力。

- 線上展示：https://tkvs-dp.github.io/beyblade-physics-lab/

開啟 [index.html](index.html)。HTML 與 `assets` 必須保持相對位置；執行時可離線使用。

## 維護

使用 Node.js 20+：

```sh
npm ci
npm test
npm run build
npm run test:browser
```

`assets/lab.js` 是已提交的瀏覽器 bundle，從本機 HTML 開啟即可載入。修改原始碼後重新建置。

瀏覽器測試使用已安裝的 Google Chrome；也可透過 `CHROME_PATH` 指定 Chromium 執行檔。測試會封鎖 HTTP 請求，驗證離線操作、各種配置、慢動作、暫停與重設、手機排版和 WebGL 中斷訊息。

- `src/model.mjs`：三層模型、軸尖幾何、材質與場地。
- `src/physics.mjs`：SI 參數、固定步進、接觸衝量、停止判定。
- `src/app.mjs`：場景、操作、遙測與生命週期。
- `assets/lab.css`：響應式介面。
- `tests/physics.test.mjs`：物理回歸測試。
- [RESEARCH.md](RESEARCH.md)：調研、公式、假設與驗證範圍。

Three.js 採 MIT 授權，見 [THIRD-PARTY-LICENSE.txt](THIRD-PARTY-LICENSE.txt)。環境照明與字標於本機生成。
