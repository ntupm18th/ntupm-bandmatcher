# 流唱之夜樂手懸賞區

表演活動的樂手媒合工具，做成「任務懸賞區」的樣子：

- **主唱**按「徵樂手」貼一首歌，列出缺的樂手（電吉他、貝斯、鼓…），每個位置是懸賞單上的一格集章格。
- **樂手**在名冊登記自己會的樂器、自我介紹、聯絡方式，看到缺人的位置按「我來」報名。
- 主唱用這首歌的**管理密碼**進入管理後，可以確認或婉拒報名、直接填入私下找到的人、增減位置。確認後那一格會蓋上樂手的名章。
- 每一格都蓋滿，整張單子蓋上「成團」章。
- 忘記密碼時，團長可以用**管理員密碼**管理所有歌與樂手資料。

## 本機執行

```bash
npm install
npm run dev
```

沒有設定 `.env` 時會以**示範模式**執行：資料只存在自己的瀏覽器，範例資料的密碼是 `demo`
（示範模式下 `admin` 也能當管理員密碼）。

## 接上 Supabase

1. 到 [supabase.com](https://supabase.com) 建一個專案（免費方案就夠用）。
2. Dashboard → **SQL Editor**，把 `supabase/schema.sql` 整份貼上執行。
3. （建議）在 SQL Editor 設定管理員密碼：
   ```sql
   insert into public.app_secrets (key, password_hash)
   values ('admin', extensions.crypt('換成你的管理員密碼', extensions.gen_salt('bf', 8)))
   on conflict (key) do update set password_hash = excluded.password_hash;
   ```
4. Dashboard → **Project Settings → API**，複製 Project URL 與 `anon` public key。
5. 複製 `.env.example` 為 `.env`，填入：
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   VITE_EVENT_NAME=期末成發
   ```

`anon` key 放在前端是正常的：資料表對外只開放讀取，所有寫入都必須經過 `schema.sql`
裡檢查密碼的函式，密碼只以 bcrypt 雜湊存放在前端讀不到的表。

### 關於流量（egress）

網站本身是靜態檔案，放在 Vercel / Cloudflare Pages 等地方，**不會**用到 Supabase 的流量。
Supabase 只負責文字資料：開一次頁面只抓一次需要的欄位，不使用即時訂閱，
切回分頁超過一分鐘才重新整理。100 首歌 + 100 位樂手大約是幾十 KB，
一般社團活動的用量離免費方案的額度還很遠。

如果目前的 Supabase organization 這個月流量快用完了，可以另外開一個 organization
或帳號給這個專案用。

## 部署（GitHub Pages）

`.github/workflows/deploy.yml` 會在每次推到 `main` 時自動建置並部署。第一次設定：

1. Repo → **Settings → Pages** → Source 選 **GitHub Actions**。
2. Repo → **Settings → Secrets and variables → Actions → Variables** 分頁，新增：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_EVENT_NAME`（可不設）
3. 到 **Actions** 分頁手動執行一次「Deploy to GitHub Pages」，或推一個新 commit。

網址會是 `https://<組織>.github.io/<repo 名稱>/`。沒設定 Supabase 變數時，網站會以示範模式上線。
網址使用 `#/quest/<id>` 形式，可以直接把某一首歌的連結丟到群組。

## 專案結構

```
supabase/schema.sql         資料表、權限、所有寫入用的 RPC 函式
src/api.ts                  Supabase 與示範模式兩種實作
src/App.tsx                 路由、資料載入、彈窗
src/components/QuestBoard   懸賞區與懸賞單
src/components/QuestDetail  歌曲內容、報名、主唱管理
src/components/Roster       樂手名冊與個人資料
src/components/Forms        徵樂手、登記樂手的表單
```

## 已知限制

- 密碼是「每首歌一組」，拿到密碼的人都能管理那首歌；請主唱不要用常用密碼。
- 沒有登入系統，任何人都能用任何名字報名，由主唱自己確認。
