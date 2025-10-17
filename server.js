// server.js - configurado para Cloudflare R2 (S3 compatible)
// IMPORTANT: coloque as variáveis de ambiente no Render / GitHub Secrets:
// CF_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
// BASE_URL (opcional), SIGN_URL_EXPIRES (segundos, ex: 86400)

const express = require('express');
const multer = require('multer');
const QRCode = require('qrcode');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');
const cors = require('cors');
const sharp = require('sharp');

const app = express();
app.use(cors());
app.use(express.static('public'));

// Env vars (expect R2 / Cloudflare)
const {
  CF_ACCOUNT_ID,
  R2_BUCKET,
  R2_REGION, // usually unused for R2, can be 'auto'
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  BASE_URL,
  SIGN_URL_EXPIRES
} = process.env;

const SIGN_EXPIRES = parseInt(SIGN_URL_EXPIRES || '86400', 10);

// build S3-compatible endpoint for R2
const S3_ENDPOINT = CF_ACCOUNT_ID ? `https://${CF_ACCOUNT_ID}.r2.cloudflarestorage.com` : process.env.S3_ENDPOINT;

if (!R2_BUCKET || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.warn('WARNING: faltam variáveis R2 — configure R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY (ou use S3 compatible vars).');
}

// Create S3 client configured for R2
const s3Client = new S3Client({
  region: R2_REGION || 'auto',
  endpoint: S3_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY
  },
  forcePathStyle: true
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Apenas imagens são permitidas.'));
    cb(null, true);
  }
});

// Optional: see QR that points to the upload page
app.get('/qr-upload', async (req, res) => {
  const uploadPage = (BASE_URL || `${req.protocol}://${req.get('host')}`) + '/upload.html';
  const img = await QRCode.toDataURL(uploadPage);
  res.type('html').send(`<h3>Escaneie para enviar foto</h3><img src="${img}" />`);
});

app.post('/upload', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });

    // Optimize image: rotate, resize max width 1920, convert to jpeg
    const optimized = await sharp(req.file.buffer)
      .rotate()
      .resize({ width: 1920, withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();

    const id = crypto.randomBytes(9).toString('hex');
    const key = `${id}.jpg`;

    // Upload to R2 (private)
    const putCmd = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: optimized,
      ContentType: 'image/jpeg',
      // R2 respects ACL header but it's fine to keep private and use signed URLs
    });
    await s3Client.send(putCmd);

    // Generate signed URL (GetObject)
    const getCmd = new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: key
    });
    const signedUrl = await getSignedUrl(s3Client, getCmd, { expiresIn: SIGN_EXPIRES });

    const qrDataUrl = await QRCode.toDataURL(signedUrl, { errorCorrectionLevel: 'M' });

    res.json({ id, filename: key, viewUrl: signedUrl, qrDataUrl });
  } catch (err) {
    console.error('Error /upload', err);
    res.status(500).json({ error: err.message || 'erro interno' });
  }
});

app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Photo QR Uploader listening on ${PORT}`));