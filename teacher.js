/* ============================================================
   学习实验室：状态重构 — 教师端演示版
   静态演示，全部为模拟示例数据，无真实后台
   ============================================================ */
(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };

  /* 确定性随机（保证每次刷新数据一致） */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  var rand = mulberry32(20241009);
  function ri(min, max) { return Math.round(min + rand() * (max - min)); }

  var PATH_NAMES = [
    '任务积压型连锁下滑', '价值感缺失型缓慢脱离', '挫败累积型自我放弃',
    '最低维持型平稳运行', '策略调整型逐步恢复', '人际支持型重新投入', '目标转向型主动重构'
  ];
  var PROBLEMS = ['任务拖延', '理解困难', '价值感缺失', '人际支持不足', '其他'];

  /* ----------------------------------------------------------
     生成 40 位学生的模拟数据（低投入 8 人 = 20%）
     ---------------------------------------------------------- */
  function makeStudents() {
    var list = [];
    // 类别配额：高投入 9 / 中等 20 / 低投入 8 / 需关注 3（需关注从低投入中标记）
    var plan = [];
    var i;
    for (i = 0; i < 9; i++) plan.push('high');
    for (i = 0; i < 20; i++) plan.push('mid');
    for (i = 0; i < 8; i++) plan.push('low');
    for (i = 0; i < 3; i++) plan.push('watch');
    // 打散
    plan.sort(function () { return rand() - 0.5; });

    plan.forEach(function (cat, idx) {
      var b, c, e;
      if (cat === 'high') { b = ri(76, 90); c = ri(74, 88); e = ri(72, 86); }
      else if (cat === 'mid') { b = ri(58, 72); c = ri(57, 71); e = ri(56, 72); }
      else if (cat === 'low') { b = ri(44, 56); c = ri(43, 55); e = ri(45, 57); }
      else { b = ri(30, 42); c = ri(32, 44); e = ri(28, 42); }

      // 主要问题：取最低维度
      var min = Math.min(b, c, e), problem;
      if (min === b) problem = '任务拖延';
      else if (min === c) problem = '理解困难';
      else problem = rand() > 0.5 ? '价值感缺失' : '人际支持不足';

      // 8 周轨迹：终点对齐当前得分，向前回溯
      var base = (b + c + e) / 3;
      var trendDir = cat === 'high' ? 1 : (cat === 'watch' ? -1 : (rand() > 0.5 ? 1 : -1));
      var traj = { behavior: [], cognition: [], emotion: [] };
      var keys = { behavior: b, cognition: c, emotion: e };
      ['behavior', 'cognition', 'emotion'].forEach(function (k) {
        var end = keys[k], arr = [];
        for (var w = 0; w < 8; w++) {
          var away = (7 - w) * (trendDir * (1.2 + rand() * 1.6));
          arr.push(Math.max(18, Math.min(96, Math.round(end - away + (rand() - 0.5) * 4))));
        }
        arr[7] = end;
        traj[k] = arr;
      });

      // 趋势箭头
      var d = traj.behavior[7] - traj.behavior[0];
      var trend = d > 4 ? '↑ 上升' : (d < -4 ? '↓ 下降' : '→ 平稳');

      // 路径分型（按当前状态与趋势粗略映射）
      var path;
      if (cat === 'high') path = trendDir > 0 ? PATH_NAMES[6] : PATH_NAMES[4];
      else if (cat === 'mid') path = trendDir > 0 ? PATH_NAMES[4] : PATH_NAMES[3];
      else if (cat === 'watch') path = problem === '理解困难' ? PATH_NAMES[2] : PATH_NAMES[0];
      else if (problem === '任务拖延') path = PATH_NAMES[0];
      else if (problem === '价值感缺失') path = PATH_NAMES[1];
      else if (problem === '人际支持不足') path = PATH_NAMES[5];
      else path = PATH_NAMES[3];

      var status = cat === 'watch' ? '需关注' : (cat === 'high' ? '高投入' : (cat === 'mid' ? '中等' : '低投入'));

      list.push({
        id: 'S' + String(idx + 1).padStart(2, '0'),
        status: status,
        cat: cat,
        behavior: b, cognition: c, emotion: e,
        problem: problem,
        trend: trend,
        traj: traj,
        path: path
      });
    });
    return list;
  }

  var STUDENTS = makeStudents();

  /* ----------------------------------------------------------
     概览数据（按需求文档给定示例值）
     ---------------------------------------------------------- */
  var OVERVIEW = {
    avg: 62,
    lowCount: 8,
    lowPercent: 20,
    watchCount: 3,
    wow: 2,
    dims: { behavior: 61, cognition: 60, emotion: 63 },
    problems: [
      { name: '任务拖延', value: 35, color: '#8fb0b8' },
      { name: '理解困难', value: 25, color: '#9fb89a' },
      { name: '价值感缺失', value: 20, color: '#d8b489' },
      { name: '人际支持不足', value: 15, color: '#a9a6c4' },
      { name: '其他', value: 5, color: '#cfd4cd' }
    ],
    trend: {
      behavior: [66, 65, 63, 61, 60, 59, 60, 61],
      cognition: [65, 63, 62, 60, 58, 58, 59, 60],
      emotion: [67, 66, 64, 63, 62, 61, 62, 63]
    }
  };

  /* ----------------------------------------------------------
     概览渲染
     ---------------------------------------------------------- */
  function renderOverview() {
    var k = OVERVIEW;
    $('#kpiGrid').innerHTML = '' +
      kpi('班级综合投入均分', k.avg, '分', '') +
      kpi('低投入状态学生', k.lowCount, '人（' + k.lowPercent + '%）', '') +
      kpi('需重点关注', k.watchCount, '人', '') +
      kpi('周环比变化', '↑' + k.wow, '分', 'up');

    drawBar();
    drawPie();
    drawLine();
  }

  function kpi(label, v, unit, cls) {
    return '<div class="kpi"><div class="k">' + label + '</div>' +
      '<div class="v' + (cls ? ' ' + cls : '') + '">' + v + '<small>' + unit + '</small></div></div>';
  }

  /* 柱状图：三维投入分布 */
  function drawBar() {
    var W = 460, H = 250, padL = 40, padR = 16, padT = 18, padB = 42;
    var iw = W - padL - padR, ih = H - padT - padB;
    var data = [
      { n: '行为投入', v: OVERVIEW.dims.behavior, c: '#6f92b8' },
      { n: '认知投入', v: OVERVIEW.dims.cognition, c: '#7fa87d' },
      { n: '情感投入', v: OVERVIEW.dims.emotion, c: '#d4a56d' }
    ];
    var max = 100;
    var y = function (v) { return padT + (max - v) / max * ih; };
    var bw = iw / data.length * 0.44;
    var s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">';
    [0, 25, 50, 75, 100].forEach(function (v) {
      s += '<line x1="' + padL + '" y1="' + y(v) + '" x2="' + (W - padR) + '" y2="' + y(v) + '" stroke="#eef1ec"/>';
      s += '<text x="' + (padL - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end" font-size="11" fill="#9aa39f">' + v + '</text>';
    });
    data.forEach(function (d, i) {
      var cx = padL + iw / data.length * (i + 0.5);
      var h = ih - (y(d.v) - padT);
      s += '<rect x="' + (cx - bw / 2) + '" y="' + y(d.v) + '" width="' + bw + '" height="' + h +
        '" rx="6" fill="' + d.c + '" opacity="0.9"><title>' + d.n + ' ' + d.v + '</title></rect>';
      s += '<text x="' + cx + '" y="' + (y(d.v) - 8) + '" text-anchor="middle" font-size="13" font-weight="700" fill="#4b5552">' + d.v + '</text>';
      s += '<text x="' + cx + '" y="' + (H - padB + 20) + '" text-anchor="middle" font-size="12" fill="#7d8783">' + d.n + '</text>';
    });
    s += '</svg>';
    $('#barHost').innerHTML = s;
  }

  /* 饼图：首要问题类型分布 */
  function drawPie() {
    var W = 460, H = 250, cx = 150, cy = 128, r = 82, ir = 46;
    var total = OVERVIEW.problems.reduce(function (a, b) { return a + b.value; }, 0);
    var ang = -Math.PI / 2;
    var s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">';
    OVERVIEW.problems.forEach(function (p) {
      var a2 = ang + p.value / total * Math.PI * 2;
      var large = (a2 - ang) > Math.PI ? 1 : 0;
      var x1 = cx + r * Math.cos(ang), y1 = cy + r * Math.sin(ang);
      var x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
      var x3 = cx + ir * Math.cos(a2), y3 = cy + ir * Math.sin(a2);
      var x4 = cx + ir * Math.cos(ang), y4 = cy + ir * Math.sin(ang);
      s += '<path d="M' + x1 + ',' + y1 + ' A' + r + ',' + r + ' 0 ' + large + ' 1 ' + x2 + ',' + y2 +
        ' L' + x3 + ',' + y3 + ' A' + ir + ',' + ir + ' 0 ' + large + ' 0 ' + x4 + ',' + y4 + ' Z" fill="' + p.color + '">' +
        '<title>' + p.name + ' ' + p.value + '%</title></path>';
      ang = a2;
    });
    s += '<text x="' + cx + '" y="' + (cy - 2) + '" text-anchor="middle" font-size="13" fill="#7d8783">首要问题</text>';
    s += '<text x="' + cx + '" y="' + (cy + 18) + '" text-anchor="middle" font-size="15" font-weight="700" fill="#4b5552">类型分布</text>';
    // 图例
    OVERVIEW.problems.forEach(function (p, i) {
      var ly = 54 + i * 30;
      s += '<rect x="278" y="' + (ly - 9) + '" width="11" height="11" rx="3" fill="' + p.color + '"/>';
      s += '<text x="298" y="' + ly + '" font-size="12.5" fill="#4b5552">' + p.name + '</text>';
      s += '<text x="438" y="' + ly + '" font-size="12.5" font-weight="700" text-anchor="end" fill="#7d8783">' + p.value + '%</text>';
    });
    s += '</svg>';
    $('#pieHost').innerHTML = s;
  }

  /* 折线图：近 8 周趋势 */
  function drawLine() {
    var W = 900, H = 300, padL = 42, padR = 18, padT = 16, padB = 40;
    var iw = W - padL - padR, ih = H - padT - padB;
    var x = function (i) { return padL + i / 7 * iw; };
    var y = function (v) { return padT + (100 - v) / 100 * ih; };
    var s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">';
    [0, 25, 50, 75, 100].forEach(function (v) {
      s += '<line x1="' + padL + '" y1="' + y(v) + '" x2="' + (W - padR) + '" y2="' + y(v) + '" stroke="#eef1ec"/>';
      s += '<text x="' + (padL - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end" font-size="11" fill="#9aa39f">' + v + '</text>';
    });
    for (var i = 0; i < 8; i++) {
      s += '<text x="' + x(i) + '" y="' + (H - padB + 18) + '" text-anchor="middle" font-size="11" fill="#9aa39f">第' + (i + 1) + '周</text>';
    }
    [['behavior', '#6f92b8'], ['cognition', '#7fa87d'], ['emotion', '#d4a56d']].forEach(function (pair) {
      var arr = OVERVIEW.trend[pair[0]];
      var pts = arr.map(function (v, i) { return x(i) + ',' + y(v); }).join(' ');
      s += '<polyline points="' + pts + '" fill="none" stroke="' + pair[1] + '" stroke-width="2.5" stroke-linejoin="round"/>';
      arr.forEach(function (v, i) {
        s += '<circle cx="' + x(i) + '" cy="' + y(v) + '" r="3.2" fill="#fff" stroke="' + pair[1] + '" stroke-width="2"/>';
      });
    });
    s += '</svg>';
    $('#lineHost').innerHTML = s;
  }

  /* ----------------------------------------------------------
     页面 2：学生列表
     ---------------------------------------------------------- */
  var FILTERS = ['全部', '高投入', '中等', '低投入', '需关注'];
  var activeFilter = '全部';

  function renderFilters() {
    $('#filters').innerHTML = FILTERS.map(function (f) {
      return '<button type="button" data-f="' + f + '" class="' + (f === activeFilter ? 'active' : '') + '">' + f + '</button>';
    }).join('');
    $('#filters').querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        activeFilter = b.getAttribute('data-f');
        renderFilters();
        renderStudents();
      });
    });
  }

  function statusChip(st) {
    var map = { '高投入': 'chip-accent', '中等': '', '低投入': '', '需关注': '' };
    var color = st === '高投入' ? '' :
      st === '需关注' ? 'style="color:#a0764c;background:#f8f1e7;border-color:#efe1cd"' :
      st === '低投入' ? 'style="color:#8a6f4a;background:#f6efe4;border-color:#ece0cd"' : '';
    return '<span class="chip" ' + color + '>' + st + '</span>';
  }

  function barMini(v, color) {
    return '<span class="bar-mini"><i style="width:' + v + '%;background:' + color + '"></i></span>';
  }

  function renderStudents() {
    var rows = STUDENTS.filter(function (s) {
      if (activeFilter === '全部') return true;
      return s.status === activeFilter;
    });
    $('#studentRows').innerHTML = rows.map(function (s) {
      var avg = Math.round((s.behavior + s.cognition + s.emotion) / 3);
      return '<tr data-id="' + s.id + '">' +
        '<td><b>' + s.id + '</b></td>' +
        '<td>' + statusChip(s.status) + '</td>' +
        '<td>' +
          barMini(s.behavior, '#6f92b8') + ' ' + s.behavior + '&nbsp;&nbsp;' +
          barMini(s.cognition, '#7fa87d') + ' ' + s.cognition + '&nbsp;&nbsp;' +
          barMini(s.emotion, '#d4a56d') + ' ' + s.emotion +
          ' <span style="color:var(--muted)">（均 ' + avg + '）</span>' +
        '</td>' +
        '<td>' + s.problem + '</td>' +
        '<td>' + s.trend + '</td>' +
        '</tr>';
    }).join('');
    $('#studentRows').querySelectorAll('tr').forEach(function (tr) {
      tr.addEventListener('click', function () { showStudent(tr.getAttribute('data-id')); });
    });
  }

  function showStudent(id) {
    var s = STUDENTS.find(function (x) { return x.id === id; });
    if (!s) return;
    var W = 620, H = 200, padL = 34, padR = 12, padT = 12, padB = 30;
    var iw = W - padL - padR, ih = H - padT - padB;
    var x = function (i) { return padL + i / 7 * iw; };
    var y = function (v) { return padT + (100 - v) / 100 * ih; };
    var svg = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">';
    [25, 50, 75].forEach(function (v) {
      svg += '<line x1="' + padL + '" y1="' + y(v) + '" x2="' + (W - padR) + '" y2="' + y(v) + '" stroke="#eef1ec"/>';
      svg += '<text x="' + (padL - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end" font-size="10" fill="#9aa39f">' + v + '</text>';
    });
    [['behavior', '#6f92b8'], ['cognition', '#7fa87d'], ['emotion', '#d4a56d']].forEach(function (pair) {
      var arr = s.traj[pair[0]];
      var pts = arr.map(function (v, i) { return x(i) + ',' + y(v); }).join(' ');
      svg += '<polyline points="' + pts + '" fill="none" stroke="' + pair[1] + '" stroke-width="2.2"/>';
    });
    for (var i = 0; i < 8; i++) {
      svg += '<text x="' + x(i) + '" y="' + (H - padB + 16) + '" text-anchor="middle" font-size="10" fill="#9aa39f">W' + (i + 1) + '</text>';
    }
    svg += '</svg>';

    $('#studentDetail').innerHTML = '' +
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
        '<h3 style="margin:0;font-size:17px">学生 ' + s.id + '</h3>' +
        statusChip(s.status) +
        '<span class="chip chip-accent">路径分型：' + s.path + '</span>' +
        '<span class="chip">主要问题：' + s.problem + '</span>' +
      '</div>' +
      '<p style="color:var(--ink-2);font-size:13.5px;margin:12px 0 6px">近 8 周个人投入轨迹（行为 / 认知 / 情感）</p>' +
      svg +
      '<p style="color:var(--muted);font-size:12.5px;margin:6px 0 0">' +
        '建议：结合该生路径分型，在“支持策略库”中选取对应策略，以一对一沟通方式介入，避免公开标签化。' +
      '</p>';
    $('#studentDetail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ----------------------------------------------------------
     页面 3：支持策略库
     ---------------------------------------------------------- */
  var STRATEGIES = [
    { problem: '任务拖延', items: [
        { t: '作业拆解分层，提供基础版和进阶版要求', s: '适用场景：作业量较大、启动困难的学生', o: '实施主体：任课教师', n: '降低启动门槛，允许先完成基础部分' },
        { t: '设置中期检查点，提前一周提醒进度', s: '适用场景：临近截止集中赶工', o: '实施主体：任课教师 / 助教', n: '避免期末集中积压' },
        { t: '建立固定的短时段学习安排', s: '适用场景：日常行动投入偏低', o: '实施主体：学生本人 + 辅导员', n: '用连续性代替一次性突击' }
      ],
      warn: '注意：不公开批评拖延，一对一沟通进度，避免标签化。' },
    { problem: '理解困难', items: [
        { t: '提供前置知识清单与补学路径', s: '适用场景：课程卡顿、跟不上进度', o: '实施主体：任课教师', n: '先补缺口再推进新课' },
        { t: '设置固定的答疑时段与提问模板', s: '适用场景：学生不敢提问、问题表述模糊', o: '实施主体：助教 / 教师', n: '降低求助的心理成本' },
        { t: '组建同伴学习小组，进行讲解式复习', s: '适用场景：独立学习效率低', o: '实施主体：辅导员 / 班委', n: '以讲带学，提升认知参与深度' }
      ],
      warn: '注意：避免用“这么简单都不会”类表述，聚焦知识点本身。' },
    { problem: '情感耗竭', items: [
        { t: '协助调整作息，优先保证睡眠', s: '适用场景：精力长期偏低、情绪低落', o: '实施主体：辅导员', n: '恢复先于加码' },
        { t: '降低阶段性任务量，保留最低学习量', s: '适用场景：情绪耗竭期', o: '实施主体：任课教师', n: '维持连续性而非追求量' },
        { t: '引导使用学校心理健康支持资源', s: '适用场景：情绪问题持续影响生活', o: '实施主体：辅导员 / 心理中心', n: '超出学业辅导范围时及时转介' }
      ],
      warn: '注意：不做心理诊断，不进行人格评价；必要时及时转介专业支持。' },
    { problem: '求助障碍', items: [
        { t: '把求助规则化：卡住 30 分钟即提问', s: '适用场景：习惯独自硬扛', o: '实施主体：学生本人 + 助教', n: '将求助变成常规动作' },
        { t: '提供低门槛的线上提问渠道', s: '适用场景：面对面求助有压力', o: '实施主体：任课教师', n: '降低开口阻力' },
        { t: '安排学长学姐经验分享', s: '适用场景：归属感与信息不足', o: '实施主体：辅导员 / 学院', n: '提供可参照的应对经验' }
      ],
      warn: '注意：不把求助行为与“能力不足”关联，强调其为成熟的学习策略。' }
  ];

  function renderStrategy() {
    $('#strategyGrid').innerHTML = STRATEGIES.map(function (g) {
      return '<div class="strategy">' +
        '<h4>🗂 ' + g.problem + '</h4>' +
        '<div class="slist">' + g.items.map(function (it, i) {
          return '<div class="sitem"><b>策略 ' + (i + 1) + '：' + it.t + '</b>' +
            '<div class="meta">' + it.s + ' · ' + it.o + '</div>' +
            '<div class="meta">注意事项：' + it.n + '</div></div>';
        }).join('') + '</div>' +
        '<div class="warn">' + g.warn + '</div>' +
        '</div>';
    }).join('');
  }

  /* ----------------------------------------------------------
     标签页
     ---------------------------------------------------------- */
  function bindTabs() {
    document.querySelectorAll('.tab').forEach(function (t) {
      t.addEventListener('click', function () {
        document.querySelectorAll('.tab').forEach(function (x) { x.classList.remove('active'); });
        document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
        t.classList.add('active');
        var panel = $('#panel-' + t.getAttribute('data-tab'));
        if (panel) panel.classList.add('active');
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    bindTabs();
    renderOverview();
    renderFilters();
    renderStudents();
    renderStrategy();
  });
})();