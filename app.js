/**
 * 文脈工房 — Bunsho Studio Main Application
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'bunsho_studio_state_v1';
  const THEME_KEY = 'bunsho_studio_theme';
  const FONT_KEY = 'bunsho_studio_font';

  const TEMPLATES = [
    {
      id: 'blank',
      name: '白紙の原稿',
      desc: '制約なく自由に書き始めるためのシンプルな原稿',
      category: 'メモ',
      tone: 'desu-masu',
      targetChars: 1000,
      audience: '',
      goal: '',
      core: '',
      outline: [{ title: '導入', note: '書き出しのフック' }, { title: '本論', note: '伝えたい内容' }],
      body: ''
    },
    {
      id: 'blog',
      name: 'ブログ・note記事',
      desc: '共感→課題→解決策→行動喚起の流れで書く記事構成',
      category: 'ブログ',
      tone: 'desu-masu',
      targetChars: 2000,
      audience: '同じ課題を抱える読者',
      goal: '記事を読み終えて最初の一歩を踏み出せる',
      core: '小さな工夫で毎日の作業は劇的に軽くなる',
      outline: [
        { title: '導入（共感と問題提起）', note: '読者の悩みを言語化する' },
        { title: '結論（この記事でわかること）', note: '先に要点を提示する' },
        { title: '具体的な手順・事例', note: '3つのステップに分けて紹介' },
        { title: 'まとめと次の一歩', note: '読後に行動できる締めくくり' }
      ],
      body: '## はじめに\n\n\n## 結論：大切なのは「文脈」を先に決めること\n\n\n## 具体的な3つのステップ\n\n\n## まとめ\n'
    },
    {
      id: 'proposal',
      name: '企画提案書',
      desc: '背景・目的・施策・期待効果を簡潔にまとめるビジネス構成',
      category: '企画書',
      tone: 'desu-masu',
      targetChars: 1500,
      audience: '意思決定者・チームメンバー',
      goal: '企画の意図に納得し、実行承認を得られる',
      core: '最小コストで最大のユーザー価値を生む施策を提案する',
      outline: [
        { title: '1. 背景と現状課題', note: 'データや現場の声を添える' },
        { title: '2. 企画のゴール', note: '達成したい状態・KPI' },
        { title: '3. 提案内容とスケジュール', note: '具体的な進め方' },
        { title: '4. 期待効果とリスク対策', note: '懸念点への先回り回答' }
      ],
      body: '## 1. 背景と現状課題\n\n\n## 2. 企画の目的とゴール\n\n\n## 3. 提案内容\n\n\n## 4. 期待される効果とネクストアクション\n'
    },
    {
      id: 'essay',
      name: 'エッセイ・随筆',
      desc: '日常の気づきや記憶を静かに掘り下げる随筆スタイル',
      category: 'エッセイ',
      tone: 'da-dearu',
      targetChars: 1600,
      audience: '静かな読書時間を楽しむ人',
      goal: '読後に小さな余韻と新しい視点が残る',
      core: '見過ごしていた風景の中にこそ、暮らしの輪郭がある',
      outline: [
        { title: '情景の切り取り', note: '五感に訴える冒頭描写' },
        { title: '記憶や思索の広がり', note: '過去の体験と結びつける' },
        { title: '静かな結び', note: '言い切らずに余白を残す' }
      ],
      body: ''
    }
  ];

  function createWelcomeDoc() {
    const now = Date.now();
    return {
      id: 'doc_' + now,
      title: '文脈工房へようこそ',
      category: 'エッセイ',
      targetChars: 800,
      updatedAt: now,
      context: {
        audience: 'これから文章を書き始めるすべての人',
        goal: '文脈カードと推敲機能の使い心地を体感する',
        tone: 'desu-masu',
        core: '書く前に「誰に・何を・なぜ」を整えると、言葉は迷わなくなる。'
      },
      outline: [
        { id: 'o1', title: '文脈を先に整える理由', note: '書き出しの迷いを減らす' },
        { id: 'o2', title: '推敲パネルの使い方', note: '文体・長文・表記ゆれをその場で確認' },
        { id: 'o3', title: '縦書きと集中モード', note: '視点を変えてリズムを確かめる' }
      ],
      customRules: [
        { id: 'r1', from: 'Webアプリ', to: 'PWA' }
      ],
      snapshots: [
        {
          id: 's1',
          label: '初回サンプル版',
          createdAt: now,
          title: '文脈工房へようこそ',
          body: '## 書く前に、文脈を整える\n\n文章が途中で迷子になる一番の原因は、「誰に向けて、何のために書くのか」が曖昧なまま書き始めてしまうことです。'
        }
      ],
      body: [
        '## 書く前に、文脈を整える',
        '',
        '文章が途中で迷子になる一番の原因は、「誰に向けて、何のために書くのか」が曖昧なまま書き始めてしまう事です。文脈工房では、執筆画面のすぐ横に**文脈カード**と**構成ブロック**を常設しています。',
        '',
        '## 推敲パネルで言葉を磨く',
        '',
        '右側の「推敲」タブを開くと、文体の混在や表記ゆれ、長すぎる一文をオフラインのまま自動で検出する。たとえばこのWebアプリでは、｜漢字《かんじ》の割合バランスもひと目で確認する事が出来ます。',
        '',
        '## 視点を変えて読み返す',
        '',
        '書き終えたら、上部の切り替えボタンから**縦書き**プレビューを試してみてください。横書きでは見落としていたリズムの詰まりや、言葉の響きが鮮やかに浮かび上がります。'
      ].join('\n')
    };
  }

  let state = {
    docs: [],
    activeId: null,
    viewMode: 'edit',
    activeTab: 'context',
    maxSentenceLen: 80
  };

  let deferredInstallPrompt = null;
  let saveTimer = null;
  let toastTimer = null;

  // DOM References
  const $ = (id) => document.getElementById(id);
  const el = {
    app: $('app'),
    sidebar: $('sidebar'),
    inspector: $('inspector'),
    backdrop: $('backdrop'),
    saveIndicator: $('saveIndicator'),
    docList: $('docList'),
    docSearch: $('docSearch'),
    docCategoryFilter: $('docCategoryFilter'),
    docCountSummary: $('docCountSummary'),
    onlineStatus: $('onlineStatus'),
    docTitle: $('docTitle'),
    docBody: $('docBody'),
    docCategory: $('docCategory'),
    editView: $('editView'),
    previewView: $('previewView'),
    verticalView: $('verticalView'),
    verticalSheet: $('verticalSheet'),
    ribbonAudience: $('ribbonAudience'),
    ribbonTone: $('ribbonTone'),
    ribbonGoal: $('ribbonGoal'),
    metricChars: $('metricChars'),
    metricNetChars: $('metricNetChars'),
    metricManuscript: $('metricManuscript'),
    metricReadTime: $('metricReadTime'),
    metricSentences: $('metricSentences'),
    targetCharsInput: $('targetCharsInput'),
    targetProgressFill: $('targetProgressFill'),
    targetPercent: $('targetPercent'),
    ctxAudience: $('ctxAudience'),
    ctxGoal: $('ctxGoal'),
    ctxTone: $('ctxTone'),
    ctxCore: $('ctxCore'),
    outlineList: $('outlineList'),
    customRuleList: $('customRuleList'),
    issueCountBadge: $('issueCountBadge'),
    ratioKanji: $('ratioKanji'),
    ratioHira: $('ratioHira'),
    ratioKata: $('ratioKata'),
    ratioOther: $('ratioOther'),
    pctKanji: $('pctKanji'),
    pctHira: $('pctHira'),
    pctKata: $('pctKata'),
    pctOther: $('pctOther'),
    kanjiAdvice: $('kanjiAdvice'),
    maxSentenceLen: $('maxSentenceLen'),
    issueList: $('issueList'),
    snapshotLabel: $('snapshotLabel'),
    snapshotList: $('snapshotList'),
    templateModal: $('templateModal'),
    templateGrid: $('templateGrid'),
    exportModal: $('exportModal'),
    btnInstallPwa: $('btnInstallPwa'),
    btnFontFamily: $('btnFontFamily'),
    iconSun: $('iconSun'),
    iconMoon: $('iconMoon'),
    toast: $('toast')
  };

  function getActiveDoc() {
    return state.docs.find((d) => d.id === state.activeId) || state.docs[0];
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.docs) && parsed.docs.length > 0) {
          state.docs = parsed.docs;
          state.activeId = parsed.activeId || parsed.docs[0].id;
          state.maxSentenceLen = parsed.maxSentenceLen || 80;
          return;
        }
      }
    } catch (e) {
      console.warn('Failed to load state:', e);
    }
    const welcome = createWelcomeDoc();
    state.docs = [welcome];
    state.activeId = welcome.id;
  }

  function scheduleSave() {
    el.saveIndicator.textContent = '保存中…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          docs: state.docs,
          activeId: state.activeId,
          maxSentenceLen: state.maxSentenceLen
        }));
        el.saveIndicator.textContent = '保存済み';
      } catch (e) {
        el.saveIndicator.textContent = '保存エラー';
      }
    }, 250);
  }

  function showToast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.add('hidden'), 2400);
  }

  function formatDate(ts) {
    const d = new Date(ts);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${mm}/${dd} ${hh}:${mi}`;
  }

  function toneLabel(tone) {
    if (tone === 'desu-masu') return 'です・ます';
    if (tone === 'da-dearu') return 'だ・である';
    return '自由';
  }

  // Render Sidebar Document List
  function renderDocList() {
    const q = el.docSearch.value.trim().toLowerCase();
    const cat = el.docCategoryFilter.value;

    const filtered = state.docs
      .filter((d) => {
        if (cat !== 'all' && d.category !== cat) return false;
        if (!q) return true;
        return (
          (d.title || '').toLowerCase().includes(q) ||
          (d.body || '').toLowerCase().includes(q) ||
          (d.category || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);

    el.docList.innerHTML = '';
    for (const doc of filtered) {
      const li = document.createElement('li');
      li.className = 'doc-item' + (doc.id === state.activeId ? ' active' : '');
      const chars = (doc.body || '').replace(/\s/g, '').length;

      li.innerHTML = `
        <div class="doc-item-top">
          <span class="doc-item-title">${escapeHtml(doc.title || '無題の原稿')}</span>
          <div class="doc-item-actions">
            <button class="doc-mini-btn" data-dup="${doc.id}" title="複製">❐</button>
            <button class="doc-mini-btn danger" data-del="${doc.id}" title="削除">✕</button>
          </div>
        </div>
        <div class="doc-item-meta">
          <span class="cat-tag">${escapeHtml(doc.category || 'メモ')}</span>
          <span>${chars}字</span>
          <span>·</span>
          <span>${formatDate(doc.updatedAt)}</span>
        </div>
      `;

      li.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        state.activeId = doc.id;
        renderAll();
        closeMobileDrawers();
        scheduleSave();
      });

      li.querySelector('[data-dup]').addEventListener('click', (e) => {
        e.stopPropagation();
        duplicateDoc(doc.id);
      });

      li.querySelector('[data-del]').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteDoc(doc.id);
      });

      el.docList.appendChild(li);
    }

    el.docCountSummary.textContent = `${state.docs.length}件の原稿`;
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderEditor() {
    const doc = getActiveDoc();
    if (!doc) return;

    el.docTitle.value = doc.title || '';
    el.docBody.value = doc.body || '';
    el.docCategory.value = doc.category || 'メモ';
    el.targetCharsInput.value = doc.targetChars || 0;

    // Context Fields
    const ctx = doc.context || { audience: '', goal: '', tone: 'desu-masu', core: '' };
    el.ctxAudience.value = ctx.audience || '';
    el.ctxGoal.value = ctx.goal || '';
    el.ctxTone.value = ctx.tone || 'desu-masu';
    el.ctxCore.value = ctx.core || '';

    updateRibbon(ctx);
    renderOutline(doc);
    renderCustomRules(doc);
    renderSnapshots(doc);
    updateAnalysisAndPreviews();
  }

  function updateRibbon(ctx) {
    el.ribbonAudience.textContent = `読者: ${ctx.audience ? ctx.audience.slice(0, 22) : '未設定'}`;
    el.ribbonTone.textContent = `文体: ${toneLabel(ctx.tone)}`;
    el.ribbonGoal.textContent = `目的: ${ctx.goal ? ctx.goal.slice(0, 22) : '未設定'}`;
  }

  function renderOutline(doc) {
    el.outlineList.innerHTML = '';
    const blocks = doc.outline || [];
    if (blocks.length === 0) {
      el.outlineList.innerHTML = '<div class="empty-state">構成ブロックがありません。「＋ 追加」から見出し構成を作れます。</div>';
      return;
    }

    blocks.forEach((blk, idx) => {
      const card = document.createElement('div');
      card.className = 'outline-card';
      card.innerHTML = `
        <div class="outline-card-head">
          <input type="text" value="${escapeHtml(blk.title)}" placeholder="セクション見出し">
          <button class="doc-mini-btn" data-up title="上へ">↑</button>
          <button class="doc-mini-btn" data-down title="下へ">↓</button>
          <button class="doc-mini-btn danger" data-remove title="削除">✕</button>
        </div>
        <textarea placeholder="この章で伝えたい要点や根拠メモ">${escapeHtml(blk.note || '')}</textarea>
        <div class="outline-card-foot">
          <span class="helper-text">#${idx + 1}</span>
          <button class="tiny-btn" data-insert-block>本文へ見出し挿入</button>
        </div>
      `;

      const titleInput = card.querySelector('input');
      const noteInput = card.querySelector('textarea');

      titleInput.addEventListener('input', () => {
        blk.title = titleInput.value;
        doc.updatedAt = Date.now();
        scheduleSave();
      });

      noteInput.addEventListener('input', () => {
        blk.note = noteInput.value;
        doc.updatedAt = Date.now();
        scheduleSave();
      });

      card.querySelector('[data-up]').addEventListener('click', () => {
        if (idx === 0) return;
        [blocks[idx - 1], blocks[idx]] = [blocks[idx], blocks[idx - 1]];
        renderOutline(doc);
        scheduleSave();
      });

      card.querySelector('[data-down]').addEventListener('click', () => {
        if (idx === blocks.length - 1) return;
        [blocks[idx + 1], blocks[idx]] = [blocks[idx], blocks[idx + 1]];
        renderOutline(doc);
        scheduleSave();
      });

      card.querySelector('[data-remove]').addEventListener('click', () => {
        blocks.splice(idx, 1);
        renderOutline(doc);
        scheduleSave();
      });

      card.querySelector('[data-insert-block]').addEventListener('click', () => {
        const heading = `\n## ${blk.title || '新しい見出し'}\n\n`;
        insertAtCursor(heading);
        showToast('見出しを本文へ挿入しました');
      });

      el.outlineList.appendChild(card);
    });
  }

  function renderCustomRules(doc) {
    el.customRuleList.innerHTML = '';
    const rules = doc.customRules || [];
    if (rules.length === 0) {
      el.customRuleList.innerHTML = '<div class="empty-state">カスタム表記ルールはまだありません。</div>';
      return;
    }

    rules.forEach((rule, idx) => {
      const row = document.createElement('div');
      row.className = 'rule-row';
      row.innerHTML = `
        <input type="text" data-from value="${escapeHtml(rule.from)}" placeholder="置換前">
        <span>→</span>
        <input type="text" data-to value="${escapeHtml(rule.to)}" placeholder="統一後">
        <button class="doc-mini-btn danger" data-del title="削除">✕</button>
      `;

      const fromEl = row.querySelector('[data-from]');
      const toEl = row.querySelector('[data-to]');

      const onChange = () => {
        rule.from = fromEl.value;
        rule.to = toEl.value;
        updateAnalysisAndPreviews();
        scheduleSave();
      };

      fromEl.addEventListener('input', onChange);
      toEl.addEventListener('input', onChange);
      row.querySelector('[data-del]').addEventListener('click', () => {
        rules.splice(idx, 1);
        renderCustomRules(doc);
        updateAnalysisAndPreviews();
        scheduleSave();
      });

      el.customRuleList.appendChild(row);
    });
  }

  function renderSnapshots(doc) {
    el.snapshotList.innerHTML = '';
    const snaps = doc.snapshots || [];
    if (snaps.length === 0) {
      el.snapshotList.innerHTML = '<div class="empty-state">まだ保存された版はありません。</div>';
      return;
    }

    snaps.forEach((snap, idx) => {
      const card = document.createElement('div');
      card.className = 'snapshot-card';
      const chars = (snap.body || '').replace(/\s/g, '').length;
      card.innerHTML = `
        <div class="snapshot-top">
          <span class="snapshot-name">${escapeHtml(snap.label || '無題の版')}</span>
          <button class="doc-mini-btn danger" data-del title="削除">✕</button>
        </div>
        <div class="snapshot-meta">${formatDate(snap.createdAt)} · ${chars}文字</div>
        <div class="issue-actions">
          <button class="tiny-btn" data-restore>この版に復元</button>
        </div>
      `;

      card.querySelector('[data-restore]').addEventListener('click', () => {
        if (!confirm(`「${snap.label}」の内容で現在の本文を置き換えますか？`)) return;
        doc.title = snap.title;
        doc.body = snap.body;
        doc.updatedAt = Date.now();
        renderAll();
        scheduleSave();
        showToast('スナップショットを復元しました');
      });

      card.querySelector('[data-del]').addEventListener('click', () => {
        snaps.splice(idx, 1);
        renderSnapshots(doc);
        scheduleSave();
      });

      el.snapshotList.appendChild(card);
    });
  }

  function updateAnalysisAndPreviews() {
    const doc = getActiveDoc();
    if (!doc) return;

    const result = window.BunshoAnalyzer.analyze(doc.body || '', {
      tone: (doc.context && doc.context.tone) || 'desu-masu',
      maxSentenceLen: state.maxSentenceLen,
      customRules: doc.customRules || []
    });

    // Metrics
    el.metricChars.textContent = result.totalChars.toLocaleString();
    el.metricNetChars.textContent = result.netChars.toLocaleString();
    el.metricManuscript.textContent = result.manuscriptPages;
    el.metricReadTime.textContent = result.readMinutes;
    el.metricSentences.textContent = result.sentenceCount;

    const target = Number(doc.targetChars) || 0;
    const pct = target > 0 ? Math.min(100, Math.round((result.netChars / target) * 100)) : 0;
    el.targetProgressFill.style.width = `${pct}%`;
    el.targetPercent.textContent = target > 0 ? `${pct}%` : '—';

    // Ratios
    const r = result.ratios;
    el.ratioKanji.style.width = `${r.kanji}%`;
    el.ratioHira.style.width = `${r.hira}%`;
    el.ratioKata.style.width = `${r.kata}%`;
    el.ratioOther.style.width = `${r.other}%`;
    el.pctKanji.textContent = `${r.kanji}%`;
    el.pctHira.textContent = `${r.hira}%`;
    el.pctKata.textContent = `${r.kata}%`;
    el.pctOther.textContent = `${r.other}%`;

    if (r.total < 20) {
      el.kanjiAdvice.textContent = '20文字以上書くと読みやすさのバランス診断が表示されます。';
    } else if (r.kanji > 40) {
      el.kanjiAdvice.textContent = '漢字率がやや高め（40%超）です。ひらがなを増やすと柔らかく読みやすくなります。';
    } else if (r.kanji < 20) {
      el.kanjiAdvice.textContent = 'ひらがなが多めです。要所に漢字を使うと視認性が上がります。';
    } else {
      el.kanjiAdvice.textContent = '漢字20〜40%の読みやすい黄金バランスです。';
    }

    // Issues
    el.issueCountBadge.textContent = result.issues.length;
    el.issueList.innerHTML = '';
    if (result.issues.length === 0) {
      el.issueList.innerHTML = '<div class="empty-state">推敲アラートはありません。美しい仕上がりです。</div>';
    } else {
      result.issues.forEach((issue) => {
        const card = document.createElement('div');
        card.className = `issue-card sev-${issue.severity}`;
        card.innerHTML = `
          <div class="issue-head">
            <span class="issue-type">${escapeHtml(issue.type)}</span>
          </div>
          <div class="issue-msg">${escapeHtml(issue.message)}</div>
          <div class="issue-excerpt">${escapeHtml(issue.excerpt)}</div>
          <div class="issue-actions">
            <button class="tiny-btn" data-jump>該当箇所へ</button>
            ${issue.replaceTo ? `<button class="tiny-btn" data-fix>「${escapeHtml(issue.replaceTo)}」に置換</button>` : ''}
          </div>
        `;

        card.querySelector('[data-jump]').addEventListener('click', () => {
          setViewMode('edit');
          el.docBody.focus();
          el.docBody.setSelectionRange(issue.index, issue.index + issue.length);
          closeMobileDrawers();
        });

        const fixBtn = card.querySelector('[data-fix]');
        if (fixBtn) {
          fixBtn.addEventListener('click', () => {
            const current = doc.body || '';
            const before = current.slice(0, issue.index);
            const targetSlice = current.slice(issue.index, issue.index + issue.length);
            if (targetSlice === issue.replaceFrom) {
              doc.body = before + issue.replaceTo + current.slice(issue.index + issue.length);
              el.docBody.value = doc.body;
              doc.updatedAt = Date.now();
              updateAnalysisAndPreviews();
              renderDocList();
              scheduleSave();
              showToast(`「${issue.replaceFrom}」を「${issue.replaceTo}」に置換しました`);
            }
          });
        }

        el.issueList.appendChild(card);
      });
    }

    // Update Previews if visible
    if (state.viewMode !== 'edit') {
      const html = window.BunshoAnalyzer.renderMarkdownHtml(doc.title || '無題の原稿', doc.body || '');
      el.previewView.innerHTML = html;
      el.verticalSheet.innerHTML = html;
    }
  }

  function renderAll() {
    renderDocList();
    renderEditor();
  }

  // Document CRUD
  function createDocFromTemplate(tpl) {
    const now = Date.now();
    const doc = {
      id: 'doc_' + now + '_' + Math.floor(Math.random() * 1000),
      title: tpl.id === 'blank' ? '' : tpl.name,
      category: tpl.category,
      targetChars: tpl.targetChars,
      updatedAt: now,
      context: {
        audience: tpl.audience,
        goal: tpl.goal,
        tone: tpl.tone,
        core: tpl.core
      },
      outline: (tpl.outline || []).map((o, i) => ({
        id: 'o_' + now + '_' + i,
        title: o.title,
        note: o.note
      })),
      customRules: [],
      snapshots: [],
      body: tpl.body || ''
    };
    state.docs.unshift(doc);
    state.activeId = doc.id;
    setViewMode('edit');
    renderAll();
    scheduleSave();
    el.docTitle.focus();
  }

  function duplicateDoc(id) {
    const src = state.docs.find((d) => d.id === id);
    if (!src) return;
    const copy = JSON.parse(JSON.stringify(src));
    copy.id = 'doc_' + Date.now();
    copy.title = (copy.title || '無題の原稿') + '（コピー）';
    copy.updatedAt = Date.now();
    state.docs.unshift(copy);
    state.activeId = copy.id;
    renderAll();
    scheduleSave();
    showToast('原稿を複製しました');
  }

  function deleteDoc(id) {
    if (state.docs.length <= 1) {
      showToast('最後の1件は削除できません');
      return;
    }
    const target = state.docs.find((d) => d.id === id);
    if (!confirm(`「${target.title || '無題の原稿'}」を削除しますか？`)) return;
    state.docs = state.docs.filter((d) => d.id !== id);
    if (state.activeId === id) {
      state.activeId = state.docs[0].id;
    }
    renderAll();
    scheduleSave();
    showToast('原稿を削除しました');
  }

  // Editor Helpers
  function insertAtCursor(text, wrapEnd) {
    setViewMode('edit');
    const ta = el.docBody;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const val = ta.value;
    const selected = val.slice(start, end);
    const replacement = wrapEnd ? (text + (selected || 'テキスト') + wrapEnd) : (text + selected);
    ta.value = val.slice(0, start) + replacement + val.slice(end);
    const doc = getActiveDoc();
    doc.body = ta.value;
    doc.updatedAt = Date.now();
    ta.focus();
    const cursorPos = start + replacement.length;
    ta.setSelectionRange(cursorPos, cursorPos);
    updateAnalysisAndPreviews();
    renderDocList();
    scheduleSave();
  }

  function setViewMode(mode) {
    state.viewMode = mode;
    document.querySelectorAll('.mode-btn').forEach((b) => {
      const active = b.dataset.mode === mode;
      b.classList.toggle('active', active);
      b.setAttribute('aria-selected', String(active));
    });
    el.editView.classList.toggle('hidden', mode !== 'edit');
    el.previewView.classList.toggle('hidden', mode !== 'preview');
    el.verticalView.classList.toggle('hidden', mode !== 'vertical');
    if (mode !== 'edit') {
      updateAnalysisAndPreviews();
    }
  }

  function closeMobileDrawers() {
    el.sidebar.classList.remove('mobile-open');
    el.inspector.classList.remove('mobile-open');
    el.backdrop.classList.add('hidden');
  }

  function isMobile() {
    return window.innerWidth <= 1024;
  }

  // Theme & Font
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    el.iconSun.classList.toggle('hidden', theme !== 'dark');
    el.iconMoon.classList.toggle('hidden', theme === 'dark');
  }

  function applyFont(font) {
    const isSerif = font !== 'sans';
    document.documentElement.style.setProperty('--editor-font', isSerif ? 'var(--font-serif)' : 'var(--font-sans)');
    el.btnFontFamily.textContent = isSerif ? '明朝' : 'ゴシック';
    localStorage.setItem(FONT_KEY, isSerif ? 'serif' : 'sans');
  }

  // Export & Backup
  function downloadFile(filename, content, mime) {
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

  function buildContextHeader(doc) {
    const c = doc.context || {};
    const lines = [
      '---',
      `タイトル: ${doc.title || '無題の原稿'}`,
      `カテゴリ: ${doc.category || 'メモ'}`,
      `想定読者: ${c.audience || '未設定'}`,
      `目的: ${c.goal || '未設定'}`,
      `文体: ${toneLabel(c.tone)}`,
      `核メッセージ: ${c.core || '未設定'}`,
      '---',
      ''
    ];
    return lines.join('\n');
  }

  // Bind Events
  function bindEvents() {
    // Mode Switch
    document.querySelectorAll('.mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => setViewMode(btn.dataset.mode));
    });

    // Inspector Tabs
    document.querySelectorAll('.insp-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        const name = tab.dataset.tab;
        state.activeTab = name;
        document.querySelectorAll('.insp-tab').forEach((t) => {
          t.classList.toggle('active', t === tab);
          t.setAttribute('aria-selected', String(t === tab));
        });
        $('tabContext').classList.toggle('hidden', name !== 'context');
        $('tabProofread').classList.toggle('hidden', name !== 'proofread');
        $('tabSnapshots').classList.toggle('hidden', name !== 'snapshots');
      });
    });

    // Sidebar / Inspector Toggles
    $('btnToggleSidebar').addEventListener('click', () => {
      if (isMobile()) {
        const open = !el.sidebar.classList.contains('mobile-open');
        closeMobileDrawers();
        if (open) {
          el.sidebar.classList.add('mobile-open');
          el.backdrop.classList.remove('hidden');
        }
      } else {
        el.sidebar.classList.toggle('collapsed');
      }
    });

    $('btnToggleInspector').addEventListener('click', () => {
      if (isMobile()) {
        const open = !el.inspector.classList.contains('mobile-open');
        closeMobileDrawers();
        if (open) {
          el.inspector.classList.add('mobile-open');
          el.backdrop.classList.remove('hidden');
        }
      } else {
        el.inspector.classList.toggle('collapsed');
        $('btnToggleInspector').classList.toggle('active', !el.inspector.classList.contains('collapsed'));
      }
    });

    el.backdrop.addEventListener('click', closeMobileDrawers);

    // Focus Mode
    $('btnFocusMode').addEventListener('click', () => {
      el.app.classList.toggle('focus-mode');
      $('btnFocusMode').classList.toggle('active', el.app.classList.contains('focus-mode'));
      showToast(el.app.classList.contains('focus-mode') ? '集中モードに入りました' : '集中モードを解除しました');
    });

    // Theme & Font
    $('btnTheme').addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
    });

    el.btnFontFamily.addEventListener('click', () => {
      const next = localStorage.getItem(FONT_KEY) === 'sans' ? 'serif' : 'sans';
      applyFont(next);
    });

    // New Doc / Templates
    $('btnNewDoc').addEventListener('click', () => {
      createDocFromTemplate(TEMPLATES[0]);
      showToast('新しい原稿を作成しました');
    });

    $('btnTemplateModal').addEventListener('click', () => {
      el.templateGrid.innerHTML = '';
      TEMPLATES.forEach((tpl) => {
        const btn = document.createElement('button');
        btn.className = 'template-item';
        btn.innerHTML = `<h4>${escapeHtml(tpl.name)}</h4><p>${escapeHtml(tpl.desc)}</p>`;
        btn.addEventListener('click', () => {
          createDocFromTemplate(tpl);
          el.templateModal.classList.add('hidden');
          showToast(`「${tpl.name}」から作成しました`);
        });
        el.templateGrid.appendChild(btn);
      });
      el.templateModal.classList.remove('hidden');
    });

    // Search & Filter
    el.docSearch.addEventListener('input', renderDocList);
    el.docCategoryFilter.addEventListener('change', renderDocList);

    // Editor Inputs
    el.docTitle.addEventListener('input', () => {
      const doc = getActiveDoc();
      doc.title = el.docTitle.value;
      doc.updatedAt = Date.now();
      renderDocList();
      scheduleSave();
    });

    el.docBody.addEventListener('input', () => {
      const doc = getActiveDoc();
      doc.body = el.docBody.value;
      doc.updatedAt = Date.now();
      updateAnalysisAndPreviews();
      renderDocList();
      scheduleSave();
    });

    el.docCategory.addEventListener('change', () => {
      const doc = getActiveDoc();
      doc.category = el.docCategory.value;
      doc.updatedAt = Date.now();
      renderDocList();
      scheduleSave();
    });

    el.targetCharsInput.addEventListener('input', () => {
      const doc = getActiveDoc();
      doc.targetChars = Math.max(0, parseInt(el.targetCharsInput.value, 10) || 0);
      updateAnalysisAndPreviews();
      scheduleSave();
    });

    // Toolbar Inserts
    document.querySelectorAll('.tool-btn[data-insert]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.insert;
        if (type === 'heading') insertAtCursor('\n## ');
        else if (type === 'subheading') insertAtCursor('\n### ');
        else if (type === 'bold') insertAtCursor('**', '**');
        else if (type === 'quote') insertAtCursor('\n> ');
        else if (type === 'list') insertAtCursor('\n- ');
        else if (type === 'ruby') insertAtCursor('｜', '《るび》');
        else if (type === 'hr') insertAtCursor('\n---\n');
      });
    });

    $('btnCopyText').addEventListener('click', async () => {
      const doc = getActiveDoc();
      const text = (doc.title ? doc.title + '\n\n' : '') + (doc.body || '');
      try {
        await navigator.clipboard.writeText(text);
        showToast('本文をクリップボードにコピーしました');
      } catch {
        showToast('コピーに失敗しました');
      }
    });

    // Context Fields
    const onCtxChange = () => {
      const doc = getActiveDoc();
      doc.context = {
        audience: el.ctxAudience.value,
        goal: el.ctxGoal.value,
        tone: el.ctxTone.value,
        core: el.ctxCore.value
      };
      doc.updatedAt = Date.now();
      updateRibbon(doc.context);
      updateAnalysisAndPreviews();
      scheduleSave();
    };
    el.ctxAudience.addEventListener('input', onCtxChange);
    el.ctxGoal.addEventListener('input', onCtxChange);
    el.ctxTone.addEventListener('change', onCtxChange);
    el.ctxCore.addEventListener('input', onCtxChange);

    // Add Outline Block
    $('btnAddBlock').addEventListener('click', () => {
      const doc = getActiveDoc();
      doc.outline = doc.outline || [];
      doc.outline.push({ id: 'o_' + Date.now(), title: '新しい構成ブロック', note: '' });
      renderOutline(doc);
      scheduleSave();
    });

    // Add Custom Rule
    $('btnAddRule').addEventListener('click', () => {
      const doc = getActiveDoc();
      doc.customRules = doc.customRules || [];
      doc.customRules.push({ id: 'r_' + Date.now(), from: '', to: '' });
      renderCustomRules(doc);
      scheduleSave();
    });

    // Max Sentence Len
    el.maxSentenceLen.value = state.maxSentenceLen;
    el.maxSentenceLen.addEventListener('change', () => {
      state.maxSentenceLen = Math.max(30, parseInt(el.maxSentenceLen.value, 10) || 80);
      updateAnalysisAndPreviews();
      scheduleSave();
    });

    // Save Snapshot
    $('btnSaveSnapshot').addEventListener('click', () => {
      const doc = getActiveDoc();
      doc.snapshots = doc.snapshots || [];
      const label = el.snapshotLabel.value.trim() || `版 ${doc.snapshots.length + 1}`;
      doc.snapshots.unshift({
        id: 's_' + Date.now(),
        label,
        createdAt: Date.now(),
        title: doc.title || '',
        body: doc.body || ''
      });
      el.snapshotLabel.value = '';
      renderSnapshots(doc);
      scheduleSave();
      showToast(`「${label}」を保存しました`);
    });

    // Export Modal
    $('btnExportMenu').addEventListener('click', () => el.exportModal.classList.remove('hidden'));
    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => $(btn.dataset.closeModal).classList.add('hidden'));
    });
    [el.templateModal, el.exportModal].forEach((modal) => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
      });
    });

    $('btnExportMd').addEventListener('click', () => {
      const doc = getActiveDoc();
      const name = (doc.title || 'bunsho').replace(/[\\/:*?"<>|]/g, '_') + '.md';
      downloadFile(name, `# ${doc.title || '無題の原稿'}\n\n${doc.body || ''}`, 'text/markdown;charset=utf-8');
      showToast('Markdownファイルを書き出しました');
    });

    $('btnExportTxt').addEventListener('click', () => {
      const doc = getActiveDoc();
      const name = (doc.title || 'bunsho').replace(/[\\/:*?"<>|]/g, '_') + '.txt';
      downloadFile(name, `${doc.title || '無題の原稿'}\n\n${doc.body || ''}`, 'text/plain;charset=utf-8');
      showToast('テキストファイルを書き出しました');
    });

    $('btnExportWithContext').addEventListener('click', () => {
      const doc = getActiveDoc();
      const name = (doc.title || 'bunsho').replace(/[\\/:*?"<>|]/g, '_') + '_context.md';
      downloadFile(name, buildContextHeader(doc) + `# ${doc.title || '無題の原稿'}\n\n${doc.body || ''}`, 'text/markdown;charset=utf-8');
      showToast('文脈メモ付きMarkdownを書き出しました');
    });

    $('btnBackupJson').addEventListener('click', () => {
      const stamp = new Date().toISOString().slice(0, 10);
      downloadFile(`bunsho-studio-backup-${stamp}.json`, JSON.stringify(state, null, 2), 'application/json');
      showToast('全データをバックアップしました');
    });

    $('inputRestoreJson').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result));
          if (!Array.isArray(parsed.docs) || parsed.docs.length === 0) {
            throw new Error('Invalid format');
          }
          state.docs = parsed.docs;
          state.activeId = parsed.activeId || parsed.docs[0].id;
          renderAll();
          scheduleSave();
          el.exportModal.classList.add('hidden');
          showToast(`${state.docs.length}件の原稿を復元しました`);
        } catch {
          showToast('JSONファイルの形式が正しくありません');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        $('btnFocusMode').click();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        scheduleSave();
        showToast('保存しました');
      }
    });

    // Online / Offline Status
    const updateOnline = () => {
      const on = navigator.onLine;
      el.onlineStatus.textContent = on ? 'オンライン' : 'オフライン';
      el.onlineStatus.classList.toggle('is-offline', !on);
    };
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    updateOnline();

    // PWA Install Prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      el.btnInstallPwa.classList.remove('hidden');
    });

    el.btnInstallPwa.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      if (outcome === 'accepted') {
        el.btnInstallPwa.classList.add('hidden');
        showToast('文脈工房をインストールしました');
      }
      deferredInstallPrompt = null;
    });
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      navigator.serviceWorker.register('./sw.js').catch((err) => {
        console.warn('SW registration failed:', err);
      });
    }
  }

  // Init
  loadState();
  applyTheme(localStorage.getItem(THEME_KEY) || 'light');
  applyFont(localStorage.getItem(FONT_KEY) || 'serif');
  bindEvents();
  renderAll();
  registerServiceWorker();
})();
