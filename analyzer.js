/**
 * 文脈工房 — AI文体判定・詳細統計・自然文リライト・文体プロファイル解析エンジン
 * 完全ローカル・オフライン動作
 */
(function (global) {
  'use strict';

  // 5カテゴリ（ことばね準拠: 定型表現 / 接続詞 / 文末の反復 / 文長の特徴 / 文章構成）
  const AI_PATTERNS = [
    // 定型表現
    { re: /と言えるでしょう|といえるでしょう/g, cat: '定型表現', weight: 9, reason: 'AIが結論やまとめで非常に多用する定型表現です' },
    { re: /重要な役割を果た(?:します|しています|す|している)/g, cat: '定型表現', weight: 10, reason: '「play an important role」の直訳調AI頻出フレーズです' },
    { re: /大きな役割を果た(?:します|しています|す|している)/g, cat: '定型表現', weight: 9, reason: '翻訳調のAI頻出フレーズです' },
    { re: /不可欠(?:な要素)?(?:です|である|と言えます|といえます)/g, cat: '定型表現', weight: 7, reason: 'AIが強調のために頻用する硬い表現です' },
    { re: /ますます高まって(?:います|いる)/g, cat: '定型表現', weight: 9, reason: 'AIが導入文で頻用する常套句です' },
    { re: /注目が集まって(?:います|いる)/g, cat: '定型表現', weight: 7, reason: 'AIが導入文で頻用する常套句です' },
    { re: /本記事では|この記事では/g, cat: '定型表現', weight: 7, reason: 'AI生成記事の典型的な導入句です' },
    { re: /詳しく解説(?:します|していきます|いたします)/g, cat: '定型表現', weight: 8, reason: 'AI生成記事の導入で頻用される定型句です' },
    { re: /することが可能です|することが可能(?:である|だ|になります)/g, cat: '定型表現', weight: 8, reason: '「〜できます」で済む箇所を冗長にするAI特有の言い回しです' },
    { re: /の観点から(?:見ると|は|も)?/g, cat: '定型表現', weight: 7, reason: '「from the perspective of」風の翻訳調表現です' },
    { re: /という点において/g, cat: '定型表現', weight: 8, reason: '冗長な硬い接続句です' },
    { re: /をもたら(?:します|す|しています|している)/g, cat: '定型表現', weight: 7, reason: '直訳調の動詞表現です' },
    { re: /に寄与(?:します|する|しています)/g, cat: '定型表現', weight: 7, reason: '硬い漢語表現です' },
    { re: /を促進(?:します|する|しています)/g, cat: '定型表現', weight: 6, reason: '硬い漢語表現です' },
    { re: /を向上させ(?:ます|る|ています)/g, cat: '定型表現', weight: 5, reason: 'メリット説明でAIが頻用する表現です' },
    { re: /効果的に活用(?:する|します|できます|できる)/g, cat: '定型表現', weight: 7, reason: '抽象度の高いAI頻出フレーズです' },
    { re: /多角的な視点|多角的(?:な|に)/g, cat: '定型表現', weight: 8, reason: 'AIが分析や視点を語る際に好む語彙です' },
    { re: /包括的(?:な|に)/g, cat: '定型表現', weight: 8, reason: '「comprehensive」の訳語としてAIが好む語彙です' },
    { re: /シームレス(?:な|に)/g, cat: '定型表現', weight: 7, reason: 'AIが連携や体験を語る際に頻用するカタカナ語です' },
    { re: /さまざまなメリット|多くのメリット/g, cat: '定型表現', weight: 6, reason: '具体性の薄い総称表現です' },
    // 接続詞
    { re: /一方で、/g, cat: '接続詞', weight: 6, reason: 'AIが対比構造を作るときに高頻度で使う接続詞です' },
    { re: /さらに、/g, cat: '接続詞', weight: 5, reason: 'AIが段落や文をつなぐ際に多用する接続詞です' },
    { re: /したがって、/g, cat: '接続詞', weight: 6, reason: '論理展開で機械的に置かれやすい接続詞です' },
    { re: /しかしながら、/g, cat: '接続詞', weight: 7, reason: '硬い逆接表現でAI文に多く見られます' },
    { re: /また、/g, cat: '接続詞', weight: 3, reason: '文頭での「また、」の連続は単調な印象を与えます' },
    // 文章構成
    { re: /以上のことから、?/g, cat: '文章構成', weight: 9, reason: 'AIがまとめ段落の冒頭で多用する定型構成句です' },
    { re: /結論として(?:は)?、?/g, cat: '文章構成', weight: 8, reason: 'AIが最終段落で機械的に置きがちな構成句です' },
    { re: /まとめると、?/g, cat: '文章構成', weight: 7, reason: '要約段落の定型冒頭句です' },
    { re: /総じて、?/g, cat: '文章構成', weight: 8, reason: '総括でAIが好む硬い副詞です' },
    { re: /まず、|次に、|最後に、/g, cat: '文章構成', weight: 6, reason: '「まず・次に・最後に」の三段列挙はAIの典型構成です' }
  ];

  const REWRITE_RULES = [
    {
      re: /多角的な視点/g,
      cat: '定型表現の自然化',
      variants: {
        polite: ['いろいろな角度', '複数の立場'],
        casual: ['いろんな角度', 'いろんな見方'],
        dearu: ['さまざまな角度', '複数の立場']
      }
    },
    {
      re: /重要な役割を果たしています/g,
      cat: '定型表現の自然化',
      variants: {
        polite: ['大きなカギを握っています', '欠かせない存在になっています'],
        casual: ['かなり大事なポイントになってます', 'なくてはならない存在です'],
        dearu: ['大きなカギを握っている', '欠かせない存在となっている']
      }
    },
    {
      re: /重要な役割を果たします/g,
      cat: '定型表現の自然化',
      variants: {
        polite: ['大きなカギを握ります', '大切なポイントになります'],
        casual: ['すごく大事なポイントになります', 'かなり効いてきます'],
        dearu: ['大きなカギを握る', '大切なポイントになる']
      }
    },
    {
      re: /と言えるでしょう|といえるでしょう/g,
      cat: '定型表現の自然化',
      variants: {
        polite: ['といえそうです', 'と考えてよさそうです', 'と感じます'],
        casual: ['と言っていいと思います', 'じゃないでしょうか'],
        dearu: ['といえそうだ', 'と見てよい', 'と考えられる']
      }
    },
    {
      re: /不可欠な要素です|不可欠です/g,
      cat: '定型表現の自然化',
      variants: {
        polite: ['欠かせません', '外せないポイントです'],
        casual: ['絶対外せません', 'ないと困りますよね'],
        dearu: ['欠かせない', '外せない要素である']
      }
    },
    {
      re: /ますます高まっています/g,
      cat: '定型表現の自然化',
      variants: {
        polite: ['以前よりずっと大きくなっています', '年々増しています'],
        casual: ['どんどん高まってきてます', '前よりずっと気になってます'],
        dearu: ['以前にも増して高まっている', '年々大きくなっている']
      }
    },
    {
      re: /注目が集まっています/g,
      cat: '定型表現の自然化',
      variants: {
        polite: ['関心を持つ人が増えています', '話題になることが増えてきました'],
        casual: ['気にする人が増えてますよね', 'けっこう話題になってます'],
        dearu: ['関心を持つ人が増えている', '話題にのぼることが多くなった']
      }
    },
    {
      re: /本記事では、?|この記事では、?/g,
      cat: '文章構成の自然化',
      variants: {
        polite: ['ここでは、', '今回は、'],
        casual: ['今回は、', 'ここでは、'],
        dearu: ['本稿では、', 'ここでは、']
      }
    },
    {
      re: /詳しく解説します|詳しく解説していきます/g,
      cat: '定型表現の自然化',
      variants: {
        polite: ['わかりやすく整理していきます', '具体的に掘り下げてみます'],
        casual: ['噛み砕いて話していきますね', '順番に見ていきましょう'],
        dearu: ['具体的に掘り下げていく', '順を追って整理する']
      }
    },
    {
      re: /することが可能です/g,
      cat: '冗長表現の簡潔化',
      variants: {
        polite: ['できます', 'できるようになります'],
        casual: ['できますよ', 'できちゃいます'],
        dearu: ['できる', 'できるようになる']
      }
    },
    {
      re: /することが可能(?:である|だ)/g,
      cat: '冗長表現の簡潔化',
      variants: {
        polite: ['できます'],
        casual: ['できます'],
        dearu: ['できる', 'できるようになる']
      }
    },
    {
      re: /という点において/g,
      cat: '冗長表現の簡潔化',
      variants: {
        polite: ['という面では', 'という点で'],
        casual: ['って点では', 'という面で'],
        dearu: ['という面では', 'という点で']
      }
    },
    {
      re: /の観点から見ると|の観点から/g,
      cat: '定型表現の自然化',
      variants: {
        polite: ['の面から見ると', 'という視点で見ると'],
        casual: ['の面から見ると', 'って見方をすると'],
        dearu: ['の面から見ると', 'という視点では']
      }
    },
    {
      re: /をもたらします/g,
      cat: '翻訳調の自然化',
      variants: {
        polite: ['につながります', 'を生みます'],
        casual: ['につながりますよ', 'を生んでくれます'],
        dearu: ['につながる', 'を生む']
      }
    },
    {
      re: /に寄与します/g,
      cat: '硬い表現の緩和',
      variants: {
        polite: ['に役立ちます', 'を後押しします'],
        casual: ['に役立ちます', 'のいい後押しになります'],
        dearu: ['に役立つ', 'を後押しする']
      }
    },
    {
      re: /を促進します/g,
      cat: '硬い表現の緩和',
      variants: {
        polite: ['をスムーズに進めます', 'を後押しします'],
        casual: ['をグッと進めやすくします', 'を後押ししてくれます'],
        dearu: ['を後押しする', 'を促す']
      }
    },
    {
      re: /を向上させます/g,
      cat: '硬い表現の緩和',
      variants: {
        polite: ['を引き上げます', 'を高めます'],
        casual: ['をぐっと引き上げます', 'をもっと良くします'],
        dearu: ['を引き上げる', 'を高める']
      }
    },
    {
      re: /効果的に活用する/g,
      cat: '定型表現の自然化',
      variants: {
        polite: ['うまく活かす', '上手に取り入れる'],
        casual: ['うまく使う', '上手に取り入れる'],
        dearu: ['うまく活かす', '上手に取り入れる']
      }
    },
    {
      re: /包括的な/g,
      cat: '硬い表現の緩和',
      variants: {
        polite: ['全体を見渡した', '幅広い'],
        casual: ['まるっとした', '幅広い'],
        dearu: ['全体を見渡した', '幅広い']
      }
    },
    {
      re: /多角的な/g,
      cat: '硬い表現の緩和',
      variants: {
        polite: ['いろいろな角度からの', '複数の面からの'],
        casual: ['いろんな角度からの', 'いくつもの面からの'],
        dearu: ['さまざまな角度からの', '複数の面からの']
      }
    },
    {
      re: /シームレスに/g,
      cat: '定型表現の自然化',
      variants: {
        polite: ['途切れなく', 'スムーズに'],
        casual: ['スムーズに', '違和感なく'],
        dearu: ['途切れなく', 'スムーズに']
      }
    },
    {
      re: /以上のことから、/g,
      cat: '文章構成の自然化',
      variants: {
        polite: ['こうした点を踏まえると、', 'ここまで見てきた通り、'],
        casual: ['こんな感じで、', 'ここまでを踏まえると、'],
        dearu: ['こうした点を踏まえると、', 'ここまで見てきたように、']
      }
    },
    {
      re: /結論として、/g,
      cat: '文章構成の自然化',
      variants: {
        polite: ['つまり、', '結局のところ、'],
        casual: ['結局のところ、', 'ざっくり言うと、'],
        dearu: ['つまり、', '要するに、']
      }
    },
    {
      re: /まとめると、/g,
      cat: '文章構成の自然化',
      variants: {
        polite: ['振り返ってみると、', '要点を整理すると、'],
        casual: ['ざっと振り返ると、', '要は、'],
        dearu: ['振り返ってみると、', '要点を整理すると、']
      }
    },
    {
      re: /総じて、/g,
      cat: '文章構成の自然化',
      variants: {
        polite: ['全体を通して見ると、', 'トータルで見れば、'],
        casual: ['全体としては、', 'トータルで見ると、'],
        dearu: ['全体を通して見ると、', 'おおむね、']
      }
    },
    {
      re: /しかしながら、/g,
      cat: '接続詞の自然化',
      variants: {
        polite: ['ただ、', 'とはいえ、'],
        casual: ['でも、', 'ただ、'],
        dearu: ['だが、', 'とはいえ、']
      }
    },
    {
      re: /したがって、/g,
      cat: '接続詞の自然化',
      variants: {
        polite: ['そのため、', 'だからこそ、'],
        casual: ['だから、', 'なので、'],
        dearu: ['そのため、', 'ゆえに、']
      }
    },
    {
      re: /一方で、/g,
      cat: '接続詞の自然化',
      variants: {
        polite: ['ただ、', 'その反面、', '反対に、'],
        casual: ['ただ、', '逆に、'],
        dearu: ['その反面、', '他方で、']
      }
    },
    {
      re: /さらに、/g,
      cat: '接続詞の自然化',
      variants: {
        polite: ['加えて、', 'それだけでなく、'],
        casual: ['しかも、', 'それに加えて、'],
        dearu: ['加えて、', 'それだけでなく、']
      }
    }
  ];

  function splitSentences(text) {
    const clean = (text || '').replace(/\r\n/g, '\n');
    const raw = clean.match(/[^。！？!?\n]+[。！？!?]?/g) || [];
    return raw.map((s) => s.trim()).filter((s) => s.length > 0);
  }

  function getEnding(sentence) {
    const s = sentence.replace(/[。！？!?\s」』）)]+$/g, '');
    const endings = ['ています', 'ました', 'ません', 'でしょう', 'である', 'だった', 'ている', 'です', 'ます', 'した', 'する', 'ない', 'だ', 'た'];
    for (const e of endings) {
      if (s.endsWith(e)) return e;
    }
    return 'その他';
  }

  function detectDominantTone(text) {
    const sents = splitSentences(text);
    let polite = 0, dearu = 0;
    for (const s of sents) {
      if (/(です|ます|ました|ません|でしょう)[。！？!?]?$/.test(s)) polite++;
      else if (/(である|だった|する|した|いる|ある|ない|だ)[。！？!?]?$/.test(s)) dearu++;
    }
    return dearu > polite ? 'dearu' : 'polite';
  }

  /**
   * 文体プロファイル抽出（過去の自作文から傾向を分析）
   */
  function analyzeProfileSamples(samples) {
    const joined = (samples || []).filter((s) => s && s.trim()).join('\n\n');
    const sents = splitSentences(joined);
    const lens = sents.map((s) => s.length);
    const avgLen = lens.length ? Math.round(lens.reduce((a, b) => a + b, 0) / lens.length) : 40;
    const tone = detectDominantTone(joined);

    const endCounts = {};
    for (const s of sents) {
      const e = getEnding(s);
      if (e !== 'その他') endCounts[e] = (endCounts[e] || 0) + 1;
    }
    const topEndings = Object.entries(endCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k]) => '〜' + k);

    return {
      tone,
      toneLabel: tone === 'dearu' ? '常体（だ・である）' : '敬体（です・ます）',
      avgLen,
      sampleCount: (samples || []).filter((s) => s && s.trim()).length,
      totalChars: joined.replace(/\s/g, '').length,
      topEndings
    };
  }

  /**
   * AI文体チェック（5カテゴリ＋詳細統計）
   */
  function detectAI(text) {
    const trimmed = (text || '').trim();
    const empty = {
      score: 0,
      label: 'チェック待ち',
      level: 'none',
      summary: '原稿を入力するか Word / PDF を読み込んで「AI文体をチェック」を押してください。',
      categories: {
        phrase: 0,
        conjunction: 0,
        ending: 0,
        length: 0,
        structure: 0
      },
      stats: {
        chars: 0,
        sentences: 0,
        paragraphs: 0,
        avgLen: 0,
        stdDev: 0,
        cv: 0,
        lenBuckets: { s30: 0, s50: 0, s70: 0, s71: 0 },
        topEndings: [],
        headConjunctions: []
      },
      matches: []
    };
    if (!trimmed) return empty;

    const sentences = splitSentences(trimmed);
    const paragraphs = trimmed.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    const chars = trimmed.replace(/\s/g, '').length;
    const scale = Math.max(1, chars / 220);

    // 1. パターン検出
    const rawMatches = [];
    let phrasePts = 0, conjPts = 0, structPts = 0;

    for (const p of AI_PATTERNS) {
      p.re.lastIndex = 0;
      let m;
      while ((m = p.re.exec(trimmed)) !== null) {
        rawMatches.push({
          start: m.index,
          end: m.index + m[0].length,
          text: m[0],
          cat: p.cat,
          reason: p.reason,
          weight: p.weight
        });
        if (p.cat === '定型表現') phrasePts += p.weight;
        else if (p.cat === '接続詞') conjPts += p.weight;
        else if (p.cat === '文章構成') structPts += p.weight;
      }
    }

    // Markdown装飾（太字・箇条書コロン）も「文章構成」の検出対象に含める
    const mdRe = /\*\*[^*\n]+\*\*/g;
    let mdMatch;
    while ((mdMatch = mdRe.exec(trimmed)) !== null) {
      rawMatches.push({
        start: mdMatch.index,
        end: mdMatch.index + mdMatch[0].length,
        text: mdMatch[0],
        cat: '文章構成',
        reason: 'AI出力特有のMarkdown太字装飾が残っています',
        weight: 7
      });
      structPts += 7;
    }

    // 重複除去
    rawMatches.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
    const matches = [];
    let lastEnd = -1;
    for (const m of rawMatches) {
      if (m.start >= lastEnd) {
        matches.push(m);
        lastEnd = m.end;
      }
    }

    // 2. 文長の特徴・統計
    const lens = sentences.map((s) => s.length).filter((n) => n >= 2);
    const avgLen = lens.length ? lens.reduce((a, b) => a + b, 0) / lens.length : 0;
    const variance = lens.length
      ? lens.reduce((acc, n) => acc + Math.pow(n - avgLen, 2), 0) / lens.length
      : 0;
    const stdDev = Math.sqrt(variance);
    const cv = avgLen > 0 ? stdDev / avgLen : 0;

    const lenBuckets = { s30: 0, s50: 0, s70: 0, s71: 0 };
    for (const n of lens) {
      if (n <= 30) lenBuckets.s30++;
      else if (n <= 50) lenBuckets.s50++;
      else if (n <= 70) lenBuckets.s70++;
      else lenBuckets.s71++;
    }

    let lengthScore = 15;
    if (lens.length >= 3) {
      if (cv < 0.22) lengthScore = 85;
      else if (cv < 0.32) lengthScore = 62;
      else if (cv < 0.42) lengthScore = 38;
      else if (cv < 0.52) lengthScore = 22;
      else lengthScore = 10;
    }

    // 3. 文末の反復
    let repeatPairs = 0, totalPairs = 0, prevEnd = '';
    const endFreq = {};
    const conjFreq = {};
    const conjList = ['まず', '次に', '最後に', 'さらに', '一方で', 'したがって', 'しかしながら', 'また', 'ただし', 'つまり', 'なお'];

    for (const s of sentences) {
      const end = getEnding(s);
      if (end !== 'その他') {
        endFreq[end] = (endFreq[end] || 0) + 1;
        if (prevEnd && prevEnd !== 'その他') {
          totalPairs++;
          if (end === prevEnd) repeatPairs++;
        }
      }
      prevEnd = end;

      for (const c of conjList) {
        if (s.startsWith(c)) {
          conjFreq[c] = (conjFreq[c] || 0) + 1;
          break;
        }
      }
    }

    const endingScore = totalPairs > 0 ? Math.min(100, Math.round((repeatPairs / totalPairs) * 140)) : 0;

    const phraseScore = Math.min(100, Math.round((phrasePts / scale) * 3.6));
    const conjunctionScore = Math.min(100, Math.round((conjPts / scale) * 5.2));
    const structureScore = Math.min(100, Math.round((structPts / scale) * 4.2));

    let rawTotal =
      phraseScore * 0.34 +
      conjunctionScore * 0.16 +
      endingScore * 0.14 +
      lengthScore * 0.16 +
      structureScore * 0.20;

    if (matches.length >= 5) rawTotal += 8;
    if (matches.length >= 9) rawTotal += 7;
    if (chars < 30) rawTotal *= 0.6;

    const score = Math.max(2, Math.min(98, Math.round(rawTotal)));

    let label = '自然な文体';
    let level = 'human';
    let summary = 'AI特有の定型表現や機械的な反復は少なく、自然な日本語の文体です。';
    if (score >= 70) {
      label = 'AI文体の特徴が強い';
      level = 'high';
      summary = 'AIの下書きに多い定型表現・接続詞・構成パターンが複数検出されました。自然な文章に整える効果が高い状態です。';
    } else if (score >= 45) {
      label = 'ややAI文体の傾向あり';
      level = 'mid';
      summary = '一部に定型的な言い回しやリズムの均一さが見られます。気になる箇所を整えるとぐっと自然になります。';
    } else if (score >= 25) {
      label = '軽度の定型傾向';
      level = 'low';
      summary = '概ね自然ですが、数箇所の硬い表現や文末を整えるとさらに読みやすくなります。';
    }

    return {
      score,
      label,
      level,
      summary,
      categories: {
        phrase: phraseScore,
        conjunction: conjunctionScore,
        ending: endingScore,
        length: lengthScore,
        structure: structureScore
      },
      stats: {
        chars,
        sentences: sentences.length,
        paragraphs: paragraphs.length,
        avgLen: Math.round(avgLen),
        stdDev: Number(stdDev.toFixed(1)),
        cv: Number(cv.toFixed(2)),
        lenBuckets,
        topEndings: Object.entries(endFreq).sort((a, b) => b[1] - a[1]).slice(0, 5),
        headConjunctions: Object.entries(conjFreq).sort((a, b) => b[1] - a[1]).slice(0, 5)
      },
      matches
    };
  }

  /**
   * 自然な日本語へリライト（ヒューマナイズ）
   */
  function humanize(text, options) {
    const opts = Object.assign({
      preset: 'report-dearu', // report-dearu | report-polite | general | academic | business | profile
      intensity: 60,          // 0-100
      removeMarkdown: true,
      varyEndings: true,
      keepQuotes: true,
      profile: null,
      seed: 0
    }, options || {});

    let out = (text || '').replace(/\r\n/g, '\n');
    const changes = [];
    let cursor = opts.seed || 0;
    const pick = (arr) => arr[(cursor++) % arr.length];

    // 引用（「…」『…』）を一時保護して原文維持
    const protectedQuotes = [];
    if (opts.keepQuotes) {
      out = out.replace(/「[^」\n]{4,}」|『[^』\n]{4,}』/g, (m) => {
        const key = `@@QUOTE_${protectedQuotes.length}@@`;
        protectedQuotes.push(m);
        return key;
      });
    }

    // 出力文体の決定
    let targetTone = detectDominantTone(out);
    if (opts.preset === 'report-dearu' || opts.preset === 'academic') targetTone = 'dearu';
    else if (opts.preset === 'report-polite' || opts.preset === 'business') targetTone = 'polite';
    else if (opts.preset === 'general') targetTone = 'casual';
    else if (opts.preset === 'profile' && opts.profile) targetTone = opts.profile.tone || targetTone;

    // 1. Markdown・箇条書き装飾の自然化
    if (opts.removeMarkdown) {
      const before = out;
      out = out.replace(/^[\s]*[-*・]\s*\*\*([^*：\n:]+)\*\*[：:]\s*(.+)$/gm, (_, head, body) => {
        return head.trim() + pick(['については、', 'の面では、']) + body.trim();
      });
      out = out.replace(/^[\s]*\d+\.\s*\*\*([^*：\n:]+)\*\*[：:]\s*(.+)$/gm, (_, head, body) => {
        return head.trim() + 'は、' + body.trim();
      });
      out = out.replace(/\*\*([^*\n]+)\*\*/g, '$1');
      out = out.replace(/^#{1,4}\s+(.+)$/gm, '$1');
      if (out !== before) {
        changes.push({ cat: '文章構成', detail: 'AI特有のMarkdown太字や「項目：説明」型の箇条書きを自然な地の文へ整えました。' });
      }
    }

    // 2. 三段論法「まず・次に・最後に」の分散
    if (opts.intensity >= 30) {
      if (/まず、/.test(out) && (/次に、/.test(out) || /最後に、/.test(out))) {
        out = out
          .replace(/まず、/g, () => pick(['最初に、', 'はじめに、']))
          .replace(/次に、/g, () => pick(['あわせて、', 'そのうえで、']))
          .replace(/最後に、/g, () => pick(['そして、', 'もう一点、']));
        changes.push({ cat: '文章構成', detail: '「まず・次に・最後に」の機械的な列挙を自然なつなぎへ分散しました。' });
      }

      const ruleLimit = opts.intensity < 40 ? 14 : REWRITE_RULES.length;
      for (const rule of REWRITE_RULES.slice(0, ruleLimit)) {
        rule.re.lastIndex = 0;
        const pool = rule.variants[targetTone] || rule.variants.polite;
        let count = 0, firstFrom = '', firstTo = '';
        out = out.replace(rule.re, (m) => {
          const rep = pick(pool);
          if (!count) { firstFrom = m; firstTo = rep; }
          count++;
          return rep;
        });
        if (count > 0) {
          changes.push({ cat: rule.cat, detail: `「${firstFrom}」→「${firstTo}」${count > 1 ? `（${count}箇所）` : ''}` });
        }
      }
    }

    // 3. プリセットに応じた文体統一
    if (targetTone === 'dearu') {
      const before = out;
      out = out
        .replace(/しています。/g, 'している。')
        .replace(/しております。/g, 'している。')
        .replace(/できます。/g, 'できる。')
        .replace(/なります。/g, 'なる。')
        .replace(/あります。/g, 'ある。')
        .replace(/いました。/g, 'いた。')
        .replace(/ました。/g, 'た。')
        .replace(/ません。/g, 'ない。')
        .replace(/でしょう。/g, 'だろう。')
        .replace(/です。/g, 'だ。');
      if (out !== before) {
        changes.push({ cat: '文体統一', detail: 'レポート・論考に適した常体（だ・である）に整えました。' });
      }
    } else if (targetTone === 'polite') {
      const before = out;
      out = out
        .replace(/である。/g, 'です。')
        .replace(/している。/g, 'しています。')
        .replace(/できる。/g, 'できます。')
        .replace(/なる。/g, 'なります。')
        .replace(/ある。/g, 'あります。');
      if (out !== before) {
        changes.push({ cat: '文体統一', detail: '自然な敬体（です・ます）に整えました。' });
      }
    } else if (targetTone === 'casual') {
      const before = out;
      out = out
        .replace(/しております。/g, 'しています。')
        .replace(/いたします。/g, 'しますね。')
        .replace(/ございます。/g, 'あります。')
        .replace(/である。/g, 'なんです。');
      if (out !== before) {
        changes.push({ cat: '文体統一', detail: '親しみやすい一般向けの読み口へやわらげました。' });
      }
    }

    // 4. 文末の反復解消
    if (opts.varyEndings) {
      let adjusted = 0;
      out = out.split('\n').map((line) => {
        if (!line.trim()) return line;
        const parts = line.match(/[^。！？!?]+[。！？!?]?/g);
        if (!parts || parts.length < 3) return line;
        let streak = 1, prev = '';
        for (let i = 0; i < parts.length; i++) {
          const e = getEnding(parts[i]);
          if (e !== 'その他' && e === prev) {
            streak++;
            if (streak >= 3) {
              if (parts[i].endsWith('ます。')) {
                parts[i] = parts[i].replace(/ます。$/, pick(['ています。', 'ものです。']));
                adjusted++; streak = 1;
              } else if (parts[i].endsWith('です。')) {
                parts[i] = parts[i].replace(/です。$/, pick(['といえます。', 'のです。']));
                adjusted++; streak = 1;
              } else if (parts[i].endsWith('である。')) {
                parts[i] = parts[i].replace(/である。$/, pick(['といえる。', 'のだ。']));
                adjusted++; streak = 1;
              } else if (parts[i].endsWith('ている。')) {
                parts[i] = parts[i].replace(/ている。$/, pick(['てきた。', 'つつある。']));
                adjusted++; streak = 1;
              }
            }
          } else {
            streak = 1; prev = e;
          }
        }
        return parts.join('');
      }).join('\n');

      if (adjusted > 0) {
        changes.push({ cat: '文末の反復', detail: `同じ文末の連続を ${adjusted} 箇所で調整し、リズムに変化をつけました。` });
      }
    }

    // 5. 高変更度（75以上）で長文分割による緩急調整
    if (opts.intensity >= 75) {
      let splits = 0;
      out = out.replace(/([^。\n]{38,})が、([^。\n]{20,}。)/g, (_, a, b) => {
        splits++;
        return a + (targetTone === 'dearu' ? '。だが、' : '。ただ、') + b;
      });
      if (splits > 0) {
        changes.push({ cat: '文長の特徴', detail: `長めの一文を ${splits} 箇所で区切り、読みやすい緩急をつけました。` });
      }
    }

    // 保護した引用を復元
    protectedQuotes.forEach((q, idx) => {
      out = out.replace(`@@QUOTE_${idx}@@`, q);
    });

    return {
      text: out.replace(/\n{3,}/g, '\n\n').trim(),
      changes
    };
  }

  function buildHighlightHtml(text, matches) {
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (!matches || matches.length === 0) {
      return esc(text).replace(/\n/g, '<br>');
    }
    const catClass = {
      '定型表現': 'hl-phrase',
      '接続詞': 'hl-conj',
      '文末の反復': 'hl-end',
      '文長の特徴': 'hl-len',
      '文章構成': 'hl-struct'
    };
    let html = '';
    let pos = 0;
    matches.forEach((m, idx) => {
      if (m.start > pos) {
        html += esc(text.slice(pos, m.start)).replace(/\n/g, '<br>');
      }
      const cls = catClass[m.cat] || 'hl-phrase';
      html += `<mark class="${cls}" data-match-idx="${idx}" tabindex="0">${esc(m.text)}</mark>`;
      pos = m.end;
    });
    if (pos < text.length) {
      html += esc(text.slice(pos)).replace(/\n/g, '<br>');
    }
    return html;
  }

  function buildDiffHtml(beforeText, afterText) {
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const aLines = (beforeText || '').split('\n');
    const bLines = (afterText || '').split('\n');
    const maxLen = Math.max(aLines.length, bLines.length);
    const out = [];

    for (let i = 0; i < maxLen; i++) {
      const a = aLines[i] ?? '';
      const b = bLines[i] ?? '';
      if (a === b) {
        out.push(`<p class="diff-same">${esc(b) || '&nbsp;'}</p>`);
      } else {
        let start = 0;
        while (start < a.length && start < b.length && a[start] === b[start]) start++;
        let endA = a.length - 1;
        let endB = b.length - 1;
        while (endA >= start && endB >= start && a[endA] === b[endB]) { endA--; endB--; }
        const prefix = esc(a.slice(0, start));
        const delPart = esc(a.slice(start, endA + 1));
        const addPart = esc(b.slice(start, endB + 1));
        const suffix = esc(a.slice(endA + 1));
        out.push(
          `<p class="diff-changed">${prefix}` +
          (delPart ? `<del class="diff-del">${delPart}</del>` : '') +
          (addPart ? `<ins class="diff-ins">${addPart}</ins>` : '') +
          `${suffix}</p>`
        );
      }
    }
    return out.join('');
  }

  global.BunshoEngine = {
    detectAI,
    humanize,
    analyzeProfileSamples,
    buildHighlightHtml,
    buildDiffHtml
  };
})(window);
