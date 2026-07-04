// 拍照匯入：用 Tesseract.js（CDN 動態載入）辨識課本照片上的日文
let tesseractPromise = null;

function loadTesseract() {
  if (!tesseractPromise) {
    tesseractPromise = import('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js')
      .then((m) => m.default || m);
  }
  return tesseractPromise;
}

// 前處理：放大 + 灰階 + 提高對比，把彩色課本頁面變成乾淨的黑白文字
// Tesseract 對低解析度和彩色背景很敏感，這一步對辨識率影響最大
async function preprocess(file) {
  const bitmap = await createImageBitmap(file);
  // 目標寬度 2000px 左右，太小的照片放大、太大的縮小
  const scale = Math.min(2.5, Math.max(1, 2000 / bitmap.width));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, w, h);

  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  // 灰階 + 對比拉伸（以 0.5 為中心放大 1.6 倍）
  for (let i = 0; i < d.length; i += 4) {
    const gray = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    const v = Math.max(0, Math.min(255, (gray - 128) * 1.6 + 128));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// 回傳辨識出的文字；onProgress(0~1) 用來更新進度條
export async function recognizeImage(file, onProgress) {
  const Tesseract = await loadTesseract();
  const canvas = await preprocess(file);
  // 只載入日文模型：混用多語言模型會嚴重降低辨識率
  const worker = await Tesseract.createWorker('jpn', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) onProgress(m.progress);
    },
  });
  try {
    await worker.setParameters({
      preserve_interword_spaces: '1',
    });
    const { data } = await worker.recognize(canvas);
    return cleanOcrText(data.text);
  } finally {
    await worker.terminate();
  }
}

const CJK = '぀-ヿ一-鿿々〜ー';

// Tesseract 辨識日文時會在字與字之間塞空格，先清掉再解析
export function cleanOcrText(text) {
  return text
    .split('\n')
    .map((line) => line
      .replace(new RegExp(`(?<=[${CJK}])[ \\t]+(?=[${CJK}])`, 'g'), '')
      .replace(new RegExp(`(?<=[${CJK}])[ \\t]+(?=[。、！？「」（）])`, 'g'), '')
      .replace(new RegExp(`(?<=[。、！？「」（）])[ \\t]+(?=[${CJK}])`, 'g'), '')
      .trim())
    .filter((line) => line.length > 0)
    .join('\n');
}

// 把貼上/辨識出的文字解析成卡片候選
// 支援格式：每行「日文<分隔>假名<分隔>中文」或「日文<分隔>中文」
// 分隔符號：Tab、逗號、頓號、斜線、全形空白、多個半形空白
export function parseCardText(text) {
  const cards = [];
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const parts = line.split(/\t|,|，|、|\/|／|\s{2,}|　+/).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 3) {
      cards.push({ jp: parts[0], kana: parts[1], zh: parts.slice(2).join(' ') });
    } else if (parts.length === 2) {
      cards.push({ jp: parts[0], kana: '', zh: parts[1] });
    } else if (parts.length === 1 && /[぀-ヿ一-鿿]/.test(parts[0])) {
      // 只有日文的行也收進來，讓使用者自己補中文
      cards.push({ jp: parts[0], kana: '', zh: '' });
    }
  }
  return cards;
}
