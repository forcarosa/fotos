# Photo QR Uploader — Cloudflare R2 + Render deploy

Este projeto permite:
- Gerar uma página de upload (tema Força Rosa).
- Upload de fotos para Cloudflare R2.
- Geração automática de um QR code apontando para um link temporário (pre-signed URL) para visualizar a foto.

## Como usar (resumo)
1. Crie um repositório no GitHub e envie os arquivos deste projeto.
2. Em seguida conecte o repositório no Render.com e crie um *Web Service* com Node 18.
   - Start Command: `npm start`
3. Configure as variáveis de ambiente no Render (Settings > Environment):
   - `CF_ACCOUNT_ID` = seu Cloudflare Account ID (ex: `abcdef...`)
   - `R2_BUCKET` = nome do bucket/namespace em R2 (ex: `forcarosa-fotos`)
   - `R2_ACCESS_KEY_ID` = access key
   - `R2_SECRET_ACCESS_KEY` = secret key
   - `BASE_URL` = (opcional) `https://<seu-servico>.onrender.com` — usado para /qr-upload
   - `SIGN_URL_EXPIRES` = tempo em segundos que o link expira (ex: `86400` = 24h)

> Obs: Se preferir, você também pode usar as variáveis compatíveis `S3_ENDPOINT`, `S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` — o servidor detecta.

## Testando localmente
1. Instale dependências: `npm install`
2. Crie um arquivo `.env` com as variáveis acima (opcional - para testes locais).
3. Rode: `npm start`
4. Abra `http://localhost:3000/qr-upload` para ver o QR que leva à página de upload.

## Segurança
- Os objetos são privados no bucket; o acesso é feito via pre-signed URL (expira).
- Não comite credenciais no repo. Use as Environment Variables do Render / Secrets do GitHub.

## Estrutura
- `server.js` - backend (Express)
- `public/upload.html` - página de upload
- `public/style.css` - tema rosa