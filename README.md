# Story RPG GitHub Pages 正式版

主要修改 `data/story.json` 即可製作劇情。

支援：
- 手機 430×932
- 電腦維持手機長條比例
- story / choice / CG / ending
- 好感度、勇氣、金錢、旗標
- add / subtract / set
- > >= < <= == !=
- 條件式選項與劇情分支
- CG 點擊前進
- Debug 變數
- GitHub Pages

GitHub：
1. 上傳整個資料夾到 repository
2. Settings → Pages
3. 選 main branch / root（或 GitHub Actions）
4. 使用產生的 Pages 網址

本機測試：
`python -m http.server 8000`
再開 `http://localhost:8000`

不要直接雙擊 index.html 測試 JSON，因為瀏覽器可能阻擋 file:// 讀取 JSON；GitHub Pages 不會有這個問題。

assets/character、music、sound 已預留，方便後續加入角色立繪、BGM、音效。
