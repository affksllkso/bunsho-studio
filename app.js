/**
 * 文脈工房 — ことばねUIベース メインアプリケーション
 * Word (.docx) / PDF (.pdf) / テキスト読込 ＋ AI文体チェック ＋ 自然文リライト ＋ 履歴・文体プロファイル
 */
(function () {
  'use strict';

  const HISTORY_KEY = 'bunsho_kotobane_history_v1';
  const PROFILE_KEY = 'bunsho_kotobane_profiles_v1';
  const THEME_KEY = 'bunsho_kotobane_theme';
  const LEGACY_GEMINI_KEY = 'bunsho_gemini_api_key';
  const AI_CONFIG_KEY = 'scriptlab_ai_config_v1';
  const ML_SETTINGS_KEY = 'scriptlab_ml_settings_v1';
  const ML_FALLBACK_KEY = 'scriptlab_ml_models_fallback_v1';
  const ML_DB_NAME = 'scriptlab_models_db_v1';
  const ML_STORE = 'models';
  const MAX_SAVED_MODELS = 20;

  const AI_PROVIDERS = {
    gemini: {
      name: 'Gemini',
      keyLabel: 'Gemini API キー',
      placeholder: 'AIza...',
      defaultModel: 'gemini-4-hydrogen',
      presets: [
        { label: 'Gemini 4 Hydrogen', id: 'gemini-4-hydrogen' },
        { label: 'Gemini 4 Neon', id: 'gemini-4-neon' },
        { label: 'Gemini 2.5 Flash', id: 'gemini-2.5-flash' }
      ],
      note: 'Google AI Studio で取得した Gemini API キーを使用します（標準: gemini-4-hydrogen）。'
    },
    openai: {
      name: 'ChatGPT',
      keyLabel: 'OpenAI API キー',
      placeholder: 'sk-...',
      defaultModel: 'gpt-6.2-sol',
      presets: [
        { label: 'Sol 6.2', id: 'gpt-6.2-sol' },
        { label: 'GPT-6.2', id: 'gpt-6.2' },
        { label: 'GPT-4o mini', id: 'gpt-4o-mini' }
      ],
      note: 'OpenAI Platform で取得した API キーを使用します（標準: gpt-6.2-sol）。'
    },
    claude: {
      name: 'Claude',
      keyLabel: 'Anthropic API キー',
      placeholder: 'sk-ant-...',
      defaultModel: 'claude-sonnet-5-5',
      presets: [
        { label: 'Claude Sonnet 5.5', id: 'claude-sonnet-5-5' },
        { label: 'Claude Sonnet 4.5', id: 'claude-sonnet-4-5' },
        { label: 'Claude 3.5 Haiku', id: 'claude-3-5-haiku-latest' }
      ],
      note: 'Anthropic Console で取得した API キーを使用します（標準: claude-sonnet-5-5／ブラウザー直接接続対応）。'
    }
  };

  let aiConfig = {
    activeProvider: 'gemini',
    keys: { gemini: '', openai: '', claude: '' },
    models: {
      gemini: AI_PROVIDERS.gemini.defaultModel,
      openai: AI_PROVIDERS.openai.defaultModel,
      claude: AI_PROVIDERS.claude.defaultModel
    }
  };
  let editingProvider = 'gemini';

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
  let trainedModels = [];
  let mlSettings = { mode: 'hybrid', activeVersion: '' };
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
    navModelBadge: $('navModelBadge'),
    viewStudio: $('viewStudio'),
    viewHistory: $('viewHistory'),
    viewProfiles: $('viewProfiles'),
    viewModels: $('viewModels'),
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
    reportMlPane: $('reportMlPane'),
    reportStatsPane: $('reportStatsPane'),
    scoreRing: $('scoreRing'),
    scoreNum: $('scoreNum'),
    scoreHeadingTitle: $('scoreHeadingTitle'),
    scoreStatusPill: $('scoreStatusPill'),
    scoreCaption: $('scoreCaption'),
    mlSummaryTitle: $('mlSummaryTitle'),
    mlSummaryBadge: $('mlSummaryBadge'),
    mlSummaryDetail: $('mlSummaryDetail'),
    mlPaneModelName: $('mlPaneModelName'),
    mlPaneVerdict: $('mlPaneVerdict'),
    mlPaneVersion: $('mlPaneVersion'),
    mlStProb: $('mlStProb'),
    mlStThreshold: $('mlStThreshold'),
    mlStRuleScore: $('mlStRuleScore'),
    mlStMatched: $('mlStMatched'),
    mlProbBar: $('mlProbBar'),
    mlThresholdMarker: $('mlThresholdMarker'),
    mlTopAiGrams: $('mlTopAiGrams'),
    mlTopHumanGrams: $('mlTopHumanGrams'),
    modelDropZone: $('modelDropZone'),
    modelFileInput: $('modelFileInput'),
    modelUploadBtnText: $('modelUploadBtnText'),
    modelMemoInput: $('modelMemoInput'),
    mlModeExplain: $('mlModeExplain'),
    btnDisableModel: $('btnDisableModel'),
    modelVersionList: $('modelVersionList'),
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
    profileDropZone: $('profileDropZone'),
    profFileInput: $('profFileInput'),
    profUploadBtnText: $('profUploadBtnText'),
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
    apiKeyLabel: $('apiKeyLabel'),
    inputApiKey: $('inputApiKey'),
    inputApiModel: $('inputApiModel'),
    modelPresets: $('modelPresets'),
    providerNote: $('providerNote'),
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
    el.viewModels.classList.toggle('hidden', view !== 'models');

    const titles = {
      studio: '文章スタジオ',
      history: '履歴',
      profiles: '文体プロファイル',
      models: '学習モデル連携'
    };
    el.crumbCurrent.textContent = titles[view] || '文章スタジオ';

    document.querySelectorAll('.nav-item').forEach((n) => {
      n.classList.toggle('active', n.dataset.view === view);
    });

    if (view === 'history') renderHistory();
    if (view === 'profiles') renderProfiles();
    if (view === 'models') renderModelVersions();
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
    el.reportMlPane.classList.toggle('hidden', tab !== 'ml');
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

  function getActiveModelEntry() {
    if (!mlSettings.activeVersion) return null;
    return trainedModels.find((m) => m.version === mlSettings.activeVersion) || null;
  }

  function evaluateText(text) {
    const entry = getActiveModelEntry();
    return window.BunshoEngine.evaluateCombined(text, entry ? entry.model : null, mlSettings.mode);
  }

  function renderMlPanels(res) {
    const activeEntry = getActiveModelEntry();
    const ml = res.ml || { state: 'no_model' };
    const ruleScore = typeof res.ruleScore === 'number' ? res.ruleScore : res.score;

    const headingMap = {
      hybrid: '総合AI文体スコア（併用）',
      ml: 'AI類似傾向スコア（学習モデル）',
      rule: 'AI文体特徴スコア'
    };
    el.scoreHeadingTitle.textContent = (activeEntry && ml.state === 'scored')
      ? (headingMap[mlSettings.mode] || 'AI文体特徴スコア')
      : 'AI文体特徴スコア';

    el.mlStRuleScore.textContent = `${ruleScore} / 100`;

    if (!activeEntry) {
      el.mlSummaryTitle.textContent = 'TRAINING LAB 学習モデル';
      el.mlSummaryBadge.className = 'ml-verdict-badge';
      el.mlSummaryBadge.textContent = '未連携';
      el.mlSummaryDetail.textContent = 'モデルJSONを読み込むと、ルール判定と比較・併用できます。';

      el.mlPaneModelName.textContent = 'モデル未設定';
      el.mlPaneVerdict.className = 'ml-verdict-badge';
      el.mlPaneVerdict.textContent = '未連携';
      el.mlPaneVersion.textContent = 'TRAINING LAB で出力したモデルJSON（script-lab-char-tfidf-v1）を読み込んでください。';
      el.mlStProb.textContent = '—';
      el.mlStThreshold.textContent = '—';
      el.mlStMatched.textContent = '一致特徴量: —';
      el.mlProbBar.style.width = '0%';
      el.mlThresholdMarker.classList.add('hidden');
      el.mlTopAiGrams.innerHTML = '<span class="stat-tag">モデル未読み込み</span>';
      el.mlTopHumanGrams.innerHTML = '<span class="stat-tag">モデル未読み込み</span>';
      return;
    }

    const displayName = activeEntry.memo || activeEntry.version;
    const threshPct = Number((activeEntry.threshold * 100).toFixed(1));
    el.mlSummaryTitle.textContent = `学習モデル: ${displayName}`;
    el.mlPaneModelName.textContent = displayName;
    el.mlPaneVersion.textContent = `${activeEntry.version}（特徴量 ${activeEntry.featureCount.toLocaleString()}件・しきい値 ${threshPct}%）`;
    el.mlStThreshold.textContent = `${threshPct}%`;
    el.mlThresholdMarker.style.left = `${Math.max(2, Math.min(98, threshPct))}%`;
    el.mlThresholdMarker.classList.remove('hidden');

    if (ml.state === 'scored') {
      const probPct = Number((ml.probability * 100).toFixed(1));
      const badgeCls = ml.aiLike ? 'ml-verdict-badge ai' : 'ml-verdict-badge human';
      const badgeText = ml.aiLike ? `AI傾向 ${probPct}%（≥${ml.threshold100}%）` : `人間傾向 ${probPct}%（<${ml.threshold100}%）`;
      el.mlSummaryBadge.className = badgeCls;
      el.mlSummaryBadge.textContent = badgeText;
      el.mlSummaryDetail.textContent = `ルール単体: ${ruleScore} / 100 ｜ 学習モデル: ${ml.score100} / 100（一致 ${ml.matchedFeatures.toLocaleString()}語）`;

      el.mlPaneVerdict.className = badgeCls;
      el.mlPaneVerdict.textContent = ml.aiLike ? 'しきい値以上（AI傾向）' : 'しきい値未満（人間傾向）';
      el.mlStProb.textContent = `${probPct}%`;
      el.mlStMatched.textContent = `一致特徴量: ${ml.matchedFeatures.toLocaleString()} / ${ml.totalFeatures.toLocaleString()}`;
      el.mlProbBar.style.width = `${Math.max(1, Math.min(100, probPct))}%`;
      el.mlProbBar.className = 'ml-threshold-fill ' + (ml.aiLike ? 'fill-rose' : 'fill-emerald');

      el.mlTopAiGrams.innerHTML = ml.topAiTerms.length
        ? ml.topAiTerms.map((g) => `<span class="stat-tag ai-gram">「${esc(g.term)}」×${g.count} (+${g.impact})</span>`).join('')
        : '<span class="stat-tag">顕著なAI寄りパターンなし</span>';

      el.mlTopHumanGrams.innerHTML = ml.topHumanTerms.length
        ? ml.topHumanTerms.map((g) => `<span class="stat-tag human-gram">「${esc(g.term)}」×${g.count} (-${g.impact})</span>`).join('')
        : '<span class="stat-tag">顕著な人間寄りパターンなし</span>';
    } else {
      const reasonMap = {
        empty: '原稿を入力すると学習モデルでも推論します。',
        short: `100字未満（現在 ${ml.chars || 0}字）のため学習モデル判定は保留し、ルール判定のみ表示しています。`,
        too_long: '20,000字を超えているため学習モデル判定の対象外です。',
        unmatched: '学習モデルの特徴量と一致する文字パターンがありませんでした。'
      };
      el.mlSummaryBadge.className = 'ml-verdict-badge pending';
      el.mlSummaryBadge.textContent = ml.state === 'empty' ? '待機中' : '判定保留';
      el.mlSummaryDetail.textContent = reasonMap[ml.state] || '判定保留';

      el.mlPaneVerdict.className = 'ml-verdict-badge pending';
      el.mlPaneVerdict.textContent = ml.state === 'empty' ? '原稿待ち' : '保留';
      el.mlStProb.textContent = '保留';
      el.mlStMatched.textContent = '一致特徴量: —';
      el.mlProbBar.style.width = '0%';
      el.mlTopAiGrams.innerHTML = `<span class="stat-tag">${esc(reasonMap[ml.state] || '100字以上で表示')}</span>`;
      el.mlTopHumanGrams.innerHTML = `<span class="stat-tag">${esc(reasonMap[ml.state] || '100字以上で表示')}</span>`;
    }
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
    renderMlPanels(res);

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
    const res = evaluateText(text);
    renderDetection(res);
    if (!silent) {
      const mlTag = res.ml?.state === 'scored' ? `・学習モデル ${res.ml.score100}%` : '';
      showToast(`AI文体チェック完了：スコア ${res.score} / 100（検出 ${res.matches.length} 件${mlTag}）`);
    }
    return res;
  }

  function formatAfterCaption(prefix, beforeRes, afterRes) {
    const mlCompare = (beforeRes.ml?.state === 'scored' && afterRes.ml?.state === 'scored')
      ? ` ｜ 学習モデル ${beforeRes.ml.score100}% → ${afterRes.ml.score100}%`
      : '';
    return `${prefix}: ${afterRes.score} / 100（変換前 ${beforeRes.score}${mlCompare}）`;
  }

  function runRewrite(bumpSeed) {
    const text = el.inputText.value.trim();
    if (!text) {
      showToast('整える原稿を入力してください');
      return;
    }
    if (bumpSeed) variantSeed++;

    const beforeRes = evaluateText(text);
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
    const afterRes = evaluateText(converted.text);

    const diffPt = afterRes.score - beforeRes.score;
    el.rewriteDeltaBadge.textContent = diffPt < 0
      ? `スコア ${beforeRes.score} → ${afterRes.score}（${diffPt}pt改善）`
      : `スコア ${beforeRes.score} → ${afterRes.score}`;
    el.rewriteDeltaBadge.classList.remove('hidden');
    el.afterScoreCaption.textContent = formatAfterCaption('変換後のAI文体スコア', beforeRes, afterRes);

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

  // AI Config (Gemini / ChatGPT / Claude)
  function loadAiConfig() {
    try {
      const raw = localStorage.getItem(AI_CONFIG_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.activeProvider && AI_PROVIDERS[parsed.activeProvider]) {
          aiConfig.activeProvider = parsed.activeProvider;
        }
        aiConfig.keys = Object.assign({ gemini: '', openai: '', claude: '' }, parsed.keys || {});
        aiConfig.models = Object.assign(
          {
            gemini: AI_PROVIDERS.gemini.defaultModel,
            openai: AI_PROVIDERS.openai.defaultModel,
            claude: AI_PROVIDERS.claude.defaultModel
          },
          parsed.models || {}
        );
        // 旧デフォルトからの自動アップグレード
        if (aiConfig.models.gemini === 'gemini-2.0-flash') aiConfig.models.gemini = AI_PROVIDERS.gemini.defaultModel;
        if (aiConfig.models.openai === 'gpt-4o-mini') aiConfig.models.openai = AI_PROVIDERS.openai.defaultModel;
        if (aiConfig.models.claude === 'claude-3-5-sonnet-latest') aiConfig.models.claude = AI_PROVIDERS.claude.defaultModel;
      } else {
        const legacy = localStorage.getItem(LEGACY_GEMINI_KEY);
        if (legacy) aiConfig.keys.gemini = legacy;
      }
    } catch {}
    editingProvider = aiConfig.activeProvider;
  }

  function saveAiConfig() {
    try {
      localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(aiConfig));
    } catch {}
  }

  function buildRewritePrompt(text) {
    const presetLabel = el.optPreset.options[el.optPreset.selectedIndex].text;
    const activeProfile = profiles.length > 0 ? profiles[0] : null;
    const lines = [
      'あなたは日本語の編集者です。以下の原稿からAI特有の定型句・翻訳調・過剰な装飾を取り除き、元の意味・主張・引用・専門用語・事実を保ったまま、人間が自然に書いた読みやすい日本語へ整えてください。',
      `文体指定: ${presetLabel}`,
      `変更度: ${el.optIntensity.value}/100`,
      el.chkKeepQuotes.checked ? '引用（「…」『…』）と専門用語は改変せず維持してください。' : '',
      el.chkRemoveMd.checked ? 'Markdownの太字(**)や機械的な箇条書きは自然な地の文へ整えてください。' : '',
      el.chkVaryEndings.checked ? '同じ文末表現の連続を避け、自然なリズムにしてください。' : '',
      (el.optPreset.value === 'profile' && activeProfile)
        ? `参考にする自分の文体傾向: ${activeProfile.toneLabel}、平均文長 約${activeProfile.avgLen}字、よく使う文末 ${(activeProfile.topEndings || []).join('・')}`
        : '',
      '出力は書き直した本文のみを返し、解説や前置きは書かないでください。',
      '',
      '【原稿】',
      text
    ].filter(Boolean);
    return lines.join('\n');
  }

  async function callExternalAiApi(provider, apiKey, model, prompt) {
    if (provider === 'gemini') {
      const m = model || AI_PROVIDERS.gemini.defaultModel;
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        }
      );
      if (!resp.ok) throw new Error(`Gemini API HTTP ${resp.status}`);
      const data = await resp.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    }

    if (provider === 'openai') {
      const m = model || AI_PROVIDERS.openai.defaultModel;
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: m,
          messages: [
            { role: 'system', content: 'あなたは日本語の文章編集者です。指示に従い、書き直した本文のみを返してください。' },
            { role: 'user', content: prompt }
          ]
        })
      });
      if (!resp.ok) throw new Error(`OpenAI API HTTP ${resp.status}`);
      const data = await resp.json();
      return data?.choices?.[0]?.message?.content?.trim() || '';
    }

    if (provider === 'claude') {
      const m = model || AI_PROVIDERS.claude.defaultModel;
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: m,
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      if (!resp.ok) throw new Error(`Claude API HTTP ${resp.status}`);
      const data = await resp.json();
      return (data?.content || []).map((b) => b.text || '').join('').trim();
    }

    throw new Error('未対応のプロバイダです');
  }

  async function runApiRewrite() {
    const provider = aiConfig.activeProvider;
    const apiKey = (aiConfig.keys[provider] || '').trim();
    const model = (aiConfig.models[provider] || AI_PROVIDERS[provider].defaultModel).trim();
    const pName = AI_PROVIDERS[provider].name;
    const text = el.inputText.value.trim();

    if (!apiKey) {
      openApiModal(provider);
      return;
    }
    if (!text) {
      showToast('原稿を入力してください');
      return;
    }

    const beforeRes = evaluateText(text);
    el.btnAiRewrite.disabled = true;
    el.btnAiRewrite.textContent = `${pName} でリライト中…`;

    try {
      const prompt = buildRewritePrompt(text);
      const rewritten = await callExternalAiApi(provider, apiKey, model, prompt);
      if (!rewritten) throw new Error('応答が空でした');

      el.outputText.value = rewritten;
      const afterRes = evaluateText(rewritten);
      const diffPt = afterRes.score - beforeRes.score;
      el.rewriteDeltaBadge.textContent = diffPt < 0
        ? `スコア ${beforeRes.score} → ${afterRes.score}（${diffPt}pt改善）`
        : `スコア ${beforeRes.score} → ${afterRes.score}`;
      el.rewriteDeltaBadge.classList.remove('hidden');
      el.afterScoreCaption.textContent = formatAfterCaption(`${pName} リライト後のAI文体スコア`, beforeRes, afterRes);
      el.diffCanvas.innerHTML = window.BunshoEngine.buildDiffHtml(text, rewritten);
      el.changeCountBadge.textContent = '1';
      el.changesList.innerHTML = `<li class="change-item"><div class="change-cat">高度AIリライト (${esc(pName)})</div><div>モデル ${esc(model)} を使用して文脈全体をより自然な日本語に整えました。</div></li>`;

      saveHistoryEntry({
        id: Date.now(),
        createdAt: Date.now(),
        beforeScore: beforeRes.score,
        afterScore: afterRes.score,
        input: text,
        output: rewritten
      });

      switchOutTab('result');
      showToast(`${pName} リライト完了（スコア ${beforeRes.score} → ${afterRes.score}）`);
    } catch (err) {
      showToast(`${pName} APIでのリライトに失敗しました（${err.message || '通信・キー確認'}）`);
    } finally {
      el.btnAiRewrite.disabled = false;
      syncApiBtn();
    }
  }

  async function openWebAi(target) {
    const text = el.inputText.value.trim();
    if (!text) {
      showToast('連携する原稿を先に入力してください');
      return;
    }
    const prompt = buildRewritePrompt(text);
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {}

    const encoded = encodeURIComponent(prompt.slice(0, 1800));
    const url = target === 'chatgpt'
      ? `https://chatgpt.com/?q=${encoded}`
      : `https://claude.ai/new?q=${encoded}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    showToast(`リライト用プロンプトをコピーし、${target === 'chatgpt' ? 'ChatGPT' : 'Claude'} を開きました`);
  }

  function renderApiModalProvider(provider) {
    editingProvider = provider;
    const meta = AI_PROVIDERS[provider];
    document.querySelectorAll('.provider-tab').forEach((t) => {
      const active = t.dataset.provider === provider;
      t.classList.toggle('active', active);
      t.setAttribute('aria-selected', String(active));
    });
    el.apiKeyLabel.textContent = meta.keyLabel;
    el.inputApiKey.placeholder = meta.placeholder;
    el.inputApiKey.value = aiConfig.keys[provider] || '';
    el.inputApiModel.placeholder = meta.defaultModel;
    const currentModel = aiConfig.models[provider] || meta.defaultModel;
    el.inputApiModel.value = currentModel;
    el.providerNote.textContent = meta.note;

    el.modelPresets.innerHTML = '';
    (meta.presets || []).forEach((preset) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'model-chip' + (preset.id === currentModel ? ' active' : '');
      btn.textContent = `${preset.label} (${preset.id})`;
      btn.addEventListener('click', () => {
        el.inputApiModel.value = preset.id;
        el.modelPresets.querySelectorAll('.model-chip').forEach((c) => c.classList.toggle('active', c === btn));
      });
      el.modelPresets.appendChild(btn);
    });
  }

  function openApiModal(provider) {
    renderApiModalProvider(provider || aiConfig.activeProvider);
    el.apiModal.classList.remove('hidden');
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

  // Trained Models (TRAINING LAB Integration + IndexedDB Version Store)
  function openModelDb() {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') return reject(new Error('no-idb'));
      const req = indexedDB.open(ML_DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(ML_STORE)) {
          req.result.createObjectStore(ML_STORE, { keyPath: 'version' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('idb-error'));
    });
  }

  async function readAllStoredModels() {
    try {
      const db = await openModelDb();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(ML_STORE, 'readonly');
        const req = tx.objectStore(ML_STORE).getAll();
        req.onsuccess = () => { db.close(); resolve(req.result || []); };
        req.onerror = () => { db.close(); reject(req.error); };
      });
    } catch {
      try {
        return JSON.parse(localStorage.getItem(ML_FALLBACK_KEY) || '[]');
      } catch {
        return [];
      }
    }
  }

  async function saveStoredModelEntry(entry) {
    try {
      const db = await openModelDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(ML_STORE, 'readwrite');
        tx.objectStore(ML_STORE).put(entry);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      });
    } catch {
      try {
        const list = trainedModels.slice(0, 5);
        localStorage.setItem(ML_FALLBACK_KEY, JSON.stringify(list));
      } catch {}
    }
  }

  async function deleteStoredModelEntry(version) {
    try {
      const db = await openModelDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(ML_STORE, 'readwrite');
        tx.objectStore(ML_STORE).delete(version);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      });
    } catch {
      try {
        localStorage.setItem(ML_FALLBACK_KEY, JSON.stringify(trainedModels.slice(0, 5)));
      } catch {}
    }
  }

  function loadMlSettings() {
    try {
      const parsed = JSON.parse(localStorage.getItem(ML_SETTINGS_KEY) || '{}');
      if (['hybrid', 'ml', 'rule'].includes(parsed.mode)) mlSettings.mode = parsed.mode;
      if (typeof parsed.activeVersion === 'string') mlSettings.activeVersion = parsed.activeVersion;
    } catch {}
  }

  function saveMlSettings() {
    try {
      localStorage.setItem(ML_SETTINGS_KEY, JSON.stringify(mlSettings));
    } catch {}
  }

  function syncMlModeUi() {
    document.querySelectorAll('[data-ml-mode]').forEach((btn) => {
      const active = btn.dataset.mlMode === mlSettings.mode;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
    const modeNotes = {
      hybrid: '併用モード：100字以上の原稿でルールベース判定（50%）と学習モデル類似度（50%）を統合し、両方の内訳を並べて表示します。',
      ml: '学習モデル優先モード：100字以上の原稿で TRAINING LAB モデルの類似度をメインスコアに表示します（5指標とハイライトも併用可能）。',
      rule: 'ルールのみ（比較モード）：メインスコアは既存のルール判定のまま維持し、学習モデルの推論結果を比較用に併記します。'
    };
    if (el.mlModeExplain) el.mlModeExplain.textContent = modeNotes[mlSettings.mode] || modeNotes.hybrid;

    const activeEntry = getActiveModelEntry();
    if (el.navModelBadge) {
      el.navModelBadge.textContent = activeEntry ? '連携中' : (trainedModels.length ? `${trainedModels.length}` : '未連携');
    }
    const quickBtn = $('btnOpenModelsQuick');
    if (quickBtn) {
      quickBtn.textContent = activeEntry ? 'モデル連携中' : 'モデル連携';
      quickBtn.classList.toggle('accent-outline', Boolean(activeEntry));
    }
    if (el.btnDisableModel) {
      el.btnDisableModel.classList.toggle('hidden', !activeEntry);
    }
  }

  function refreshCurrentEvaluation() {
    const text = el.inputText.value.trim();
    renderDetection(evaluateText(text));
  }

  async function initTrainedModels() {
    loadMlSettings();
    const loaded = await readAllStoredModels();
    trainedModels = loaded
      .filter((item) => item && item.model && item.version)
      .sort((a, b) => (b.importedAt || 0) - (a.importedAt || 0));
    if (mlSettings.activeVersion && !trainedModels.some((m) => m.version === mlSettings.activeVersion)) {
      mlSettings.activeVersion = trainedModels[0]?.version || '';
      saveMlSettings();
    }
    syncMlModeUi();
    renderModelVersions();
    refreshCurrentEvaluation();
  }

  async function handleModelFileImport(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('モデルJSONのサイズは 5MB 以下にしてください');
      return;
    }
    const origLabel = el.modelUploadBtnText.textContent;
    el.modelUploadBtnText.textContent = '検証中…';
    try {
      const rawText = await file.text();
      let parsed;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        throw new Error('有効な JSON ファイルではありません。TRAINING LAB の「モデルJSONを保存」で出力したファイルを選択してください。');
      }
      const meta = window.BunshoEngine.validateTrainedModel(parsed);
      const memo = el.modelMemoInput.value.trim() || file.name.replace(/\.json$/i, '');
      const normalizedModel = {
        format: meta.format,
        version: meta.version,
        threshold: meta.threshold,
        bias: meta.bias,
        features: parsed.features
      };
      const entry = {
        version: meta.version,
        memo,
        importedAt: Date.now(),
        featureCount: meta.featureCount,
        threshold: meta.threshold,
        bias: meta.bias,
        model: normalizedModel
      };

      trainedModels = [entry, ...trainedModels.filter((m) => m.version !== entry.version)];
      if (trainedModels.length > MAX_SAVED_MODELS) {
        const overflow = trainedModels.splice(MAX_SAVED_MODELS);
        for (const old of overflow) await deleteStoredModelEntry(old.version);
      }
      await saveStoredModelEntry(entry);

      mlSettings.activeVersion = entry.version;
      saveMlSettings();
      el.modelMemoInput.value = '';
      syncMlModeUi();
      renderModelVersions();
      refreshCurrentEvaluation();
      showToast(`学習モデル「${memo}」（特徴量 ${meta.featureCount.toLocaleString()}件）を適用しました`);
    } catch (err) {
      showToast(err.message || 'モデルの読み込みに失敗しました');
    } finally {
      el.modelUploadBtnText.textContent = origLabel;
      el.modelFileInput.value = '';
    }
  }

  function renderModelVersions() {
    syncMlModeUi();
    if (!el.modelVersionList) return;
    if (trainedModels.length === 0) {
      el.modelVersionList.innerHTML = '<div class="empty-note">まだ学習モデルが登録されていません。<br>TRAINING LAB で出力した <code>sl-*.json</code> を左のフォームから読み込んでください。</div>';
      return;
    }
    el.modelVersionList.innerHTML = '';
    trainedModels.forEach((item) => {
      const isActive = item.version === mlSettings.activeVersion;
      const d = new Date(item.importedAt || Date.now());
      const stamp = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      const threshPct = Number((item.threshold * 100).toFixed(1));

      const card = document.createElement('div');
      card.className = 'model-card' + (isActive ? ' active-model' : '');
      card.innerHTML = `
        <div class="model-card-head">
          <div>
            <strong>${esc(item.memo || item.version)}</strong>
            <div class="model-version-code">${esc(item.version)}</div>
          </div>
          ${isActive ? '<span class="verdict-pill">使用中</span>' : ''}
        </div>
        <div class="tag-cloud">
          <span class="stat-tag">特徴量: ${item.featureCount.toLocaleString()}件</span>
          <span class="stat-tag">しきい値: ${threshPct}%</span>
          <span class="stat-tag">取込: ${stamp}</span>
        </div>
        <div class="model-card-actions">
          ${isActive
            ? '<button type="button" class="outline-btn sm" data-deactivate-model="1">一時オフ</button>'
            : `<button type="button" class="primary-btn xs" data-activate-model="${esc(item.version)}">このモデルを使用（復元）</button>`}
          <button type="button" class="text-btn" data-export-model="${esc(item.version)}">JSON出力</button>
          <button type="button" class="text-btn" data-delete-model="${esc(item.version)}">削除</button>
        </div>
      `;

      const btnAct = card.querySelector('[data-activate-model]');
      if (btnAct) {
        btnAct.addEventListener('click', () => {
          mlSettings.activeVersion = item.version;
          saveMlSettings();
          renderModelVersions();
          refreshCurrentEvaluation();
          showToast(`モデル「${item.memo || item.version}」に切り替えました`);
        });
      }
      const btnDeact = card.querySelector('[data-deactivate-model]');
      if (btnDeact) {
        btnDeact.addEventListener('click', () => {
          mlSettings.activeVersion = '';
          saveMlSettings();
          renderModelVersions();
          refreshCurrentEvaluation();
          showToast('学習モデル連携を一時オフにしました（データは保持されています）');
        });
      }
      card.querySelector('[data-export-model]').addEventListener('click', () => {
        downloadBlob(`${item.version}.json`, JSON.stringify(item.model), 'application/json;charset=utf-8');
        showToast('モデルJSONを書き出しました');
      });
      card.querySelector('[data-delete-model]').addEventListener('click', async () => {
        trainedModels = trainedModels.filter((m) => m.version !== item.version);
        await deleteStoredModelEntry(item.version);
        if (mlSettings.activeVersion === item.version) {
          mlSettings.activeVersion = trainedModels[0]?.version || '';
          saveMlSettings();
        }
        renderModelVersions();
        refreshCurrentEvaluation();
        showToast('保存済みモデルを削除しました');
      });

      el.modelVersionList.appendChild(card);
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
    const p = aiConfig.activeProvider;
    const hasKey = Boolean((aiConfig.keys[p] || '').trim());
    el.btnAiRewrite.classList.toggle('hidden', !hasKey);
    el.btnAiRewrite.textContent = `高度AIリライト (${AI_PROVIDERS[p].name})`;
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
    $('btnOpenChatGpt').addEventListener('click', () => openWebAi('chatgpt'));
    $('btnOpenClaude').addEventListener('click', () => openWebAi('claude'));
    el.btnAiRewrite.addEventListener('click', runApiRewrite);
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

    // Profiles: add sample field & Word/PDF file import
    const createProfileSampleItem = (idx) => {
      const wrap = document.createElement('div');
      wrap.className = 'ctrl-field prof-sample-item';
      wrap.innerHTML = `
        <div class="prof-sample-head">
          <span>自作文 ${idx} <em class="prof-file-tag hidden"></em></span>
          <label class="text-btn file-upload-btn">
            ファイル読込
            <input class="prof-single-file" type="file" accept=".docx,.pdf,.txt,.md,.doc" hidden>
          </label>
        </div>
        <textarea class="prof-sample-input" rows="4" placeholder="追加のサンプル文章（Word / PDF 対応）"></textarea>
      `;
      bindSingleProfileFileInput(wrap);
      return wrap;
    };

    const bindSingleProfileFileInput = (itemEl) => {
      const input = itemEl.querySelector('.prof-single-file');
      const textarea = itemEl.querySelector('.prof-sample-input');
      const tag = itemEl.querySelector('.prof-file-tag');
      if (!input || !textarea) return;
      input.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          const res = await window.BunshoImporter.readFileAsText(file);
          textarea.value = res.text;
          if (tag) {
            tag.textContent = `${res.fileName} (${res.fileType})`;
            tag.classList.remove('hidden');
          }
          showToast(`自作文に「${res.fileName}」を読み込みました`);
        } catch (err) {
          showToast(err.message || 'ファイルの読み込みに失敗しました');
        } finally {
          input.value = '';
        }
      });
    };

    el.profSamplesWrap.querySelectorAll('.prof-sample-item').forEach(bindSingleProfileFileInput);

    const handleProfileBatchFiles = async (fileList) => {
      const files = Array.from(fileList || []);
      if (files.length === 0) return;
      const origText = el.profUploadBtnText.textContent;
      el.profUploadBtnText.textContent = '読み込み中…';
      let loadedCount = 0;

      for (const file of files) {
        try {
          const res = await window.BunshoImporter.readFileAsText(file);
          // 空の自作文欄を探し、なければ新規追加
          let targetItem = Array.from(el.profSamplesWrap.querySelectorAll('.prof-sample-item'))
            .find((it) => !it.querySelector('.prof-sample-input').value.trim());
          if (!targetItem) {
            const nextIdx = el.profSamplesWrap.querySelectorAll('.prof-sample-item').length + 1;
            targetItem = createProfileSampleItem(nextIdx);
            el.profSamplesWrap.appendChild(targetItem);
          }
          targetItem.querySelector('.prof-sample-input').value = res.text;
          const tag = targetItem.querySelector('.prof-file-tag');
          if (tag) {
            tag.textContent = `${res.fileName} (${res.fileType})`;
            tag.classList.remove('hidden');
          }
          loadedCount++;
        } catch (err) {
          showToast(`${file.name}: ${err.message || '読み込み失敗'}`);
        }
      }

      el.profUploadBtnText.textContent = origText;
      el.profFileInput.value = '';
      if (loadedCount > 0) {
        showToast(`${loadedCount}件のファイルを自作文として読み込みました`);
      }
    };

    el.profFileInput.addEventListener('change', (e) => handleProfileBatchFiles(e.target.files));

    ['dragenter', 'dragover'].forEach((ev) => {
      el.profileDropZone.addEventListener(ev, (e) => {
        e.preventDefault();
        el.profileDropZone.classList.add('drag-over');
      });
    });
    ['dragleave', 'drop'].forEach((ev) => {
      el.profileDropZone.addEventListener(ev, (e) => {
        e.preventDefault();
        el.profileDropZone.classList.remove('drag-over');
      });
    });
    el.profileDropZone.addEventListener('drop', (e) => {
      if (e.dataTransfer?.files?.length) handleProfileBatchFiles(e.dataTransfer.files);
    });

    $('btnAddSampleField').addEventListener('click', () => {
      const idx = el.profSamplesWrap.querySelectorAll('.prof-sample-item').length + 1;
      el.profSamplesWrap.appendChild(createProfileSampleItem(idx));
    });

    $('btnSaveProfile').addEventListener('click', () => {
      const name = el.profName.value.trim() || `マイ文体 ${profiles.length + 1}`;
      const samples = Array.from(el.profSamplesWrap.querySelectorAll('.prof-sample-input')).map((t) => t.value.trim()).filter(Boolean);
      if (samples.length === 0) {
        showToast('自作文を1つ以上入力するか、Word / PDF を読み込んでください');
        return;
      }
      const analyzed = window.BunshoEngine.analyzeProfileSamples(samples);
      profiles.unshift(Object.assign({ id: Date.now(), name }, analyzed));
      saveProfiles();
      el.profName.value = '';
      el.profSamplesWrap.querySelectorAll('.prof-sample-input').forEach((t) => { t.value = ''; });
      el.profSamplesWrap.querySelectorAll('.prof-file-tag').forEach((t) => { t.textContent = ''; t.classList.add('hidden'); });
      renderProfiles();
      showToast(`文体プロファイル「${name}」を保存しました`);
    });

    // Theme & Modals
    el.btnThemeToggle.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
    });

    $('btnHowTo').addEventListener('click', () => el.howToModal.classList.remove('hidden'));
    $('btnApiSettings').addEventListener('click', () => openApiModal(aiConfig.activeProvider));
    $('btnOpenModelsQuick').addEventListener('click', () => switchView('models'));
    $('btnJumpModels').addEventListener('click', () => switchView('models'));
    $('btnOpenModelManagerFromTab').addEventListener('click', () => switchView('models'));

    document.querySelectorAll('[data-ml-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        mlSettings.mode = btn.dataset.mlMode;
        saveMlSettings();
        syncMlModeUi();
        refreshCurrentEvaluation();
        const labelMap = { hybrid: '併用（ルール＋学習）', ml: '学習モデル優先', rule: 'ルールのみ（比較）' };
        showToast(`判定モードを「${labelMap[mlSettings.mode]}」に変更しました`);
      });
    });

    el.modelFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) handleModelFileImport(e.target.files[0]);
    });
    ['dragenter', 'dragover'].forEach((ev) => {
      el.modelDropZone.addEventListener(ev, (e) => {
        e.preventDefault();
        el.modelDropZone.classList.add('drag-over');
      });
    });
    ['dragleave', 'drop'].forEach((ev) => {
      el.modelDropZone.addEventListener(ev, (e) => {
        e.preventDefault();
        el.modelDropZone.classList.remove('drag-over');
      });
    });
    el.modelDropZone.addEventListener('drop', (e) => {
      const file = e.dataTransfer?.files?.[0];
      if (file) handleModelFileImport(file);
    });
    el.btnDisableModel.addEventListener('click', () => {
      mlSettings.activeVersion = '';
      saveMlSettings();
      renderModelVersions();
      refreshCurrentEvaluation();
      showToast('学習モデル連携を一時オフにしました');
    });

    document.querySelectorAll('.provider-tab').forEach((tab) => {
      tab.addEventListener('click', () => renderApiModalProvider(tab.dataset.provider));
    });

    $('btnSaveApiKey').addEventListener('click', () => {
      const k = el.inputApiKey.value.trim();
      const m = el.inputApiModel.value.trim() || AI_PROVIDERS[editingProvider].defaultModel;
      aiConfig.keys[editingProvider] = k;
      aiConfig.models[editingProvider] = m;
      aiConfig.activeProvider = editingProvider;
      saveAiConfig();
      syncApiBtn();
      el.apiModal.classList.add('hidden');
      showToast(k ? `${AI_PROVIDERS[editingProvider].name} のAPI設定を保存しました` : `${AI_PROVIDERS[editingProvider].name} を選択しました（キー未入力）`);
    });

    $('btnRemoveApiKey').addEventListener('click', () => {
      aiConfig.keys[editingProvider] = '';
      el.inputApiKey.value = '';
      saveAiConfig();
      syncApiBtn();
      showToast(`${AI_PROVIDERS[editingProvider].name} のAPIキーを削除しました`);
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
  loadAiConfig();
  syncApiBtn();
  bindEvents();
  registerSW();

  // 初期表示は空の原稿から開始（必要なときのみ「サンプルを使う」で読込）
  el.inputText.value = '';
  updateCharCount();
  renderDetection(evaluateText(''));
  initTrainedModels();

  // Launch Splash fade-out
  const splash = $('splashScreen');
  if (splash) {
    setTimeout(() => splash.classList.add('fade-out'), 520);
    setTimeout(() => splash.remove(), 920);
  }
})();
