/**
 * 文脈工房 — ファイル読込モジュール
 * Word (.docx) は完全ローカル・ゼロ依存（DecompressionStream + OOXML XMLパーサー）で抽出
 * PDF (.pdf) は PDF.js をオンデマンド読込して日本語CMap対応でテキスト抽出
 */
(function (global) {
  'use strict';

  const PDFJS_VERSION = '3.11.174';
  const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;
  let pdfjsReadyPromise = null;

  function loadPdfJs() {
    if (global.pdfjsLib) return Promise.resolve(global.pdfjsLib);
    if (pdfjsReadyPromise) return pdfjsReadyPromise;

    pdfjsReadyPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `${PDFJS_CDN}/pdf.min.js`;
      script.async = true;
      script.onload = () => {
        if (!global.pdfjsLib) {
          reject(new Error('PDF.js の初期化に失敗しました。'));
          return;
        }
        global.pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.js`;
        resolve(global.pdfjsLib);
      };
      script.onerror = () => {
        pdfjsReadyPromise = null;
        reject(new Error('PDF解析ライブラリの読み込みに失敗しました（オンライン環境で再度お試しください）。'));
      };
      document.head.appendChild(script);
    });
    return pdfjsReadyPromise;
  }

  async function extractPdfText(arrayBuffer) {
    const pdfjsLib = await loadPdfJs();
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      cMapUrl: `${PDFJS_CDN}/cmaps/`,
      cMapPacked: true
    });
    const pdf = await loadingTask.promise;
    const pages = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const lines = [];
      let currentLine = '';
      let lastY = null;

      for (const item of content.items) {
        if (!('str' in item)) continue;
        const text = item.str;
        const y = item.transform ? Math.round(item.transform[5]) : lastY;

        if (lastY !== null && y !== null && Math.abs(y - lastY) > 6) {
          if (currentLine.trim()) lines.push(currentLine.trim());
          currentLine = text;
        } else {
          // 日本語文字同士の間には不要なスペースを入れない
          if (currentLine && text && /[A-Za-z0-9]$/.test(currentLine) && /^[A-Za-z0-9]/.test(text)) {
            currentLine += ' ' + text;
          } else {
            currentLine += text;
          }
        }
        if (item.hasEOL) {
          if (currentLine.trim()) lines.push(currentLine.trim());
          currentLine = '';
          lastY = null;
        } else {
          lastY = y;
        }
      }
      if (currentLine.trim()) lines.push(currentLine.trim());
      if (lines.length > 0) {
        pages.push(lines.join('\n'));
      }
    }

    const fullText = pages.join('\n\n').trim();
    if (!fullText) {
      throw new Error('PDFからテキストを抽出できませんでした。画像のみ（スキャン）のPDFには対応していません。');
    }
    return {
      text: fullText,
      meta: `${pdf.numPages}ページ`
    };
  }

  /**
   * 純JS ZIP展開（word/document.xml のみ抽出）
   */
  async function extractZipEntry(arrayBuffer, targetPath) {
    const bytes = new Uint8Array(arrayBuffer);
    const view = new DataView(arrayBuffer);

    // End of Central Directory (EOCD) シグネチャ 0x06054b50 を後方検索
    let eocdOffset = -1;
    const minOffset = Math.max(0, bytes.length - 65557);
    for (let i = bytes.length - 22; i >= minOffset; i--) {
      if (view.getUint32(i, true) === 0x06054b50) {
        eocdOffset = i;
        break;
      }
    }
    if (eocdOffset === -1) {
      throw new Error('有効な .docx ファイルではありません（ZIP構造が見つかりません）。');
    }

    const cdSize = view.getUint32(eocdOffset + 12, true);
    const cdOffset = view.getUint32(eocdOffset + 16, true);
    const decoder = new TextDecoder('utf-8');

    let pos = cdOffset;
    const cdEnd = cdOffset + cdSize;
    while (pos < cdEnd) {
      if (view.getUint32(pos, true) !== 0x02014b50) break;
      const method = view.getUint16(pos + 10, true);
      const compSize = view.getUint32(pos + 20, true);
      const nameLen = view.getUint16(pos + 28, true);
      const extraLen = view.getUint16(pos + 30, true);
      const commentLen = view.getUint16(pos + 32, true);
      const localHeaderOffset = view.getUint32(pos + 42, true);

      const name = decoder.decode(bytes.subarray(pos + 46, pos + 46 + nameLen));
      if (name === targetPath) {
        if (view.getUint32(localHeaderOffset, true) !== 0x04034b50) {
          throw new Error('.docx のローカルヘッダーが破損しています。');
        }
        const lNameLen = view.getUint16(localHeaderOffset + 26, true);
        const lExtraLen = view.getUint16(localHeaderOffset + 28, true);
        const dataStart = localHeaderOffset + 30 + lNameLen + lExtraLen;
        const compressed = bytes.subarray(dataStart, dataStart + compSize);

        if (method === 0) {
          return decoder.decode(compressed);
        }
        if (method === 8) {
          if (typeof DecompressionStream === 'undefined') {
            throw new Error('お使いのブラウザは .docx 解凍（DecompressionStream）に対応していません。');
          }
          const ds = new DecompressionStream('deflate-raw');
          const writer = ds.writable.getWriter();
          writer.write(compressed);
          writer.close();
          const outBuf = await new Response(ds.readable).arrayBuffer();
          return decoder.decode(outBuf);
        }
        throw new Error(`未対応の圧縮方式（${method}）です。`);
      }

      pos += 46 + nameLen + extraLen + commentLen;
    }

    throw new Error('.docx 内に本文データ（word/document.xml）が見つかりませんでした。');
  }

  async function extractDocxText(arrayBuffer) {
    const xmlStr = await extractZipEntry(arrayBuffer, 'word/document.xml');
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlStr, 'application/xml');
    const parseErr = xmlDoc.querySelector('parsererror');
    if (parseErr) {
      throw new Error('Word文書のXML解析に失敗しました。');
    }

    const paragraphs = [];
    const pNodes = xmlDoc.getElementsByTagNameNS('*', 'p');

    for (let i = 0; i < pNodes.length; i++) {
      const p = pNodes[i];
      let line = '';
      const walk = (node) => {
        for (let c = 0; c < node.childNodes.length; c++) {
          const child = node.childNodes[c];
          if (child.nodeType === 1) {
            const local = child.localName;
            if (local === 't') {
              line += child.textContent || '';
            } else if (local === 'br' || local === 'cr') {
              line += '\n';
            } else if (local === 'tab') {
              line += '\t';
            } else if (local !== 'delText' && local !== 'instrText') {
              walk(child);
            }
          }
        }
      };
      walk(p);
      const cleaned = line.replace(/\r\n/g, '\n').trimEnd();
      if (cleaned.trim().length > 0) {
        paragraphs.push(cleaned);
      }
    }

    const fullText = paragraphs.join('\n\n').trim();
    if (!fullText) {
      throw new Error('Wordファイル内に読み取れる本文が見つかりませんでした。');
    }
    return {
      text: fullText,
      meta: `${paragraphs.length}段落`
    };
  }

  async function readFileAsText(file) {
    if (!file) throw new Error('ファイルが選択されていません。');
    const name = file.name || '';
    const ext = name.toLowerCase().split('.').pop();

    if (ext === 'txt' || ext === 'md' || ext === 'csv') {
      const text = await file.text();
      return {
        text: text.replace(/\r\n/g, '\n').trim(),
        fileName: name,
        fileType: 'テキスト',
        meta: `${text.length}字`
      };
    }

    if (ext === 'docx') {
      const buf = await file.arrayBuffer();
      const res = await extractDocxText(buf);
      return {
        text: res.text,
        fileName: name,
        fileType: 'Word (.docx)',
        meta: res.meta
      };
    }

    if (ext === 'doc') {
      throw new Error('旧形式の .doc ファイルは直接読み込めません。Word等で .docx 形式に保存し直してからアップロードしてください。');
    }

    if (ext === 'pdf') {
      const buf = await file.arrayBuffer();
      const res = await extractPdfText(buf);
      return {
        text: res.text,
        fileName: name,
        fileType: 'PDF',
        meta: res.meta
      };
    }

    throw new Error(`未対応のファイル形式（.${ext}）です。Word (.docx)、PDF (.pdf)、テキスト (.txt / .md) に対応しています。`);
  }

  global.BunshoImporter = {
    readFileAsText
  };
})(window);
