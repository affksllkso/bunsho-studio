/**
 * 文脈工房 — ことばねUIベース メインアプリケーション
 * Word (.docx) / PDF (.pdf) / テキスト読込 ＋ AI文体チェック ＋ 自然文リライト ＋ 履歴・文体プロファイル
 */
(function () {
  'use strict';

  const HISTORY_KEY = 'bunsho_kotobane_history_v1';
  const PROFILE_KEY = 'bunsho_kotobane_profiles_v1';
  const THEME_KEY = 'bunsho_kotobane_theme';
  const API_KEY_STORAGE = 'bunsho_gemini_api_key';

  const SAMPLE_TEXT = [
    '本記事では、現代社会におけるデジタル学習の役割について詳しく解説します。近年、オンライン教材の普及に伴い、学習方法の多様化への注目が集まっています。',
    '',
    'まず、場所を選ばず学べる環境が重要な役割を果たします。さらに、個別の進捗に合わせて復習することが可能です。一方で、継続的なモチベーションの維持が課題になることも多いと言えるでしょう。',
    '',
    '- **学習計画の可視化**：目標を細かく設定することで、日々の達成感を向上させます。',
    '- **ツール連携**：メモや資料をシームレスに整理することで、理解の定着を促進します。',
    '',
    '以上のことから、多角的な視点で学習環境を見直すことが不可欠です。結論として、小さな工夫の積み重ねが大きな成果をもたらします。'
  ].join('\n');

  let history = [];
  let profiles = [];
  let lastDetection = null;
  let variantSeed = 0;
  let deferredInstallPrompt = null;
  let toastTimer = null;

  const $ = (id) => document.getElementById(id);
  const el = {
    sidebar: $('sidebar'),
    mobileBackdrop: $('mobileBackdrop'),
    crumbCurrent: $('crumbCurrent'),
    onlineLabel: $('onlineLabel'),
    navHistoryCount: $('navHistoryCount'),
    viewStudio: $('viewStudio'),
    viewHistory: $('viewHistory'),
    viewProfiles: $('viewProfiles'),
    dropZone: $('dropZone'),
    fileInput: $('fileInput'),
    uploadBtnText: $('uploadBtnText'),
    loadedFileBadge: $('loadedFileBadge'),
    inputText: $('inputText'),
    charCountLabel: $('charCountLabel'),
    highlightCountBadge: $('highlightCountBadge'),
    editorInputPane: $('editorInputPane'),
    editorHighlightPane: $('editorHighlightPane'),
    highlightCanvas: $('highlightCanvas'),
    highlightReasonBox: $('highlightReasonBox'),
    reportResultPane: $('reportResultPane'),
    reportStatsPane: $('reportStatsPane'),
    scoreRing: $('scoreRing'),
    scoreNum: $('scoreNum'),
    scoreStatusPill: $('scoreStatusPill'),
    scoreCaption: $('scoreCaption'),
    valPhrase: $('valPhrase'),
    valConj: $('valConj'),
    valEnd: $('valEnd'),
    valLen: $('valLen'),
    valStruct: $('valStruct'),
    barPhrase: $('barPhrase'),
    barConj: $('barConj'),
    barEnd: $('barEnd'),
    barLen: $('barLen'),
    barStruct: $('barStruct'),
    footerMatchCount: $('footerMatchCount'),
    stChars: $('stChars'),
    stSentences: $('stSentences'),
    stAvgLen: $('stAvgLen'),
    stParagraphs: $('stParagraphs'),
    stStdDev: $('stStdDev'),
    stCv: $('stCv'),
    dist30: $('dist30'),
    dist50: $('dist50'),
    dist70: $('dist70'),
    dist71: $('dist71'),
    dist30Val: $('dist30Val'),
    dist50Val: $('dist50Val'),
    dist70Val: $('dist70Val'),
    dist71Val: $('dist71Val'),
    stTopEndings: $('stTopEndings'),
    stHeadConj: $('stHeadConj'),
    optPreset: $('optPreset'),
    optIntensity: $('optIntensity'),
    intensityVal: $('intensityVal'),
    chkKeepQuotes: $('chkKeepQuotes'),
    chkRemoveMd: $('chkRemoveMd'),
    chkVaryEndings: $('chkVaryEndings'),
    rewriteDeltaBadge: $('rewriteDeltaBadge'),
    outputText: $('outputText'),
    afterScoreCaption: $('afterScoreCaption'),
    diffCanvas: $('diffCanvas'),
    changesList: $('changesList'),
    changeCountBadge: $('changeCountBadge'),
    outResultPane: $('outResultPane'),
    outDiffPane: $('outDiffPane'),
    outChangesPane: $('outChangesPane'),
    historyContainer: $('historyContainer'),
    profName: $('profName'),
    profSamplesWrap: $('profSamplesWrap'),
    profileList: $('profileList'),
    btnAiRewrite: $('btnAiRewrite'),
    btnInstallPwa: $('btnInstallPwa'),
    btnThemeToggle: $('btnThemeToggle'),
    iconSun: $('iconSun'),
    iconMoon: $('iconMoon'),
    howToModal: $('howToModal'),
    apiModal: $('apiModal'),
    inputApiKey: $('inputApiKey'),
    toast: $('toast')
  };

  function showToast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.add('hidden'), 2600);
  }

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // Navigation
  function switchView(view) {
    el.viewStudio.classList.toggle('hidden', view !== 'studio');
    el.viewHistory.classList.toggle('hidden', view !== 'history');
    el.viewProfiles.classList.toggle('hidden', view !== 'profiles');

    const titles = { studio: '文章スタジオ', history: '履歴', profiles: '文体プロファイル' };
    el.crumbCurrent.textContent = titles[view] || '文章スタジオ';

    document.querySelectorAll('.nav-item').forEach((n) => {
      n.classList.toggle('active', n.dataset.view === view);
    });

    if (view === 'history') renderHistory();
    if (view === 'profiles') renderProfiles();
    closeMobileSidebar();
  }

  function closeMobileSidebar() {
    el.sidebar.classList.remove('open');
    el.mobileBackdrop.classList.add('hidden');
  }

  // Tabs
  function switchEditorTab(tab) {
    document.querySelectorAll('[data-editor-tab]').forEach((b) => {
      const active = b.dataset.editorTab === tab;
      b.classList.toggle('active', active);
      b.setAttribute('aria-selected', String(active));
    });
    el.editorInputPane.classList.toggle('hidden', tab !== 'input');
    el.editorHighlightPane.classList.toggle('hidden', tab !== 'highlight');
  }

  function switchReportTab(tab) {
    document.querySelectorAll('[data-report-tab]').forEach((b) => {
      const active = b.dataset.reportTab === tab;
      b.classList.toggle('active', active);
      b.setAttribute('aria-selected', String(active));
    });
    el.reportResultPane.classList.toggle('hidden', tab !== 'result');
    el.reportStatsPane.classList.toggle('hidden', tab !== 'stats');
  }

  function switchOutTab(tab) {
    document.querySelectorAll('[data-out-tab]').forEach((b) => {
      const active = b.dataset.outTab === tab;
      b.classList.toggle('active', active);
      b.setAttribute('aria-selected', String(active));
    });
    el.outResultPane.classList.toggle('hidden', tab !== 'result');
    el.outDiffPane.classList.toggle('hidden', tab !== 'diff');
    el.outChangesPane.classList.toggle('hidden', tab !== 'changes');
  }

  function updateCharCount() {
    const chars = el.inputText.value.replace(/\s/g, '').length;
    el.charCountLabel.textContent = `${chars.toLocaleString()} 字`;
  }

  // Detection & Stats Rendering
  function renderDetection(res) {
    lastDetection = res;
    const circ = 289.03;
    const offset = circ * (1 - res.score / 100);
    el.scoreRing.style.strokeDashoffset = String(offset);
    el.scoreRing.style.stroke = res.score >= 70 ? 'var(--rose)' : res.score >= 45 ? 'var(--amber)' : res.score >= 25 ? 'var(--accent)' : 'var(--emerald)';

    el.scoreNum.textContent = String(res.score);
    el.scoreStatusPill.textContent = res.label;
    el.scoreCaption.textContent = res.summary;

    const c = res.categories;
    el.valPhrase.textContent = c.phrase;
    el.barPhrase.style.width = `${c.phrase}%`;
    el.valConj.textContent = c.conjunction;
    el.barConj.style.width = `${c.conjunction}%`;
    el.valEnd.textContent = c.ending;
    el.barEnd.style.width = `${c.ending}%`;
    el.valLen.textContent = c.length;
    el.barLen.style.width = `${c.length}%`;
    el.valStruct.textContent = c.structure;
    el.barStruct.style.width = `${c.structure}%`;

    const mCount = res.matches.length;
    el.highlightCountBadge.textContent = mCount;
    el.footerMatchCount.textContent = mCount;

    // Highlight Canvas
    el.highlightCanvas.innerHTML = window.BunshoEngine.buildHighlightHtml(el.inputText.value, res.matches);
    el.highlightReasonBox.textContent = mCount > 0
      ? '色付きの箇所を選ぶと、検出理由を確認できます。'
      : 'AI文体の特徴的な定型句は検出されませんでした。';

    el.highlightCanvas.querySelectorAll('mark[data-match-idx]').forEach((mk) => {
      const showReason = () => {
        el.highlightCanvas.querySelectorAll('mark.selected').forEach((x) => x.classList.remove('selected'));
        mk.classList.add('selected');
        const m = res.matches[Number(mk.dataset.matchIdx)];
        if (m) {
          el.highlightReasonBox.innerHTML = `<strong>[${esc(m.cat)}] 「${esc(m.text)}」</strong>：${esc(m.reason)}`;
        }
      };
      mk.addEventListener('click', showReason);
      mk.addEventListener('focus', showReason);
    });

    // Stats Tab
    const s = res.stats;
    el.stChars.textContent = s.chars.toLocaleString();
    el.stSentences.textContent = s.sentences;
    el.stAvgLen.textContent = `${s.avgLen} 字`;
    el.stParagraphs.textContent = s.paragraphs;
    el.stStdDev.textContent = s.stdDev.toFixed(1);
    el.stCv.textContent = s.cv.toFixed(2);

    const totalSents = Math.max(1, s.sentences);
    el.dist30.style.width = `${Math.round((s.lenBuckets.s30 / totalSents) * 100)}%`;
    el.dist50.style.width = `${Math.round((s.lenBuckets.s50 / totalSents) * 100)}%`;
    el.dist70.style.width = `${Math.round((s.lenBuckets.s70 / totalSents) * 100)}%`;
    el.dist71.style.width = `${Math.round((s.lenBuckets.s71 / totalSents) * 100)}%`;
    el.dist30Val.textContent = s.lenBuckets.s30;
    el.dist50Val.textContent = s.lenBuckets.s50;
    el.dist70Val.textContent = s.lenBuckets.s70;
    el.dist71Val.textContent = s.lenBuckets.s71;

    el.stTopEndings.innerHTML = s.topEndings.length
      ? s.topEndings.map(([k, v]) => `<span class="stat-tag">〜${esc(k)} (${v})</span>`).join('')
      : '<span class="stat-tag">データなし</span>';

    el.stHeadConj.innerHTML = s.headConjunctions.length
      ? s.headConjunctions.map(([k, v]) => `<span class="stat-tag">${esc(k)} (${v})</span>`).join('')
      : '<span class="stat-tag">検出なし</span>';
  }

  function runCheck(silent) {
    const text = el.inputText.value.trim();
    if (!text) {
      if (!silent) showToast('チェックする原稿を入力するか、ファイルを読み込んでください');
      return null;
    }
    const res = window.BunshoEngine.detectAI(text);
    renderDetection(res);
    if (!silent) showToast(`AI文体チェック完了：スコア ${res.score} / 100（検出 ${res.matches.length} 件）`);
    return res;
  }

  function runRewrite(bumpSeed) {
    const text = el.inputText.value.trim();
    if (!text) {
      showToast('整える原稿を入力してください');
      return;
    }
    if (bumpSeed) variantSeed++;

    const beforeRes = window.BunshoEngine.detectAI(text);
    renderDetection(beforeRes);

    const activeProfile = profiles.length > 0 ? profiles[0] : null;
    const converted = window.BunshoEngine.humanize(text, {
      preset: el.optPreset.value,
      intensity: Number(el.optIntensity.value),
      keepQuotes: el.chkKeepQuotes.checked,
      removeMarkdown: el.chkRemoveMd.checked,
      varyEndings: el.chkVaryEndings.checked,
      profile: activeProfile,
      seed: variantSeed
    });

    el.outputText.value = converted.text;
    const afterRes = window.BunshoEngine.detectAI(converted.text);

    const diffPt = afterRes.score - beforeRes.score;
    el.rewriteDeltaBadge.textContent = diffPt < 0
      ? `スコア ${beforeRes.score} → ${afterRes.score}（${diffPt}pt改善）`
      : `スコア ${beforeRes.score} → ${afterRes.score}`;
    el.rewriteDeltaBadge.classList.remove('hidden');
    el.afterScoreCaption.textContent = `変換後のAI文体スコア: ${afterRes.score} / 100（変換前 ${beforeRes.score}）`;

    el.diffCanvas.innerHTML = window.BunshoEngine.buildDiffHtml(text, converted.text);
    el.changeCountBadge.textContent = converted.changes.length;
    el.changesList.innerHTML = converted.changes.length
      ? converted.changes.map((c) => `<li class="change-item"><div class="change-cat">${esc(c.cat)}</div><div>${esc(c.detail)}</div></li>`).join('')
      : '<li class="empty-note">元の文章がすでに自然なため、大きな書き換えは不要でした。</li>';

    saveHistoryEntry({
      id: Date.now(),
      createdAt: Date.now(),
      beforeScore: beforeRes.score,
      afterScore: afterRes.score,
      input: text,
      output: converted.text
    });

    switchOutTab('result');
    $('rewriteSection').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    showToast(`自然な文章に整えました（スコア ${beforeRes.score} → ${afterRes.score}）`);
  }

  // File Upload (Word .docx / PDF .pdf / TXT)
  async function handleFileUpload(file) {
    if (!file) return;
    const origLabel = el.uploadBtnText.textContent;
    el.uploadBtnText.textContent = '読み込み中…';
    try {
      const res = await window.BunshoImporter.readFileAsText(file);
      el.inputText.value = res.text;
      updateCharCount();
      el.loadedFileBadge.textContent = `${res.fileName} (${res.fileType} · ${res.meta})`;
      el.loadedFileBadge.classList.remove('hidden');
      switchEditorTab('input');
      runCheck(true);
      showToast(`${res.fileType}「${res.fileName}」を読み込みました`);
    } catch (err) {
      showToast(err.message || 'ファイルの読み込みに失敗しました');
    } finally {
      el.uploadBtnText.textContent = origLabel;
      el.fileInput.value = '';
    }
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
      showToast('原稿を入力してください');
      return;
    }

    const beforeRes = window.BunshoEngine.detectAI(text);
    el.btnAiRewrite.disabled = true;
    el.btnAiRewrite.textContent = 'リライト中…';

    const presetLabel = el.optPreset.options[el.optPreset.selectedIndex].text;
    const prompt = [
      'あなたは日本語の編集者です。以下の原稿からAI特有の定型句・翻訳調・過剰な装飾を取り除き、元の意味・主張・引用・専門用語・事実を保ったまま、人間が自然に書いた読みやすい日本語へ整えてください。',
      `文体指定: ${presetLabel}`,
      `変更度: ${el.optIntensity.value}/100`,
      '出力は書き直した本文のみを返し、解説や前置きは書かないでください。',
      '',
      text
    ].join('\n');

    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        }
      );
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const rewritten = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!rewritten) throw new Error('Empty');

      el.outputText.value = rewritten;
      const afterRes = window.BunshoEngine.detectAI(rewritten);
      el.rewriteDeltaBadge.textContent = `スコア ${beforeRes.score} → ${afterRes.score}`;
      el.rewriteDeltaBadge.classList.remove('hidden');
      el.afterScoreCaption.textContent = `高度リライト後のAI文体スコア: ${afterRes.score} / 100（変換前 ${beforeRes.score}）`;
      el.diffCanvas.innerHTML = window.BunshoEngine.buildDiffHtml(text, rewritten);
      switchOutTab('result');
      showToast(`高度AIリライト完了（スコア ${beforeRes.score} → ${afterRes.score}）`);
    } catch {
      showToast('Gemini APIでのリライトに失敗しました。キー設定や通信を確認してください。');
    } finally {
      el.btnAiRewrite.disabled = false;
      el.btnAiRewrite.textContent = '高度AIリライト (Gemini)';
    }
  }

  // Export Helpers
  function downloadBlob(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportWordDoc(text, baseName) {
    const htmlBody = text.split('\n').map((line) => `<p>${esc(line) || '&nbsp;'}</p>`).join('');
    const docHtml = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><style>body{font-family:"Yu Mincho","MS Mincho",serif;font-size:11pt;line-height:1.8;}</style></head><body>${htmlBody}</body></html>`;
    downloadBlob(`${baseName}.doc`, '\ufeff' + docHtml, 'application/msword;charset=utf-8');
  }

  // History Storage
  function loadHistory() {
    try {
      history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    } catch { history = []; }
    el.navHistoryCount.textContent = history.length;
  }

  function saveHistoryEntry(entry) {
    history.unshift(entry);
    history = history.slice(0, 30);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch {}
    el.navHistoryCount.textContent = history.length;
  }

  function renderHistory() {
    if (history.length === 0) {
      el.historyContainer.innerHTML = `
        <div class="empty-note" style="grid-column: 1 / -1;">
          <p style="margin:0 0 12px;">保存された履歴はありません</p>
          <button id="btnEmptyOpenStudio" class="primary-btn sm">文章スタジオを開く</button>
        </div>
      `;
      $('btnEmptyOpenStudio').addEventListener('click', () => switchView('studio'));
      return;
    }

    el.historyContainer.innerHTML = '';
    history.forEach((item) => {
      const d = new Date(item.createdAt);
      const stamp = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      const card = document.createElement('div');
      card.className = 'history-card';
      card.innerHTML = `
        <div class="history-meta">
          <span>${stamp}</span>
          <strong>スコア ${item.beforeScore} → ${item.afterScore}</strong>
        </div>
        <div class="history-excerpt">${esc(item.input)}</div>
      `;
      card.addEventListener('click', () => {
        el.inputText.value = item.input;
        el.outputText.value = item.output;
        updateCharCount();
        runCheck(true);
        el.diffCanvas.innerHTML = window.BunshoEngine.buildDiffHtml(item.input, item.output);
        switchView('studio');
        showToast('履歴を文章スタジオに読み込みました');
      });
      el.historyContainer.appendChild(card);
    });
  }

  // Style Profiles
  function loadProfiles() {
    try {
      profiles = JSON.parse(localStorage.getItem(PROFILE_KEY) || '[]');
    } catch { profiles = []; }
  }

  function saveProfiles() {
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profiles)); } catch {}
  }

  function renderProfiles() {
    if (profiles.length === 0) {
      el.profileList.innerHTML = '<div class="empty-note">保存された文体プロファイルはまだありません。左のフォームから自作文を登録してください。</div>';
      return;
    }
    el.profileList.innerHTML = '';
    profiles.forEach((p, idx) => {
      const div = document.createElement('div');
      div.className = 'profile-card';
      div.innerHTML = `
        <div class="history-meta">
          <strong>${esc(p.name)}</strong>
          <button class="text-btn" data-del-prof="${idx}">削除</button>
        </div>
        <div class="tag-cloud">
          <span class="stat-tag">文体: ${esc(p.toneLabel)}</span>
          <span class="stat-tag">平均文長: ${p.avgLen}字</span>
          <span class="stat-tag">学習元: ${p.sampleCount}本 (${p.totalChars}字)</span>
          ${(p.topEndings || []).map((e) => `<span class="stat-tag">${esc(e)}</span>`).join('')}
        </div>
      `;
      div.querySelector('[data-del-prof]').addEventListener('click', () => {
        profiles.splice(idx, 1);
        saveProfiles();
        renderProfiles();
        showToast('プロファイルを削除しました');
      });
      el.profileList.appendChild(div);
    });
  }

  // Theme
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    const isDark = theme === 'dark';
    el.iconSun.classList.toggle('hidden', !isDark);
    el.iconMoon.classList.toggle('hidden', isDark);
    el.btnThemeToggle.title = isDark ? 'ライトモードに切り替え' : 'ダークモードに切り替え';
    el.btnThemeToggle.setAttribute('aria-label', el.btnThemeToggle.title);
  }

  function syncApiBtn() {
    el.btnAiRewrite.classList.toggle('hidden', !localStorage.getItem(API_KEY_STORAGE));
  }

  function bindEvents() {
    // Sidebar nav
    $('btnBrandHome').addEventListener('click', () => switchView('studio'));
    document.querySelectorAll('.nav-item').forEach((btn) => {
      btn.addEventListener('click', () => switchView(btn.dataset.view));
    });

    $('btnMobileMenu').addEventListener('click', () => {
      el.sidebar.classList.toggle('open');
      el.mobileBackdrop.classList.toggle('hidden', !el.sidebar.classList.contains('open'));
    });
    el.mobileBackdrop.addEventListener('click', closeMobileSidebar);

    // Tabs
    document.querySelectorAll('[data-editor-tab]').forEach((b) => {
      b.addEventListener('click', () => switchEditorTab(b.dataset.editorTab));
    });
    document.querySelectorAll('[data-report-tab]').forEach((b) => {
      b.addEventListener('click', () => switchReportTab(b.dataset.reportTab));
    });
    document.querySelectorAll('[data-out-tab]').forEach((b) => {
      b.addEventListener('click', () => switchOutTab(b.dataset.outTab));
    });

    // Input & Sample
    el.inputText.addEventListener('input', updateCharCount);
    $('btnUseSample').addEventListener('click', () => {
      el.inputText.value = SAMPLE_TEXT;
      el.loadedFileBadge.classList.add('hidden');
      updateCharCount();
      runCheck(false);
    });

    // File Upload & Drag-and-Drop
    el.fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) handleFileUpload(e.target.files[0]);
    });

    ['dragenter', 'dragover'].forEach((ev) => {
      el.dropZone.addEventListener(ev, (e) => {
        e.preventDefault();
        el.dropZone.classList.add('drag-over');
      });
    });
    ['dragleave', 'drop'].forEach((ev) => {
      el.dropZone.addEventListener(ev, (e) => {
        e.preventDefault();
        el.dropZone.classList.remove('drag-over');
      });
    });
    el.dropZone.addEventListener('drop', (e) => {
      const file = e.dataTransfer?.files?.[0];
      if (file) handleFileUpload(file);
    });

    // Check & Rewrite buttons
    $('btnCheckStyle').addEventListener('click', () => runCheck(false));
    $('btnRewrite').addEventListener('click', () => runRewrite(false));
    $('btnRunRewrite2').addEventListener('click', () => runRewrite(false));
    el.btnAiRewrite.addEventListener('click', runGeminiRewrite);
    $('btnVariant').addEventListener('click', () => runRewrite(true));

    $('btnViewHighlights').addEventListener('click', () => {
      if (!lastDetection) runCheck(true);
      switchEditorTab('highlight');
    });

    el.optIntensity.addEventListener('input', () => {
      el.intensityVal.textContent = el.optIntensity.value;
    });

    // Copy & Export
    $('btnCopyInput').addEventListener('click', async () => {
      if (!el.inputText.value.trim()) return;
      try {
        await navigator.clipboard.writeText(el.inputText.value);
        showToast('原稿をコピーしました');
      } catch { showToast('コピーに失敗しました'); }
    });

    $('btnExportInput').addEventListener('click', () => {
      if (!el.inputText.value.trim()) return;
      downloadBlob(`bunsho-draft-${new Date().toISOString().slice(0, 10)}.txt`, el.inputText.value, 'text/plain;charset=utf-8');
    });

    $('btnCopyOutput').addEventListener('click', async () => {
      if (!el.outputText.value.trim()) return showToast('コピーする文章がありません');
      try {
        await navigator.clipboard.writeText(el.outputText.value);
        showToast('変換後の文章をコピーしました');
      } catch { showToast('コピーに失敗しました'); }
    });

    $('btnDownloadTxt').addEventListener('click', () => {
      if (!el.outputText.value.trim()) return;
      downloadBlob(`bunsho-natural-${new Date().toISOString().slice(0, 10)}.txt`, el.outputText.value, 'text/plain;charset=utf-8');
    });

    $('btnDownloadDoc').addEventListener('click', () => {
      if (!el.outputText.value.trim()) return;
      exportWordDoc(el.outputText.value, `bunsho-natural-${new Date().toISOString().slice(0, 10)}`);
      showToast('Word形式（.doc）で出力しました');
    });

    $('btnApplyBack').addEventListener('click', () => {
      if (!el.outputText.value.trim()) return;
      el.inputText.value = el.outputText.value;
      updateCharCount();
      runCheck(true);
      showToast('変換結果を原稿欄に反映して再チェックしました');
    });

    // History clear
    $('btnClearHistory').addEventListener('click', () => {
      history = [];
      localStorage.removeItem(HISTORY_KEY);
      el.navHistoryCount.textContent = '0';
      renderHistory();
      showToast('履歴をすべて削除しました');
    });

    // Profiles
    $('btnAddSampleField').addEventListener('click', () => {
      const idx = el.profSamplesWrap.querySelectorAll('.prof-sample-input').length + 1;
      const label = document.createElement('label');
      label.className = 'ctrl-field';
      label.innerHTML = `<span>自作文 ${idx}</span><textarea class="prof-sample-input" rows="4" placeholder="追加のサンプル文章"></textarea>`;
      el.profSamplesWrap.appendChild(label);
    });

    $('btnSaveProfile').addEventListener('click', () => {
      const name = el.profName.value.trim() || `マイ文体 ${profiles.length + 1}`;
      const samples = Array.from(el.profSamplesWrap.querySelectorAll('.prof-sample-input')).map((t) => t.value.trim()).filter(Boolean);
      if (samples.length === 0) {
        showToast('自作文を1つ以上入力してください');
        return;
      }
      const analyzed = window.BunshoEngine.analyzeProfileSamples(samples);
      profiles.unshift(Object.assign({ id: Date.now(), name }, analyzed));
      saveProfiles();
      el.profName.value = '';
      el.profSamplesWrap.querySelectorAll('.prof-sample-input').forEach((t) => { t.value = ''; });
      renderProfiles();
      showToast(`文体プロファイル「${name}」を保存しました`);
    });

    // Theme & Modals
    el.btnThemeToggle.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
    });

    $('btnHowTo').addEventListener('click', () => el.howToModal.classList.remove('hidden'));
    $('btnApiSettings').addEventListener('click', () => {
      el.inputApiKey.value = localStorage.getItem(API_KEY_STORAGE) || '';
      el.apiModal.classList.remove('hidden');
    });

    $('btnSaveApiKey').addEventListener('click', () => {
      const k = el.inputApiKey.value.trim();
      if (k) {
        localStorage.setItem(API_KEY_STORAGE, k);
        showToast('Gemini APIキーを保存しました');
      } else {
        localStorage.removeItem(API_KEY_STORAGE);
      }
      syncApiBtn();
      el.apiModal.classList.add('hidden');
    });

    $('btnRemoveApiKey').addEventListener('click', () => {
      localStorage.removeItem(API_KEY_STORAGE);
      el.inputApiKey.value = '';
      syncApiBtn();
      el.apiModal.classList.add('hidden');
      showToast('APIキーを削除しました');
    });

    document.querySelectorAll('[data-close]').forEach((b) => {
      b.addEventListener('click', () => $(b.dataset.close).classList.add('hidden'));
    });
    [el.howToModal, el.apiModal].forEach((m) => {
      m.addEventListener('click', (e) => { if (e.target === m) m.classList.add('hidden'); });
    });

    // PWA Install & Online
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

    const syncOnline = () => {
      el.onlineLabel.textContent = navigator.onLine ? 'ローカル保存' : 'オフライン稼働中';
    };
    window.addEventListener('online', syncOnline);
    window.addEventListener('offline', syncOnline);
    syncOnline();
  }

  function registerSW() {
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }

  // Init
  applyTheme(localStorage.getItem(THEME_KEY) || 'dark');
  loadHistory();
  loadProfiles();
  syncApiBtn();
  bindEvents();
  registerSW();

  // 初回表示時にサンプル原稿を読み込んでチェック済み状態を表示
  el.inputText.value = SAMPLE_TEXT;
  updateCharCount();
  runCheck(true);
})();
