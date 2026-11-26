/**
 * 文脈工房 — 日本語文章・文脈解析エンジン（完全オフライン動作）
 */
(function (global) {
  'use strict';

  const DEFAULT_ORTHOGRAPHY_RULES = [
    { from: '出来る', to: 'できる', note: '補助動詞・可能表現はひらがなが読みやすい' },
    { from: '行なう', to: '行う', note: '公用文・一般的な送り仮名「行う」' },
    { from: '頂く', to: 'いただく', note: '補助動詞「〜していただく」はひらがな推奨' },
    { from: '下さい', to: 'ください', note: '補助動詞「〜してください」はひらがな推奨' },
    { from: '様々', to: 'さまざま', note: 'ひらがな表記で柔らかい印象に' },
    { from: '全て', to: 'すべて', note: '副詞・名詞の「すべて」はひらがな推奨' },
    { from: '更に', to: 'さらに', note: '接続詞・副詞はひらがなが読みやすい' },
    { from: '又、', to: 'また、', note: '接続詞はひらがな推奨' },
    { from: '何故', to: 'なぜ', note: '疑問詞はひらがなが読みやすい' },
    { from: '事', to: 'こと', note: '形式名詞「〜すること」はひらがな推奨（熟語に注意）', cautious: true }
  ];

  function stripMarkdownForMetrics(text) {
    return text
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^>\s?/gm, '')
      .replace(/^[-*+]\s+/gm, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/｜([^《]+)《[^》]+》/g, '$1')
      .replace(/^---+$/gm, '');
  }

  function splitSentences(text) {
    const clean = stripMarkdownForMetrics(text);
    const lines = clean.split(/\r?\n/);
    const sentences = [];
    let offset = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length > 0) {
        const parts = trimmed.match(/[^。！？!?]+[。！？!?]?/g) || [];
        let linePos = 0;
        for (const raw of parts) {
          const s = raw.trim();
          if (s.length > 0) {
            const idx = text.indexOf(s, offset + linePos);
            sentences.push({
              text: s,
              index: idx >= 0 ? idx : offset + linePos
            });
            linePos += raw.length;
          }
        }
      }
      offset += line.length + 1;
    }
    return sentences;
  }

  function classifySentenceStyle(sentence) {
    const s = sentence.replace(/[「」『』（）()\s]+$/g, '');
    if (/(です|ます|ました|ません|でしょう|ください|ございます)[。！？!?]?$/.test(s)) {
      return 'desu-masu';
    }
    if (/(である|であった|だった|だろう|ない|れる|られる|する|した|なる|なった|だ)[。！？!?]?$/.test(s)) {
      // 敬体ではない終止形・常体と判定（体言止めは除外）
      if (/(です|ます|ました|ません|でしょう)[。！？!?]?$/.test(s)) return 'desu-masu';
      return 'da-dearu';
    }
    return 'neutral';
  }

  function getEndingSignature(sentence) {
    const s = sentence.replace(/[。！？!?\s」』）)]+$/g, '');
    const endings = ['ました', 'ません', 'でしょう', 'である', 'だった', 'ている', 'ていた', 'です', 'ます', 'した', 'する', 'ない', 'だ', 'た'];
    for (const e of endings) {
      if (s.endsWith(e)) return e;
    }
    return '';
  }

  function computeCharRatios(text) {
    const net = stripMarkdownForMetrics(text).replace(/\s/g, '');
    const total = net.length;
    if (total === 0) {
      return { total: 0, kanji: 0, hira: 0, kata: 0, other: 0 };
    }
    let kanji = 0, hira = 0, kata = 0, other = 0;
    for (const ch of net) {
      if (/[\u4E00-\u9FFF\u3400-\u4DBF々]/.test(ch)) kanji++;
      else if (/[\u3040-\u309F]/.test(ch)) hira++;
      else if (/[\u30A0-\u30FFー]/.test(ch)) kata++;
      else other++;
    }
    return {
      total,
      kanji: Math.round((kanji / total) * 100),
      hira: Math.round((hira / total) * 100),
      kata: Math.round((kata / total) * 100),
      other: Math.max(0, 100 - Math.round((kanji / total) * 100) - Math.round((hira / total) * 100) - Math.round((kata / total) * 100))
    };
  }

  function analyze(text, options) {
    const opts = Object.assign({
      tone: 'desu-masu',
      maxSentenceLen: 80,
      customRules: []
    }, options || {});

    const totalChars = text.length;
    const netChars = text.replace(/\s/g, '').length;
    const sentences = splitSentences(text);
    const ratios = computeCharRatios(text);
    const issues = [];

    // 1. 文体（敬体・常体）の一貫性チェック
    if (opts.tone !== 'free') {
      const expected = opts.tone;
      for (const item of sentences) {
        if (item.text.length < 6) continue;
        const style = classifySentenceStyle(item.text);
        if (style !== 'neutral' && style !== expected) {
          issues.push({
            type: '文体混在',
            severity: 'high',
            message: expected === 'desu-masu'
              ? '設定文体「です・ます」に対して、常体（だ・である）の文が混ざっています。'
              : '設定文体「だ・である」に対して、敬体（です・ます）の文が混ざっています。',
            excerpt: item.text.slice(0, 72) + (item.text.length > 72 ? '…' : ''),
            index: item.index,
            length: item.text.length
          });
        }
      }
    }

    // 2. 長文アラート
    for (const item of sentences) {
      if (item.text.length > opts.maxSentenceLen) {
        issues.push({
          type: '長文注意',
          severity: 'warn',
          message: `1文が ${item.text.length} 文字あります（目安: ${opts.maxSentenceLen}文字以内）。文を分割すると読みやすくなります。`,
          excerpt: item.text.slice(0, 76) + '…',
          index: item.index,
          length: item.text.length
        });
      }
    }

    // 3. 語尾の3連続チェック
    let streak = 1;
    let prevEnd = '';
    for (let i = 0; i < sentences.length; i++) {
      const end = getEndingSignature(sentences[i].text);
      if (end && end === prevEnd) {
        streak++;
        if (streak === 3) {
          issues.push({
            type: '語尾の連続',
            severity: 'info',
            message: `「〜${end}」が3文以上連続しています。体言止めや言い換えでリズムを変えると引き締まります。`,
            excerpt: sentences[i].text.slice(0, 72) + (sentences[i].text.length > 72 ? '…' : ''),
            index: sentences[i].index,
            length: sentences[i].text.length
          });
        }
      } else {
        streak = 1;
        prevEnd = end;
      }
    }

    // 4. カスタム用語ルール（優先度高）
    for (const rule of (opts.customRules || [])) {
      if (!rule.from || !rule.to || rule.from === rule.to) continue;
      let pos = text.indexOf(rule.from);
      while (pos !== -1) {
        const start = Math.max(0, pos - 12);
        const end = Math.min(text.length, pos + rule.from.length + 14);
        issues.push({
          type: '表記ルール',
          severity: 'high',
          message: `カスタム辞書: 「${rule.from}」→「${rule.to}」への統一が設定されています。`,
          excerpt: (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : ''),
          index: pos,
          length: rule.from.length,
          replaceFrom: rule.from,
          replaceTo: rule.to
        });
        pos = text.indexOf(rule.from, pos + rule.from.length);
      }
    }

    // 5. 一般的な表記ゆれチェック
    for (const rule of DEFAULT_ORTHOGRAPHY_RULES) {
      if (rule.cautious) {
        // 「事」は「〜する事」「〜の事」などひらがな直後のみ検出
        const regex = /([ぁ-ん])事/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
          const pos = match.index + 1;
          const start = Math.max(0, pos - 10);
          const end = Math.min(text.length, pos + 14);
          issues.push({
            type: '表記ゆれ',
            severity: 'info',
            message: `「事」→「こと」（${rule.note}）`,
            excerpt: (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : ''),
            index: pos,
            length: 1,
            replaceFrom: '事',
            replaceTo: 'こと'
          });
        }
      } else {
        let pos = text.indexOf(rule.from);
        while (pos !== -1) {
          const start = Math.max(0, pos - 10);
          const end = Math.min(text.length, pos + rule.from.length + 14);
          issues.push({
            type: '表記ゆれ',
            severity: 'info',
            message: `「${rule.from}」→「${rule.to}」（${rule.note}）`,
            excerpt: (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : ''),
            index: pos,
            length: rule.from.length,
            replaceFrom: rule.from,
            replaceTo: rule.to
          });
          pos = text.indexOf(rule.from, pos + rule.from.length);
        }
      }
    }

    return {
      totalChars,
      netChars,
      manuscriptPages: (netChars / 400).toFixed(1),
      readMinutes: Math.max(1, Math.round(netChars / 500)),
      sentenceCount: sentences.length,
      ratios,
      issues
    };
  }

  function renderMarkdownHtml(title, body) {
    const escapeHtml = (s) => s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const formatInline = (s) => escapeHtml(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/｜([^《]+)《([^》]+)》/g, '<ruby>$1<rt>$2</rt></ruby>');

    const lines = body.split(/\r?\n/);
    let html = title ? `<h1>${escapeHtml(title)}</h1>` : '';
    let inList = false;

    for (const raw of lines) {
      const line = raw.trimEnd();
      if (/^---+$/.test(line.trim())) {
        if (inList) { html += '</ul>'; inList = false; }
        html += '<hr>';
      } else if (/^###\s+(.+)/.test(line)) {
        if (inList) { html += '</ul>'; inList = false; }
        html += `<h3>${formatInline(line.replace(/^###\s+/, ''))}</h3>`;
      } else if (/^##\s+(.+)/.test(line)) {
        if (inList) { html += '</ul>'; inList = false; }
        html += `<h2>${formatInline(line.replace(/^##\s+/, ''))}</h2>`;
      } else if (/^>\s?(.*)/.test(line)) {
        if (inList) { html += '</ul>'; inList = false; }
        html += `<blockquote>${formatInline(line.replace(/^>\s?/, ''))}</blockquote>`;
      } else if (/^[-*+]\s+(.+)/.test(line)) {
        if (!inList) { html += '<ul>'; inList = true; }
        html += `<li>${formatInline(line.replace(/^[-*+]\s+/, ''))}</li>`;
      } else if (line.trim() === '') {
        if (inList) { html += '</ul>'; inList = false; }
      } else {
        if (inList) { html += '</ul>'; inList = false; }
        html += `<p>${formatInline(line)}</p>`;
      }
    }
    if (inList) html += '</ul>';
    return html;
  }

  global.BunshoAnalyzer = {
    analyze,
    renderMarkdownHtml
  };
})(window);
