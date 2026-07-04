# 日語旅遊複習 App

搭配《日本語GOGO》第一冊進度的日文複習 web app，目標是去日本旅遊時能開口進行簡單對話。

## 功能

- 🎴 **單字卡複習（SRS 間隔重複）**：內建 181 個 N5 程度單字句型（課本常見範圍 + 旅遊常用），記得的卡片間隔越拉越長，忘記的常出現
- 💬 **情境會話**：餐廳點餐、便利商店、問路、車站搭車、飯店入住、藥妝店等 6 個實戰情境，可跟讀（含日文發音）也可玩填空挑戰
- ✏️ **選擇題測驗**：自選範圍與題型（日→中／中→日），為日檢 N5 暖身
- 📷 **拍照匯入**：拍下課本單字頁，OCR 自動辨識成卡片（也支援貼上文字匯入）
- 🔊 **日文發音**：所有單字和會話句都可點擊播放（使用瀏覽器內建語音）
- 📴 **離線可用**：PWA 設計，加入手機主畫面後沒網路也能複習
- 💾 **備份還原**：進度存在瀏覽器 localStorage，可匯出 JSON 備份

## 本機執行

不需要安裝任何東西，用任何靜態伺服器即可：

```bash
python3 -m http.server 8000
# 打開 http://localhost:8000
```

## 部署到 GitHub Pages

1. 到 GitHub 建立新 repo（例如 `japanese-review-app`）
2. 推上去：
   ```bash
   git remote add origin https://github.com/<你的帳號>/japanese-review-app.git
   git push -u origin main
   ```
3. 到 repo 的 **Settings → Pages**，Source 選 **Deploy from a branch**，Branch 選 **main / (root)**，儲存
4. 一兩分鐘後就能在 `https://<你的帳號>.github.io/japanese-review-app/` 使用
5. 手機打開網址後，用「加入主畫面」變成 app

## 技術說明

- 純 HTML/CSS/JS（ES Modules），無框架、無建置步驟
- OCR 使用 [Tesseract.js](https://tesseract.projectnaptha.com/)（CDN 動態載入，只在使用拍照匯入時下載）
- 發音使用 Web Speech API（`ja-JP`）
- 資料儲存：localStorage（單一裝置），換裝置請用備份/還原功能
