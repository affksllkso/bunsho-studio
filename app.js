/**
 * 文脈工房 — AI文章判定＆自然文リライトPWA メインアプリケーション
 */
(function () {
  'use strict';

  const HISTORY_KEY = 'bunsho_humanizer_history_v1';
  const THEME_KEY = 'bunsho_studio_theme';
  const API_KEY_STORAGE = 'bunsho_gemini_api_key';

  const SAMPLES = {
    'ai-blog': [
      '本記事では、リモートワークにおける生産性向上のコツについて詳しく解説します。近年、働き方の多様化に伴い、自宅での業務効率化への注目が集まっています。',
      '',
      'まず、作業環境を整えることが重要な役割を果たします。さらに、適切な休憩を取り入れることで集中力を向上させます。一方で、コミュニケーション不足に陥るリスクもあると言えるでしょう。',
      '',
      '- **タスクの可視化**：優先順位を明確にすることで、業務を効率的に進めることが可能です。',
      '- **ツールの活用**：チャットツールをシームレスに連携させることで、情報共有を促進します。',
      '',
      '以上のことから、多角的な視点で環境を見直すことが不可欠です。結論として、日々の小さな工夫が大きな成果をもたらします。'
    ].join('\n'),
    'ai-biz': [
      '新サービスの導入プロジェクトについてご報告いたします。現在の市場環境において、顧客体験の最適化はますます高まっています。',
      '',
      'まず、ユーザー調査を実施し、包括的な課題抽出を行いました。次に、業務フローの見直しを行うことが可能です。しかしながら、初期コストの観点からは慎重な判断が求められます。',
      '',
      '最後に、社内研修を効果的に活用することで定着に寄与します。総じて、本施策は中長期的な成長に重要な役割を果たすと言えるでしょう。'
    ].join('\n'),
    'human': [
      '先週から朝の散歩を始めてみた。最初は10分だけでも眠くて仕方なかったのに、3日ほど続けると意外と頭がすっきりしてくる。',
      '',
      'スマホをポケットにしまったまま近所の川沿いを歩いていると、普段は素通りしていたパン屋の匂いに気づいたりする。大きな目標を立てたわけじゃないけれど、こういう小さな気分転換があるだけで午前中の仕事がずいぶん楽になった気がする。'
    ].join('\n')
  };

  let history = [];
  let variantSeed = 0;
  let lastBeforeScore = null;
  let deferredInstallPrompt = null;
  let toastTimer = null;

  const $ = (id) => document.getElementById(id);
  const el = {
    inputText: $('inputText'),
    outputText: $('outputText'),
    inputChars: $('inputChars'),
    inputSentences: $('inputSentences'),
    optStrength: $('optStrength'),
    optTone: $('optTone'),
    chkSoften: $('chkSoften'),
    chkMarkdown: $('chkMarkdown'),
    chkEndings: $('chkEndings'),
    btnDetect: $('btnDetect'),
    btnHumanize: $('btnHumanize'),
    btnAiRewrite: $('btnAiRewrite'),
    gaugeArc: $('gaugeArc'),
    scoreValue: $('scoreValue'),
    scoreLabel: $('scoreLabel'),
    scoreDelta: $('scoreDelta'),
    scoreSummary: $('scoreSummary'),
    statAvgLen: $('statAvgLen'),
    statBurst: $('statBurst'),
    statMatches: $('statMatches'),
    mPhrase: $('mPhrase'),
    mStructure: $('mStructure'),
    mTranslation: $('mTranslation'),
    mUniformity: $('mUniformity'),
    mEnding: $('mEnding'),
    mFormatting: $('mFormatting'),
    barPhrase: $('barPhrase'),
    barStructure: $('barStructure'),
    barTranslation: $('barTranslation'),
    barUniformity: $('barUniformity'),
    barEnding: $('barEnding'),
    barFormatting: $('barFormatting'),
    afterScoreText: $('afterScoreText'),
    highlightBox: $('highlightBox'),
    diffBox: $('diffBox'),
    changesList: $('changesList'),
    changeCount: $('changeCount'),
    historyCount: $('historyCount'),
    historyList: $('historyList'),
    historyModal: $('historyModal'),
    apiModal: $('apiModal'),
    inputApiKey: $('inputApiKey'),
    btnInstallPwa: $('btnInstallPwa'),
    onlineStatus: $('onlineStatus'),
    iconSun: $('iconSun'),
    iconMoon: $('iconMoon'),
    toast: $('toast')
  };

  function showToast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.add('hidden'), 2400);
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function scoreColor(score) {
    if (score >= 72) return 'var(--danger)';
    if (score >= 48) return 'var(--warn)';
    if (score >= 28) return 'var(--indigo)';
    return 'var(--ok)';
  }

  function updateInputCounts() {
    const text = el.inputText.value;
    const chars = text.replace(/\s/g, '').length;
    const sents = (text.match(/[^。！？!?\n]+[。！？!?]?/g) || []).filter((s) => s.trim()).length;
    el.inputChars.textContent = chars.toLocaleString();
    el.inputSentences.textContent = sents;
  }

  function renderDetection(res, beforeScoreForDelta) {
    const circumference = 314.16;
    const offset = circumference * (1 - res.score / 100);
    el.gaugeArc.style.strokeDashoffset = String(offset);
    el.gaugeArc.style.stroke = scoreColor(res.score);
    el.scoreValue.textContent = res.stats.chars > 0 ? `${res.score}%` : '—';

    el.scoreLabel.textContent = res.label;
    el.scoreLabel.className = `score-badge level-${res.level}`;
    el.scoreSummary.textContent = res.summary;

    if (typeof beforeScoreForDelta === 'number' && beforeScoreForDelta !== res.score) {
      const diff = res.score - beforeScoreForDelta;
      el.scoreDelta.textContent = diff < 0
        ? `変換前 ${beforeScoreForDelta}% → ${res.score}%（${diff}pt改善）`
        : `変換前 ${beforeScoreForDelta}% → ${res.score}%`;
      el.scoreDelta.classList.remove('hidden');
    } else {
      el.scoreDelta.classList.add('hidden');
    }

    el.statAvgLen.textContent = res.stats.avgLen;
    el.statBurst.textContent = res.stats.burstiness.toFixed(2);
    el.statMatches.textContent = res.matches.length;

    const pairs = [
      ['phrase', el.mPhrase, el.barPhrase],
      ['structure', el.mStructure, el.barStructure],
      ['translation', el.mTranslation, el.barTranslation],
      ['uniformity', el.mUniformity, el.barUniformity],
      ['ending', el.mEnding, el.barEnding],
      ['formatting', el.mFormatting, el.barFormatting]
    ];
    for (const [key, labelEl, barEl] of pairs) {
      const v = res.metrics[key] || 0;
      labelEl.textContent = `${v}%`;
      barEl.style.width = `${v}%`;
      barEl.style.background = scoreColor(v);
    }
  }

  function runDetect() {
    const text = el.inputText.value.trim();
    if (!text) {
      showToast('判定する文章を入力してください');
      return null;
    }
    const res = window.BunshoEngine.detectAI(text);
    lastBeforeScore = res.score;
    renderDetection(res);
    el.highlightBox.innerHTML = window.BunshoEngine.buildHighlightHtml(text, res.matches);
    return res;
  }

  function runHumanize(incrementSeed) {
    const text = el.inputText.value.trim();
    if (!text) {
      showToast('変換する文章を入力してください');
      return;
    }
    if (incrementSeed) variantSeed++;

    const beforeRes = window.BunshoEngine.detectAI(text);
    lastBeforeScore = beforeRes.score;
    el.highlightBox.innerHTML = window.BunshoEngine.buildHighlightHtml(text, beforeRes.matches);

    const converted = window.BunshoEngine.humanize(text, {
      strength: el.optStrength.value,
      tone: el.optTone.value,
      softenPhrases: el.chkSoften.checked,
      removeMarkdown: el.chkMarkdown.checked,
      varyEndings: el.chkEndings.checked,
      seed: variantSeed
    });

    el.outputText.value = converted.text;
    const afterRes = window.BunshoEngine.detectAI(converted.text);

    // 変換後のスコアを表示しつつ、変換前との改善幅を明示
    renderDetection(afterRes, beforeRes.score);
    el.afterScoreText.textContent = `変換後のAI度: ${afterRes.score}%（変換前 ${beforeRes.score}%）`;

    // 差分・変更点リスト更新
    el.diffBox.innerHTML = window.BunshoEngine.buildDiffHtml(text, converted.text);
    el.changeCount.textContent = converted.changes.length;
    el.changesList.innerHTML = '';
    if (converted.changes.length === 0) {
      el.changesList.innerHTML = '<li class="empty-msg">元の文章がすでに自然なため、大きな書き換えは不要でした。</li>';
    } else {
      for (const ch of converted.changes) {
        const li = document.createElement('li');
        li.className = 'change-item';
        li.innerHTML = `<div class="change-cat">${escapeHtml(ch.cat)}</div><div>${escapeHtml(ch.detail)}</div>`;
        el.changesList.appendChild(li);
      }
    }

    pushHistory({
      id: Date.now(),
      createdAt: Date.now(),
      beforeScore: beforeRes.score,
      afterScore: afterRes.score,
      input: text,
      output: converted.text
    });

    switchOutputTab('humanized');
    showToast(`変換完了：AI度 ${beforeRes.score}% → ${afterRes.score}%`);
  }

  // Optional Gemini API Rewrite
  async function runGeminiRewrite() {
    const apiKey = localStorage.getItem(API_KEY_STORAGE);
    const text = el.inputText.value.trim();
    if (!apiKey) {
      el.apiModal.classList.remove('hidden');
      return;
    }
    if (!text) {
      showToast('変換する文章を入力してください');
      return;
    }

    const beforeRes = window.BunshoEngine.detectAI(text);
    el.btnAiRewrite.disabled = true;
    el.btnAiRewrite.textContent = 'リライト中…';

    const toneMap = {
      keep: '元の文体を自然に保つ',
      polite: '丁寧で自然な「です・ます」調',
      casual: '親しみやすい話し言葉寄りのトーン',
      dearu: '引き締まった「だ・である」調'
    };

    const prompt = [
      'あなたは日本語の編集者です。以下の文章から「AIが書いたような定型表現・翻訳調・硬さ・機械的な箇条書き」を取り除き、意味や事実関係を変えずに、人間が自然に書いた読みやすい日本語に書き直してください。',
      `文体指定: ${toneMap[el.optTone.value] || toneMap.keep}`,
      '出力は書き直した本文のみを返し、前置きや解説は一切付けないでください。',
      '',
      '【元の文章】',
      text
    ].join('\n');

    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        }
      );
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const rewritten = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!rewritten) throw new Error('Empty response');

      el.outputText.value = rewritten;
      const afterRes = window.BunshoEngine.detectAI(rewritten);
      renderDetection(afterRes, beforeRes.score);
      el.afterScoreText.textContent = `高度リライト後のAI度: ${afterRes.score}%（変換前 ${beforeRes.score}%）`;
      el.diffBox.innerHTML = window.BunshoEngine.buildDiffHtml(text, rewritten);
      el.changeCount.textContent = '1';
      el.changesList.innerHTML = '<li class="change-item"><div class="change-cat">高度AIリライト</div><div>Gemini APIを使用して文脈全体をより自然な日本語に再構成しました。</div></li>';
      switchOutputTab('humanized');
      showToast(`高度リライト完了：AI度 ${beforeRes.score}% → ${afterRes.score}%`);
    } catch (err) {
      showToast('APIリライトに失敗しました。キー設定や通信状態を確認してください。');
    } finally {
      el.btnAiRewrite.disabled = false;
      el.btnAiRewrite.textContent = '高度AIリライト';
    }
  }

  function switchOutputTab(name) {
    document.querySelectorAll('.out-tab').forEach((t) => {
      const active = t.dataset.tab === name;
      t.classList.toggle('active', active);
      t.setAttribute('aria-selected', String(active));
    });
    $('paneHumanized').classList.toggle('hidden', name !== 'humanized');
    $('paneHighlight').classList.toggle('hidden', name !== 'highlight');
    $('paneDiff').classList.toggle('hidden', name !== 'diff');
    $('paneChanges').classList.toggle('hidden', name !== 'changes');
  }

  // History
  function loadHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      history = raw ? JSON.parse(raw) : [];
    } catch {
      history = [];
    }
    el.historyCount.textContent = history.length;
  }

  function pushHistory(entry) {
    history.unshift(entry);
    history = history.slice(0, 20);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {}
    el.historyCount.textContent = history.length;
  }

  function renderHistoryModal() {
    el.historyList.innerHTML = '';
    if (history.length === 0) {
      el.historyList.innerHTML = '<div class="empty-msg">まだ判定・変換履歴はありません。</div>';
      return;
    }
    for (const item of history) {
      const d = new Date(item.createdAt);
      const stamp = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      const div = document.createElement('div');
      div.className = 'history-item';
      div.innerHTML = `
        <div class="history-top">
          <span>${stamp}</span>
          <strong>AI度 ${item.beforeScore}% → ${item.afterScore}%</strong>
        </div>
        <div class="history-preview">${escapeHtml(item.input.slice(0, 60))}</div>
      `;
      div.addEventListener('click', () => {
        el.inputText.value = item.input;
        el.outputText.value = item.output;
        updateInputCounts();
        const afterRes = window.BunshoEngine.detectAI(item.output);
        renderDetection(afterRes, item.beforeScore);
        el.diffBox.innerHTML = window.BunshoEngine.buildDiffHtml(item.input, item.output);
        el.historyModal.classList.add('hidden');
        showToast('履歴を読み込みました');
      });
      el.historyList.appendChild(div);
    }
  }

  function syncApiButton() {
    const hasKey = Boolean(localStorage.getItem(API_KEY_STORAGE));
    el.btnAiRewrite.classList.toggle('hidden', !hasKey);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    el.iconSun.classList.toggle('hidden', theme !== 'dark');
    el.iconMoon.classList.toggle('hidden', theme === 'dark');
  }

  function bindEvents() {
    el.inputText.addEventListener('input', updateInputCounts);

    // Samples
    document.querySelectorAll('.chip-btn[data-sample]').forEach((btn) => {
      btn.addEventListener('click', () => {
        el.inputText.value = SAMPLES[btn.dataset.sample] || '';
        updateInputCounts();
        runDetect();
        showToast('サンプル文章を読み込み、AI度合いを判定しました');
      });
    });

    $('btnPaste').addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        el.inputText.value = text;
        updateInputCounts();
        showToast('クリップボードから貼り付けました');
      } catch {
        showToast('貼り付けに失敗しました（Ctrl+Vでお試しください）');
      }
    });

    $('btnClear').addEventListener('click', () => {
      el.inputText.value = '';
      el.outputText.value = '';
      updateInputCounts();
      renderDetection(window.BunshoEngine.detectAI(''));
      el.afterScoreText.textContent = '変換後のAI度: —';
      el.highlightBox.textContent = '判定を実行すると、AIらしい表現が色分け表示されます。';
      el.diffBox.textContent = '変換を実行すると、Before / After の差分が表示されます。';
      el.changesList.innerHTML = '<li class="empty-msg">まだ変換履歴がありません。</li>';
      el.changeCount.textContent = '0';
    });

    el.btnDetect.addEventListener('click', () => {
      const res = runDetect();
      if (res) {
        switchOutputTab('highlight');
        showToast(`判定完了：AI度 ${res.score}%（${res.label}）`);
      }
    });

    el.btnHumanize.addEventListener('click', () => runHumanize(false));
    el.btnAiRewrite.addEventListener('click', runGeminiRewrite);

    $('btnRetryVariant').addEventListener('click', () => runHumanize(true));

    $('btnApplyToInput').addEventListener('click', () => {
      if (!el.outputText.value.trim()) return;
      el.inputText.value = el.outputText.value;
      updateInputCounts();
      runDetect();
      showToast('変換結果を入力欄へ戻して再判定しました');
    });

    $('btnCopyOutput').addEventListener('click', async () => {
      const txt = el.outputText.value;
      if (!txt.trim()) {
        showToast('コピーする変換結果がありません');
        return;
      }
      try {
        await navigator.clipboard.writeText(txt);
        showToast('変換後の文章をコピーしました');
      } catch {
        showToast('コピーに失敗しました');
      }
    });

    $('btnDownloadTxt').addEventListener('click', () => {
      const txt = el.outputText.value;
      if (!txt.trim()) return;
      const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bunsho-rewritten-${new Date().toISOString().slice(0, 10)}.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });

    // Output tabs
    document.querySelectorAll('.out-tab').forEach((tab) => {
      tab.addEventListener('click', () => switchOutputTab(tab.dataset.tab));
    });

    // Output manual edit re-scoring
    el.outputText.addEventListener('input', () => {
      const txt = el.outputText.value.trim();
      if (!txt) {
        el.afterScoreText.textContent = '変換後のAI度: —';
        return;
      }
      const res = window.BunshoEngine.detectAI(txt);
      el.afterScoreText.textContent = `変換後のAI度: ${res.score}%` + (lastBeforeScore !== null ? `（変換前 ${lastBeforeScore}%）` : '');
    });

    // Modals
    $('btnHistory').addEventListener('click', () => {
      renderHistoryModal();
      el.historyModal.classList.remove('hidden');
    });

    $('btnClearHistory').addEventListener('click', () => {
      history = [];
      localStorage.removeItem(HISTORY_KEY);
      el.historyCount.textContent = '0';
      renderHistoryModal();
    });

    $('btnApiSettings').addEventListener('click', () => {
      el.inputApiKey.value = localStorage.getItem(API_KEY_STORAGE) || '';
      el.apiModal.classList.remove('hidden');
    });

    $('btnSaveApiKey').addEventListener('click', () => {
      const key = el.inputApiKey.value.trim();
      if (key) {
        localStorage.setItem(API_KEY_STORAGE, key);
        showToast('Gemini APIキーを保存しました');
      } else {
        localStorage.removeItem(API_KEY_STORAGE);
      }
      syncApiButton();
      el.apiModal.classList.add('hidden');
    });

    $('btnRemoveApiKey').addEventListener('click', () => {
      localStorage.removeItem(API_KEY_STORAGE);
      el.inputApiKey.value = '';
      syncApiButton();
      el.apiModal.classList.add('hidden');
      showToast('APIキーを削除しました');
    });

    document.querySelectorAll('[data-close]').forEach((btn) => {
      btn.addEventListener('click', () => $(btn.dataset.close).classList.add('hidden'));
    });

    [el.historyModal, el.apiModal].forEach((m) => {
      m.addEventListener('click', (e) => {
        if (e.target === m) m.classList.add('hidden');
      });
    });

    $('btnTheme').addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
    });

    // PWA install
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      el.btnInstallPwa.classList.remove('hidden');
    });

    el.btnInstallPwa.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      if (outcome === 'accepted') el.btnInstallPwa.classList.add('hidden');
      deferredInstallPrompt = null;
    });

    const updateOnline = () => {
      el.onlineStatus.textContent = navigator.onLine ? 'オフライン動作対応' : 'オフライン稼働中';
    };
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    updateOnline();
  }

  function registerSW() {
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }

  // Init
  applyTheme(localStorage.getItem(THEME_KEY) || 'light');
  loadHistory();
  syncApiButton();
  bindEvents();
  registerSW();

  // 初回表示時にAI記事風サンプルを読み込んで即座に判定結果を体験できるようにする
  el.inputText.value = SAMPLES['ai-blog'];
  updateInputCounts();
  runDetect();
})();
