// 拍照匯入：用 Tesseract.js（CDN 動態載入）辨識課本照片上的日文
let tesseractPromise = null;

function loadTesseract() {
  if (!tesseractPromise) {
    tesseractPromise = import('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js')
      .then((m) => m.default || m);
  }
  return tesseractPromise;
}

// 回傳辨識出的文字；onProgress(0~1) 用來更新進度條
export async function recognizeImage(file, onProgress) {
  const Tesseract = await loadTesseract();
  const worker = await Tesseract.createWorker(['jpn', 'chi_tra'], 1, {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) onProgress(m.progress);
    },
  });
  try {
    const { data } = await worker.recognize(file);
    return data.text;
  } finally {
    await worker.terminate();
  }
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
