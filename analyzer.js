/**
 * 文脈工房 — AI文章判定＆自然文リライト（ヒューマナイズ）エンジン
 * 完全ローカル・オフライン動作
 */
(function (global) {
  'use strict';

  // AIが日本語で頻用する定型表現・翻訳調・硬直表現パターン
  const AI_PATTERNS = [
    // 定型結び・断定回避
    { re: /と言えるでしょう/g, cat: 'AI定型表現', weight: 9, reason: 'LLMが結論やまとめで非常に多用する定型句です' },
    { re: /といえるでしょう/g, cat: 'AI定型表現', weight: 8, reason: 'LLMが結論やまとめで非常に多用する定型句です' },
    { re: /かもしれません(?:ね)?/g, cat: 'AI定型表現', weight: 3, reason: '曖昧な締めくくりが多用される傾向があります' },
    { re: /ではないでしょうか/g, cat: 'AI定型表現', weight: 4, reason: '問いかけ調の定型結びです' },
    { re: /重要な役割を果た(?:します|しています|す|している)/g, cat: 'AI定型表現', weight: 10, reason: '「play an important role」の直訳調AI頻出フレーズです' },
    { re: /大きな役割を果た(?:します|しています|す|している)/g, cat: 'AI定型表現', weight: 9, reason: '翻訳調のAI頻出フレーズです' },
    { re: /不可欠(?:な要素)?(?:です|である|と言えます|といえます)/g, cat: 'AI定型表現', weight: 7, reason: 'AIが強調のために頻用する硬い表現です' },
    { re: /ますます高まって(?:います|いる)/g, cat: 'AI定型表現', weight: 9, reason: 'AIが導入文で頻用する常套句です' },
    { re: /注目が集まって(?:います|いる)/g, cat: 'AI定型表現', weight: 7, reason: 'AIが導入文で頻用する常套句です' },
    { re: /期待されて(?:います|いる)/g, cat: 'AI定型表現', weight: 5, reason: '受動態の一般的な締めフレーズです' },
    { re: /以上のことから/g, cat: '構成の定型化', weight: 9, reason: 'AIがまとめ段落の冒頭で多用する接続表現です' },
    { re: /結論として(?:は)?/g, cat: '構成の定型化', weight: 8, reason: 'AIが最終段落で機械的に置きがちな表現です' },
    { re: /まとめると/g, cat: '構成の定型化', weight: 7, reason: 'AIが要約段落の冒頭で多用する表現です' },
    { re: /総じて/g, cat: '構成の定型化', weight: 8, reason: 'AIが総括で好んで使う硬い副詞です' },
    { re: /本記事では|この記事では/g, cat: 'AI定型表現', weight: 7, reason: 'AI生成ブログ記事の典型的な導入句です' },
    { re: /詳しく解説(?:します|していきます|いたします)/g, cat: 'AI定型表現', weight: 8, reason: 'AI生成記事の導入で頻用される定型句です' },
    { re: /ご紹介(?:します|していきます|いたします)/g, cat: 'AI定型表現', weight: 5, reason: 'テンプレート的な導入表現です' },
    // 翻訳調・冗長表現
    { re: /することが可能です/g, cat: '翻訳調・冗長', weight: 8, reason: '「〜できます」で済む箇所を冗長にするAI特有の言い回しです' },
    { re: /することが可能(?:である|だ|になります)/g, cat: '翻訳調・冗長', weight: 8, reason: '冗長な可能表現（〜できる）です' },
    { re: /を行う(?:こと|必要|際|場合)/g, cat: '翻訳調・冗長', weight: 6, reason: '動詞を名詞化＋「行う」にする硬い表現です' },
    { re: /を行って(?:います|いる)/g, cat: '翻訳調・冗長', weight: 5, reason: '硬直した動詞表現です' },
    { re: /という点において/g, cat: '翻訳調・冗長', weight: 8, reason: '冗長な接続句です' },
    { re: /の観点から(?:見ると|は|も)?/g, cat: '翻訳調・冗長', weight: 7, reason: '「from the perspective of」風の頻出表現です' },
    { re: /において(?:は|も)?/g, cat: '翻訳調・冗長', weight: 4, reason: '硬い書き言葉が集中するとAI感が増します' },
    { re: /をもたら(?:します|す|しています|している)/g, cat: '翻訳調・冗長', weight: 7, reason: '「bring / yield」の直訳調表現です' },
    { re: /に寄与(?:します|する|しています)/g, cat: '翻訳調・冗長', weight: 7, reason: '硬い漢語表現です' },
    { re: /を促進(?:します|する|しています)/g, cat: '翻訳調・冗長', weight: 6, reason: '硬い漢語表現です' },
    { re: /を向上させ(?:ます|る|ています)/g, cat: '翻訳調・冗長', weight: 5, reason: 'AIがメリット説明で頻用する表現です' },
    { re: /効果的に活用(?:する|します|できます|できる)/g, cat: 'AI定型表現', weight: 7, reason: 'AIが提案文で頻用する抽象表現です' },
    { re: /包括的(?:な|に)/g, cat: 'AI好物語彙', weight: 8, reason: '「comprehensive」の訳語としてAIが好む語彙です' },
    { re: /多角的(?:な|に)/g, cat: 'AI好物語彙', weight: 8, reason: 'AIが分析・視点を語る際に頻用する語彙です' },
    { re: /シームレス(?:な|に)/g, cat: 'AI好物語彙', weight: 7, reason: 'AIがUXや連携を語る際に頻用するカタカナ語です' },
    { re: /イノベーション|パラダイムシフト|最適化/g, cat: 'AI好物語彙', weight: 5, reason: '抽象度の高いバズワードです' },
    { re: /さまざまなメリット|多くのメリット|数々の利点/g, cat: 'AI定型表現', weight: 6, reason: '具体性の薄い総称表現です' },
    { re: /一方で、/g, cat: '構成の定型化', weight: 5, reason: 'AIが対比構造を作るときに高頻度で使う接続詞です' },
    { re: /さらに、/g, cat: '構成の定型化', weight: 4, reason: 'AIが段落や文をつなぐ際に多用する接続詞です' },
    { re: /したがって、/g, cat: '構成の定型化', weight: 6, reason: '論理展開で機械的に置かれやすい接続詞です' },
    { re: /しかしながら、/g, cat: '構成の定型化', weight: 6, reason: '硬い逆接表現でAI文に多く見られます' },
    { re: /まず、|次に、|最後に、/g, cat: '構成の定型化', weight: 5, reason: '「まず・次に・最後に」の三段論法はAIの典型パターンです' }
  ];

  // リライト置換ルール（バリエーション付き）
  const REWRITE_RULES = [
    // AI定型・結論
    {
      re: /重要な役割を果たしています/g,
      cat: 'AI定型句をやわらげる',
      variants: {
        polite: ['大きなカギを握っています', '欠かせない存在になっています', 'とても大切なポイントです'],
        casual: ['かなり大きなカギを握ってるんです', 'なくてはならない存在です', 'すごく大事なところですね'],
        dearu: ['大きなカギを握っている', '欠かせない存在となっている', '重要なポイントになっている']
      }
    },
    {
      re: /重要な役割を果たします/g,
      cat: 'AI定型句をやわらげる',
      variants: {
        polite: ['大きなカギを握ります', 'とても大切なポイントになります', '欠かせません'],
        casual: ['すごく大事なポイントになります', 'かなり効いてきます', '外せないところです'],
        dearu: ['大きなカギを握る', '大切なポイントになる', '欠かせない']
      }
    },
    {
      re: /大きな役割を果たして(?:います|いる)/g,
      cat: 'AI定型句をやわらげる',
      variants: {
        polite: ['大きな支えになっています', 'しっかり効いています'],
        casual: ['かなり助けになってます', 'すごく効いてます'],
        dearu: ['大きな支えとなっている', '確かな働きをしている']
      }
    },
    {
      re: /と言えるでしょう|といえるでしょう/g,
      cat: 'AI定型句をやわらげる',
      variants: {
        polite: ['といえそうです', 'と考えてよさそうです', 'と言っても過言ではありません', 'と感じます'],
        casual: ['と言っていいと思います', 'じゃないかなと思います', 'と言えそうですね'],
        dearu: ['といえそうだ', 'と見てよい', 'に違いない']
      }
    },
    {
      re: /不可欠な要素です|不可欠です/g,
      cat: '硬い表現をやわらげる',
      variants: {
        polite: ['欠かせません', '外せないポイントです', 'どうしても必要になります'],
        casual: ['絶対外せません', 'ないと困るんですよね', '欠かせません'],
        dearu: ['欠かせない', '外せない要素だ', 'なくてはならない']
      }
    },
    {
      re: /ますます高まっています/g,
      cat: 'AI導入句を自然化',
      variants: {
        polite: ['以前よりずっと大きくなっています', 'ぐっと高まってきました', '年々増しています'],
        casual: ['どんどん高まってきてます', '前よりずっと気になってきてます'],
        dearu: ['以前にも増して高まっている', '年々大きくなっている']
      }
    },
    {
      re: /注目が集まっています/g,
      cat: 'AI導入句を自然化',
      variants: {
        polite: ['関心を持つ人が増えています', '話題になることが増えてきました'],
        casual: ['気にする人が増えてますよね', 'けっこう話題になってます'],
        dearu: ['関心を持つ人が増えている', '話題にのぼることが多くなった']
      }
    },
    {
      re: /本記事では、?/g,
      cat: 'AI記事導入を自然化',
      variants: {
        polite: ['ここでは、', '今回は、', 'これから、'],
        casual: ['今回は、', 'ここでは、'],
        dearu: ['ここでは、', '本稿では、']
      }
    },
    {
      re: /この記事では、?/g,
      cat: 'AI記事導入を自然化',
      variants: {
        polite: ['ここでは、', '今回は、'],
        casual: ['今回は、', 'ここでは、'],
        dearu: ['ここでは、', '今回は、']
      }
    },
    {
      re: /詳しく解説します|詳しく解説していきます/g,
      cat: 'AI記事導入を自然化',
      variants: {
        polite: ['わかりやすく整理していきます', '順を追って見ていきます', '具体的に掘り下げてみます'],
        casual: ['噛み砕いて話していきますね', '順番に見ていきましょう'],
        dearu: ['具体的に掘り下げていく', '順を追って整理する']
      }
    },
    // 翻訳調・冗長表現
    {
      re: /することが可能です/g,
      cat: '冗長な可能表現を簡潔化',
      variants: {
        polite: ['できます', 'できるようになります', 'こともできます'],
        casual: ['できちゃいます', 'できますよ', 'できます'],
        dearu: ['できる', 'できるようになる']
      }
    },
    {
      re: /することが可能(?:である|だ)/g,
      cat: '冗長な可能表現を簡潔化',
      variants: {
        polite: ['できます'],
        casual: ['できます'],
        dearu: ['できる', 'できるようになる']
      }
    },
    {
      re: /を行うことが(?:でき|可能)/g,
      cat: '冗長な表現を簡潔化',
      variants: {
        polite: ['を進められ', 'をこなせ'],
        casual: ['をサクッと進められ', 'をこなせ'],
        dearu: ['を進められ', 'をこなせ']
      }
    },
    {
      re: /という点において/g,
      cat: '翻訳調を自然化',
      variants: {
        polite: ['という面では', 'という点で'],
        casual: ['って点では', 'という面で'],
        dearu: ['という面では', 'という点で']
      }
    },
    {
      re: /の観点から見ると|の観点から/g,
      cat: '翻訳調を自然化',
      variants: {
        polite: ['の面から見ると', 'という視点で見ると', 'に注目すると'],
        casual: ['の面から見ると', 'って見方をすると'],
        dearu: ['の面から見ると', 'という視点では']
      }
    },
    {
      re: /をもたらします/g,
      cat: '翻訳調を自然化',
      variants: {
        polite: ['につながります', 'を生みます', 'を作ってくれます'],
        casual: ['につながりますよ', 'を生んでくれます'],
        dearu: ['につながる', 'を生む']
      }
    },
    {
      re: /に寄与します/g,
      cat: '硬い漢語をやわらげる',
      variants: {
        polite: ['に役立ちます', 'を後押しします', 'に貢献します'],
        casual: ['に役立ちます', 'のいい後押しになります'],
        dearu: ['に役立つ', 'を後押しする']
      }
    },
    {
      re: /を促進します/g,
      cat: '硬い漢語をやわらげる',
      variants: {
        polite: ['をスムーズに進めます', 'を後押しします', 'を促します'],
        casual: ['をグッと進めやすくします', 'を後押ししてくれます'],
        dearu: ['を後押しする', 'を促す']
      }
    },
    {
      re: /を向上させます/g,
      cat: '硬い漢語をやわらげる',
      variants: {
        polite: ['を引き上げます', 'をもっと良くします', 'を高めます'],
        casual: ['をぐっと引き上げます', 'をもっと良くしてくれます'],
        dearu: ['を引き上げる', 'を高める']
      }
    },
    {
      re: /効果的に活用する/g,
      cat: '抽象表現を具体化',
      variants: {
        polite: ['うまく活かす', '上手に取り入れる'],
        casual: ['うまく使う', '上手に取り入れる'],
        dearu: ['うまく活かす', '上手に取り入れる']
      }
    },
    {
      re: /効果的に活用します/g,
      cat: '抽象表現を具体化',
      variants: {
        polite: ['うまく活かします', '上手に取り入れます'],
        casual: ['うまく使います', '上手に取り入れます'],
        dearu: ['うまく活かす', '上手に取り入れる']
      }
    },
    {
      re: /包括的な/g,
      cat: 'AI好物語彙をやわらげる',
      variants: {
        polite: ['全体を見渡した', '幅広い', 'まるごとの'],
        casual: ['まるっとした', '幅広い'],
        dearu: ['全体を見渡した', '幅広い']
      }
    },
    {
      re: /包括的に/g,
      cat: 'AI好物語彙をやわらげる',
      variants: {
        polite: ['全体をまとめて', '幅広く'],
        casual: ['まるっとまとめて', '幅広く'],
        dearu: ['全体をまとめて', '幅広く']
      }
    },
    {
      re: /多角的な/g,
      cat: 'AI好物語彙をやわらげる',
      variants: {
        polite: ['いろいろな角度からの', '複数の視点からの'],
        casual: ['いろんな角度からの', 'いくつもの視点からの'],
        dearu: ['さまざまな角度からの', '複数の視点からの']
      }
    },
    {
      re: /多角的に/g,
      cat: 'AI好物語彙をやわらげる',
      variants: {
        polite: ['いろいろな角度から', '視点を変えながら'],
        casual: ['いろんな角度から', '視点を変えつつ'],
        dearu: ['さまざまな角度から', '視点を変えながら']
      }
    },
    {
      re: /シームレスに/g,
      cat: 'AI好物語彙をやわらげる',
      variants: {
        polite: ['途切れなく', 'スムーズに', '引っかかりなく'],
        casual: ['スムーズに', '違和感なく'],
        dearu: ['途切れなく', 'スムーズに']
      }
    },
    {
      re: /さまざまなメリットがあります/g,
      cat: '抽象表現を自然化',
      variants: {
        polite: ['うれしい利点がいくつもあります', '良い面がたくさんあります'],
        casual: ['いいことが結構あるんですよね', '助かるポイントがいくつもあります'],
        dearu: ['いくつもの利点がある', '良い面は少なくない']
      }
    },
    // 機械的接続詞の分散
    {
      re: /以上のことから、/g,
      cat: '機械的な結びを自然化',
      variants: {
        polite: ['こうした点を踏まえると、', 'ここまで見てきた通り、', 'こう考えると、'],
        casual: ['こんな感じで、', 'ここまでを踏まえると、'],
        dearu: ['こうした点を踏まえると、', 'ここまで見てきたように、']
      }
    },
    {
      re: /結論として、/g,
      cat: '機械的な結びを自然化',
      variants: {
        polite: ['つまり、', 'ひと言でいえば、', '結局のところ、'],
        casual: ['結局のところ、', 'ざっくり言うと、'],
        dearu: ['つまり、', '要するに、']
      }
    },
    {
      re: /まとめると、/g,
      cat: '機械的な結びを自然化',
      variants: {
        polite: ['振り返ってみると、', '要点を押さえると、', 'ここまでを整理すると、'],
        casual: ['ざっと振り返ると、', '要は、'],
        dearu: ['振り返ってみると、', '要点を整理すると、']
      }
    },
    {
      re: /総じて、/g,
      cat: '機械的な結びを自然化',
      variants: {
        polite: ['全体を通して見ると、', 'トータルで見れば、'],
        casual: ['全体としては、', 'トータルで見ると、'],
        dearu: ['全体を通して見ると、', 'おおむね、']
      }
    },
    {
      re: /しかしながら、/g,
      cat: '硬い接続詞をやわらげる',
      variants: {
        polite: ['ただ、', 'とはいえ、', 'もっとも、'],
        casual: ['でも、', 'ただ、', 'とはいえ、'],
        dearu: ['だが、', 'とはいえ、', 'もっとも、']
      }
    },
    {
      re: /したがって、/g,
      cat: '硬い接続詞をやわらげる',
      variants: {
        polite: ['そのため、', 'だからこそ、', 'なので、'],
        casual: ['だから、', 'なので、'],
        dearu: ['そのため、', 'だからこそ、']
      }
    },
    {
      re: /一方で、/g,
      cat: '接続詞の単調さを解消',
      variants: {
        polite: ['ただ、', 'その反面、', '反対に、', 'とはいえ、'],
        casual: ['ただ、', 'その一方で、', '逆に、'],
        dearu: ['その反面、', '他方で、', '逆に、']
      }
    },
    {
      re: /さらに、/g,
      cat: '接続詞の単調さを解消',
      variants: {
        polite: ['加えて、', 'それだけでなく、', 'あわせて、'],
        casual: ['しかも、', 'それに加えて、', 'あと、'],
        dearu: ['加えて、', 'それだけでなく、', 'さらに言えば、']
      }
    }
  ];

  function splitSentences(text) {
    const clean = text.replace(/\r\n/g, '\n');
    const rawParts = clean.match(/[^。！？!?\n]+[。！？!?]?/g) || [];
    return rawParts.map((s) => s.trim()).filter((s) => s.length > 0);
  }

  function getEnding(sentence) {
    const s = sentence.replace(/[。！？!?\s」』）)]+$/g, '');
    const endings = ['ています', 'ました', 'ません', 'でしょう', 'である', 'だった', 'ている', 'です', 'ます', 'した', 'する', 'ない', 'だ', 'た'];
    for (const e of endings) {
      if (s.endsWith(e)) return e;
    }
    return '';
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
   * AI文章判定エンジン
   */
  function detectAI(text) {
    const trimmed = (text || '').trim();
    if (!trimmed) {
      return {
        score: 0,
        label: '未判定',
        level: 'none',
        summary: '文章を入力して「AI度合いを判定」を押してください。',
        metrics: {
          phrase: 0,
          structure: 0,
          uniformity: 0,
          ending: 0,
          formatting: 0,
          translation: 0
        },
        stats: { chars: 0, sentences: 0, avgLen: 0, burstiness: 0 },
        matches: []
      };
    }

    const sentences = splitSentences(trimmed);
    const chars = trimmed.replace(/\s/g, '').length;
    const scale = Math.max(1, chars / 220);

    // 1. パターン検出
    const matches = [];
    let phrasePoints = 0;
    let structurePoints = 0;
    let translationPoints = 0;

    for (const p of AI_PATTERNS) {
      p.re.lastIndex = 0;
      let m;
      while ((m = p.re.exec(trimmed)) !== null) {
        matches.push({
          start: m.index,
          end: m.index + m[0].length,
          text: m[0],
          cat: p.cat,
          reason: p.reason,
          weight: p.weight
        });
        if (p.cat === '構成の定型化') structurePoints += p.weight;
        else if (p.cat === '翻訳調・冗長') translationPoints += p.weight;
        else phrasePoints += p.weight;
      }
    }

    // 重複マッチの整理（開始位置順）
    matches.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
    const dedupMatches = [];
    let lastEnd = -1;
    for (const m of matches) {
      if (m.start >= lastEnd) {
        dedupMatches.push(m);
        lastEnd = m.end;
      }
    }

    // 2. 文長の均一性（Burstiness：人間は文長にばらつきがある）
    const lens = sentences.map((s) => s.length).filter((n) => n >= 4);
    let avgLen = 0;
    let cv = 0;
    let uniformityScore = 0;
    if (lens.length >= 3) {
      avgLen = lens.reduce((a, b) => a + b, 0) / lens.length;
      const variance = lens.reduce((acc, n) => acc + Math.pow(n - avgLen, 2), 0) / lens.length;
      const std = Math.sqrt(variance);
      cv = avgLen > 0 ? std / avgLen : 0;
      // CVが低い（0.25未満）ほど文長が均一＝AI的
      if (cv < 0.22) uniformityScore = 88;
      else if (cv < 0.32) uniformityScore = 68;
      else if (cv < 0.42) uniformityScore = 44;
      else if (cv < 0.52) uniformityScore = 24;
      else uniformityScore = 10;
    } else {
      avgLen = lens.length ? lens[0] : chars;
      uniformityScore = 20;
    }

    // 3. 語尾の単調さ
    let repeatPairs = 0;
    let totalPairs = 0;
    let prevEnd = '';
    for (const s of sentences) {
      const end = getEnding(s);
      if (end && prevEnd) {
        totalPairs++;
        if (end === prevEnd) repeatPairs++;
      }
      prevEnd = end;
    }
    const endingRatio = totalPairs > 0 ? repeatPairs / totalPairs : 0;
    const endingScore = Math.min(100, Math.round(endingRatio * 145));

    // 4. Markdown・過剰装飾の痕跡
    let fmtPoints = 0;
    const boldCount = (trimmed.match(/\*\*[^*]+\*\*/g) || []).length;
    const bulletColonCount = (trimmed.match(/^[\s]*[-*・\d+\.]+\s*(?:\*\*)?[^：\n:]{2,18}(?:\*\*)?[：:]/gm) || []).length;
    const headingCount = (trimmed.match(/^#{1,4}\s+/gm) || []).length;
    fmtPoints += boldCount * 16 + bulletColonCount * 22 + headingCount * 10;
    const formattingScore = Math.min(100, Math.round(fmtPoints));

    // 各カテゴリスコア正規化 (0-100)
    const phraseScore = Math.min(100, Math.round((phrasePoints / scale) * 3.8));
    const structureScore = Math.min(100, Math.round((structurePoints / scale) * 4.5));
    const translationScore = Math.min(100, Math.round((translationPoints / scale) * 4.2));

    // 総合AIスコア（加重平均 + 検出数ボーナス）
    let rawTotal =
      phraseScore * 0.28 +
      structureScore * 0.18 +
      translationScore * 0.18 +
      uniformityScore * 0.14 +
      endingScore * 0.10 +
      formattingScore * 0.12;

    if (dedupMatches.length >= 4) rawTotal += 8;
    if (dedupMatches.length >= 7) rawTotal += 8;
    if (chars < 30) rawTotal *= 0.6;

    const score = Math.max(2, Math.min(98, Math.round(rawTotal)));

    let label = '人間らしい自然な文章';
    let level = 'human';
    let summary = 'AI特有の定型句や機械的な均一さは少なく、自然な書き手の文章と判定されました。';
    if (score >= 72) {
      label = 'AI生成の可能性が非常に高い';
      level = 'high';
      summary = 'AI特有の定型フレーズ・硬い翻訳調・構成パターンが複数検出されました。自然文リライトの効果が高い文章です。';
    } else if (score >= 48) {
      label = 'AI生成の傾向あり';
      level = 'mid';
      summary = '一部にAIらしい言い回しやリズムの単調さが見られます。表現をやわらげるとぐっと自然になります。';
    } else if (score >= 28) {
      label = 'やや硬め（軽度のAI傾向）';
      level = 'low';
      summary = '全体的には自然ですが、数箇所の硬い表現や語尾を整えるとさらに読みやすくなります。';
    }

    return {
      score,
      label,
      level,
      summary,
      metrics: {
        phrase: phraseScore,
        structure: structureScore,
        uniformity: uniformityScore,
        ending: endingScore,
        formatting: formattingScore,
        translation: translationScore
      },
      stats: {
        chars,
        sentences: sentences.length,
        avgLen: Math.round(avgLen),
        burstiness: Number(cv.toFixed(2))
      },
      matches: dedupMatches
    };
  }

  /**
   * 人間らしい自然な日本語へ変換（ヒューマナイズ）
   */
  function humanize(text, options) {
    const opts = Object.assign({
      strength: 'standard', // gentle | standard | strong
      tone: 'keep',         // keep | polite | casual | dearu
      removeMarkdown: true,
      varyEndings: true,
      softenPhrases: true,
      seed: 0
    }, options || {});

    let out = (text || '').replace(/\r\n/g, '\n');
    const changes = [];
    const targetTone = opts.tone === 'keep' ? detectDominantTone(out) : opts.tone;
    let variantCursor = opts.seed || 0;

    function pick(arr) {
      const idx = variantCursor % arr.length;
      variantCursor++;
      return arr[idx];
    }

    // Step 1: Markdown / 過剰な記号フォーマットの自然化
    if (opts.removeMarkdown) {
      const beforeFmt = out;
      // 「- **項目**：説明」→「項目については、説明」または自然な段落文へ
      out = out.replace(/^[\s]*[-*・]\s*\*\*([^*：\n:]+)\*\*[：:]\s*(.+)$/gm, (_, head, body) => {
        const connectors = ['については、', 'の面では、', 'に関して言うと、'];
        return head.trim() + pick(connectors) + body.trim();
      });
      // 「1. **項目**：説明」→自然な文へ
      out = out.replace(/^[\s]*\d+\.\s*\*\*([^*：\n:]+)\*\*[：:]\s*(.+)$/gm, (_, head, body) => {
        return head.trim() + 'は、' + body.trim();
      });
      // 残りの **太字** を解除
      out = out.replace(/\*\*([^*\n]+)\*\*/g, '$1');
      // 「### 見出し」の記号を外して自然な小見出しに
      out = out.replace(/^#{1,4}\s+(.+)$/gm, '【$1】');

      if (out !== beforeFmt) {
        changes.push({
          cat: '装飾の自然化',
          detail: 'AI特有のMarkdown太字（**）や「項目：説明」型の箇条書きを自然な文章へ整えました。'
        });
      }
    }

    // Step 2: 三段論法「まず、〜次に、〜最後に、」の分散
    if (opts.softenPhrases) {
      const hasTriad = /まず、/.test(out) && (/次に、/.test(out) || /最後に、/.test(out));
      if (hasTriad) {
        out = out
          .replace(/まず、/g, () => pick(['最初に、', 'はじめに、', 'まず押さえたいのは、']))
          .replace(/次に、/g, () => pick(['あわせて、', 'そのうえで、', 'もうひとつ大切なのが、']))
          .replace(/最後に、/g, () => pick(['そして仕上げに、', '最後に触れておきたいのは、', 'もう一点、']));
        changes.push({
          cat: '構成の単調さを解消',
          detail: '「まず・次に・最後に」の定型列挙を自然なつなぎ言葉へ分散しました。'
        });
      }

      // 強度に応じた置換ルール適用
      const rulesToApply = opts.strength === 'gentle'
        ? REWRITE_RULES.slice(0, 18)
        : REWRITE_RULES;

      for (const rule of rulesToApply) {
        rule.re.lastIndex = 0;
        const pool = rule.variants[targetTone] || rule.variants.polite;
        let replacedCount = 0;
        let firstFrom = '';
        let firstTo = '';

        out = out.replace(rule.re, (match) => {
          const rep = pick(pool);
          if (!replacedCount) {
            firstFrom = match;
            firstTo = rep;
          }
          replacedCount++;
          return rep;
        });

        if (replacedCount > 0) {
          changes.push({
            cat: rule.cat,
            detail: `「${firstFrom}」→「${firstTo}」${replacedCount > 1 ? `（計${replacedCount}箇所）` : ''}`
          });
        }
      }
    }

    // Step 3: 文体ターゲットへの調整
    if (opts.tone === 'casual') {
      const beforeTone = out;
      out = out
        .replace(/しております。/g, 'しています。')
        .replace(/いたします。/g, 'しますね。')
        .replace(/ございます。/g, 'あります。')
        .replace(/である。/g, 'なんです。')
        .replace(/ではないだろうか。/g, 'じゃないでしょうか。')
        .replace(/といえる。/g, 'と言えそうです。');
      if (out !== beforeTone) {
        changes.push({ cat: '文体調整', detail: '親しみやすい話し言葉寄りのトーンへ調整しました。' });
      }
    } else if (opts.tone === 'dearu') {
      const beforeTone = out;
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
      if (out !== beforeTone) {
        changes.push({ cat: '文体調整', detail: '引き締まった「だ・である」調へ統一しました。' });
      }
    } else if (opts.tone === 'polite') {
      const beforeTone = out;
      out = out
        .replace(/である。/g, 'です。')
        .replace(/している。/g, 'しています。')
        .replace(/できる。/g, 'できます。')
        .replace(/なる。/g, 'なります。')
        .replace(/ある。/g, 'あります。');
      if (out !== beforeTone) {
        changes.push({ cat: '文体調整', detail: '丁寧な「です・ます」調へ整えました。' });
      }
    }

    // Step 4: 語尾の単調さ（3連続）を崩してリズムに緩急をつける
    if (opts.varyEndings) {
      const lines = out.split('\n');
      let endingAdjusted = 0;

      const processedLines = lines.map((line) => {
        if (!line.trim()) return line;
        const parts = line.match(/[^。！？!?]+[。！？!?]?/g);
        if (!parts || parts.length < 3) return line;

        let streak = 1;
        let prev = '';
        for (let i = 0; i < parts.length; i++) {
          const end = getEnding(parts[i]);
          if (end && end === prev) {
            streak++;
            if (streak >= 3) {
              // 3文目の語尾を自然に言い換え
              if (parts[i].endsWith('ます。')) {
                parts[i] = parts[i].replace(/ます。$/, pick(['ています。', 'ますね。', 'ものです。']));
                endingAdjusted++;
                streak = 1;
              } else if (parts[i].endsWith('です。')) {
                parts[i] = parts[i].replace(/です。$/, pick(['といえます。', 'ではないでしょうか。', 'のです。']));
                endingAdjusted++;
                streak = 1;
              } else if (parts[i].endsWith('である。')) {
                parts[i] = parts[i].replace(/である。$/, pick(['といえる。', 'のだ。', 'にほかならない。']));
                endingAdjusted++;
                streak = 1;
              }
            }
          } else {
            streak = 1;
            prev = end;
          }
        }
        return parts.join('');
      });

      out = processedLines.join('\n');
      if (endingAdjusted > 0) {
        changes.push({
          cat: '語尾リズム調整',
          detail: `同じ語尾の連続を ${endingAdjusted} 箇所やわらげ、文末に自然な変化をつけました。`
        });
      }
    }

    // Step 5: 強めモード — 長すぎる均一文を自然な切れ目で分割してBurstinessを上げる
    if (opts.strength === 'strong') {
      let splitCount = 0;
      out = out.replace(/([^。\n]{38,})が、([^。\n]{22,}。)/g, (m, a, b) => {
        splitCount++;
        const bridge = targetTone === 'dearu' ? '。だが、' : '。ただ、';
        return a + bridge + b;
      });
      if (splitCount > 0) {
        changes.push({
          cat: '文長の緩急調整',
          detail: `長い一文を ${splitCount} 箇所で分割し、人間らしいリズムの緩急をつけました。`
        });
      }
    }

    // 余分な連続空行を整理
    out = out.replace(/\n{3,}/g, '\n\n').trim();

    return {
      text: out,
      changes
    };
  }

  /**
   * 簡易差分ハイライトHTML生成（文単位＋文字単位の視覚比較）
   */
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
        // 共通接頭・接尾を抜き出して変更箇所を強調
        let start = 0;
        while (start < a.length && start < b.length && a[start] === b[start]) start++;
        let endA = a.length - 1;
        let endB = b.length - 1;
        while (endA >= start && endB >= start && a[endA] === b[endB]) {
          endA--;
          endB--;
        }
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

  /**
   * 原文内のAI検出箇所をハイライトHTML化
   */
  function buildHighlightHtml(text, matches) {
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (!matches || matches.length === 0) {
      return esc(text).replace(/\n/g, '<br>');
    }
    let html = '';
    let pos = 0;
    for (const m of matches) {
      if (m.start > pos) {
        html += esc(text.slice(pos, m.start)).replace(/\n/g, '<br>');
      }
      const cls = m.weight >= 8 ? 'hl-high' : m.weight >= 5 ? 'hl-mid' : 'hl-low';
      html += `<mark class="${cls}" title="${esc(m.cat + '：' + m.reason)}">${esc(m.text)}</mark>`;
      pos = m.end;
    }
    if (pos < text.length) {
      html += esc(text.slice(pos)).replace(/\n/g, '<br>');
    }
    return html;
  }

  global.BunshoEngine = {
    detectAI,
    humanize,
    buildDiffHtml,
    buildHighlightHtml
  };
})(window);
