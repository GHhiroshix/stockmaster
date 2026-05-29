# StockMaster - デプロイ手順

## 必要なもの（すべて無料）
- GitHubアカウント: https://github.com
- Vercelアカウント: https://vercel.com

---

## 手順

### 1. GitHubにリポジトリを作成
1. https://github.com を開く
2. 右上「+」→「New repository」
3. Repository name: `stockmaster`
4. 「Create repository」をクリック

### 2. ファイルをアップロード
1. 作成したリポジトリページで「uploading an existing file」をクリック
2. このフォルダの中身を全部ドラッグ＆ドロップ
   - package.json
   - vite.config.js
   - index.html
   - src/main.jsx
   - src/App.jsx
3. 「Commit changes」をクリック

### 3. Vercelにデプロイ
1. https://vercel.com を開く
2. 「Start Deploying」→ GitHubでログイン
3. 「Import」でstockmasterを選択
4. 設定はそのまま「Deploy」をクリック
5. 1〜2分でURLが発行される（例: stockmaster.vercel.app）

### 4. iPadで使う
1. Safari でVercelのURLを開く
2. 共有ボタン→「ホーム画面に追加」でアプリとして使える
3. 「📷 カメラでスキャン」ボタンでJANコードを読み取れる

---

## フォルダ構成
```
stockmaster/
├── package.json
├── vite.config.js
├── index.html
└── src/
    ├── main.jsx
    └── App.jsx
```
