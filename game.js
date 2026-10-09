/* ============================================================
   学习实验室：状态重构 — 学生端逻辑
   HTML5 + CSS3 + 原生 JavaScript，单页轻量，无后端依赖
   数值机制、事件逻辑、发展路径均按需求文档设定
   ============================================================ */
(function () {
  'use strict';

  /* ----------------------------------------------------------
     基础配置
     ---------------------------------------------------------- */
  var TOTAL_WEEKS = 14;
  var INIT = { behavior: 70, cognition: 70, emotion: 70, energy: 50 };
  var WEEKLY_ENERGY_RECOVER = 8; // 每周初恢复的精力

  var DIM = {
    behavior: { name: '行为投入', color: '#6f92b8' },
    cognition: { name: '认知投入', color: '#7fa87d' },
    emotion: { name: '情感投入', color: '#d4a56d' },
    energy: { name: '精力', color: '#8fa9c4' }
  };

  /* ----------------------------------------------------------
     行动库（6 个，分三类）
     energy：精力变化，负数表示消耗、正数表示恢复
     ---------------------------------------------------------- */
  var ACTIONS = [
    { id: 'deep', group: '学习类', name: '深耕课程', desc: '预习、认真听课、整理笔记', energy: -12,
      eff: { behavior: 5, cognition: 6, emotion: 1 } },
    { id: 'catchup', group: '学习类', name: '赶工补作业', desc: '把落下的任务集中补上', energy: -14,
      eff: { behavior: 7, cognition: -1, emotion: -3 } },

    { id: 'rest', group: '调整类', name: '休息调整', desc: '补觉、放空，把精力补回来', energy: 18,
      eff: { behavior: -2, cognition: 1, emotion: 4 } },
    { id: 'help', group: '调整类', name: '寻求帮助', desc: '找老师、助教或学长学姐问清楚', energy: -6,
      eff: { behavior: 2, cognition: 3, emotion: 3 }, flag: 'helpSeek' },

    { id: 'peer', group: '社交类', name: '同伴交流', desc: '和同学一起自习、讨论', energy: -4,
      eff: { behavior: 1, cognition: 1, emotion: 5 }, flag: 'peer' },
    { id: 'relax', group: '社交类', name: '放松娱乐', desc: '追剧、游戏、出门走走', energy: 10,
      eff: { behavior: -3, cognition: -3, emotion: 2 } }
  ];

  var GROUPS = ['学习类', '调整类', '社交类'];

  /* ----------------------------------------------------------
     事件库（40 类真实学生典型事件）
     when(s)   -> 是否可触发
     weight(s) -> 相对权重（与当前状态相关）
     choice.eff 数值影响；choice.flag 留下标记；choice.note 结果提示
     ---------------------------------------------------------- */
  function low(v, t) { return v < t ? 1 + (t - v) / 25 : 1; }

  var EVENTS = [
    /* — 课程与理解 — */
    { id: 'course_gap', title: '课程理解断点',
      scene: '这门课的内容越来越难，上课听着听着就走神了，作业也卡着做不动，看着堆起来的任务有点烦躁。',
      weight: function (s) { return low(s.cognition, 70); },
      choices: [
        { text: '硬扛着熬夜赶', eff: { behavior: 2, cognition: -3, emotion: -3, energy: -4 } },
        { text: '先放一放，晚点再说', eff: { behavior: -2, emotion: 1, energy: 1 }, flag: 'backlog', note: '后续「作业积压」事件概率提升' },
        { text: '找同学问一下思路', eff: { behavior: 1, cognition: 2, energy: -2 }, flag: 'peer', unlock: 'peer', note: '解锁「同伴互助」正向事件' }
      ] },
    { id: 'teacher_question', title: '课堂上的随机提问',
      scene: '老师扫视教室，目光停在了你这一排。这个问题你只在书上匆匆扫过一眼。',
      choices: [
        { text: '提前预习过，主动举手作答', eff: { cognition: 4, behavior: 2, emotion: 2, energy: -3 } },
        { text: '低头翻书，默默祈祷别点到自己', eff: { cognition: -1, emotion: -2 } },
        { text: '课后找老师说明自己没跟上', eff: { cognition: 2, emotion: 2, energy: -2 }, flag: 'helpSeek', note: '留下「主动求助」标记' }
      ] },
    { id: 'online_afk', title: '网课挂机',
      scene: '录播课挂在后台，人却在刷别的页面。进度条在走，脑子里什么也没留下。',
      choices: [
        { text: '关掉分屏，从头认真看一遍', eff: { cognition: 3, behavior: 2, energy: -3 } },
        { text: '就这样挂着，反正会算观看时长', eff: { behavior: 1, cognition: -2, emotion: -1 } },
        { text: '改成 1.5 倍速挑重点看', eff: { cognition: 1, behavior: 1, energy: -1 }, flag: 'strategy' }
      ] },
    { id: 'notebook_borrow', title: '借同学的笔记',
      scene: '你发现自己的笔记漏掉了大半节课的重点，同学的笔记却很完整。',
      choices: [
        { text: '借来对照，补齐自己的框架', eff: { cognition: 3, behavior: 1, energy: -2 }, flag: 'peer' },
        { text: '直接拍照存着，想着以后再看', eff: { cognition: -1, behavior: -1 } },
        { text: '约他一起对一遍重点', eff: { cognition: 3, emotion: 2, energy: -2 }, flag: 'peer' }
      ] },

    /* — 任务与拖延 — */
    { id: 'backlog', title: '作业积压',
      scene: '几份作业的截止日期挤在同一周，桌面上一片狼藉，你甚至不知道该从哪一份开始。',
      when: function (s) { return s.flags.backlog || s.behavior < 62; },
      weight: function (s) { return 1 + low(s.behavior, 65) + (s.flags.backlog ? 1.5 : 0); },
      choices: [
        { text: '拆成小块，先做最简单的一份', eff: { behavior: 3, cognition: 1, emotion: 1, energy: -3 }, flag: 'strategy', note: '「拆解启动」策略生效' },
        { text: '通宵突击，一次性做完', eff: { behavior: 4, cognition: -2, emotion: -4, energy: -8 } },
        { text: '干脆放弃这一份', eff: { behavior: -4, cognition: -2, emotion: -2, energy: 2 }, flag: 'drift' }
      ] },
    { id: 'deadline_eve', title: '截止前夜',
      scene: '明早就要交，你才写了个开头。宿舍楼里还有几盏灯亮着。',
      when: function (s) { return s.behavior < 66 || s.flags.backlog; },
      weight: function (s) { return 1 + (s.flags.backlog ? 1.2 : 0); },
      choices: [
        { text: '排好优先级，先交能保底的部分', eff: { behavior: 3, cognition: 1, emotion: 1, energy: -4 }, flag: 'strategy' },
        { text: '通宵全部赶完', eff: { behavior: 4, cognition: -1, emotion: -4, energy: -8 } },
        { text: '只交会做的，剩下空着', eff: { behavior: 1, emotion: -2 }, flag: 'backlog' }
      ] },
    { id: 'group_work', title: '小组作业里的搭便车',
      scene: '小组群里安静得可怕，任务进度还停在"分工"那一条。',
      choices: [
        { text: '主动牵头，把任务拆清楚并认领', eff: { behavior: 2, cognition: 2, emotion: 2, energy: -4 }, flag: 'strategy' },
        { text: '自己默默把活全干了', eff: { behavior: 3, cognition: 1, emotion: -3, energy: -6 } },
        { text: '在群里委婉地提出分工问题', eff: { behavior: 1, emotion: 2, energy: -2 }, flag: 'peer' }
      ] },
    { id: 'routine_broken', title: '作息彻底乱了',
      scene: '凌晨三点还醒着，白天靠咖啡硬撑。身体像一台过热的机器。',
      when: function (s) { return s.energy < 42; },
      weight: function (s) { return 1 + low(s.energy, 45); },
      choices: [
        { text: '从今晚开始，11 点前上床', eff: { energy: 9, emotion: 3 }, flag: 'strategy' },
        { text: '白天补觉，晚上接着熬', eff: { energy: 2, cognition: -3, behavior: -2 } },
        { text: '算了，先熬过这阵子', eff: { energy: -3, emotion: -3 }, flag: 'drift' }
      ] },

    /* — 情感与价值 — */
    { id: 'meaning_lost', title: '“学这些到底有什么用”',
      scene: '合上书本的瞬间，你突然想不出这门课和自己的未来有什么关系。',
      when: function (s) { return s.emotion < 68; },
      weight: function (s) { return low(s.emotion, 68); },
      choices: [
        { text: '找个能立刻用上的小项目动手做', eff: { cognition: 3, emotion: 4, energy: -4 }, flag: 'goalShift', note: '「目标重构」标记' },
        { text: '找朋友聊聊，把困惑说出来', eff: { emotion: 3, energy: -1 }, flag: 'peer' },
        { text: '先不想了，机械地把作业做完', eff: { behavior: 1, cognition: -2, emotion: -3 }, flag: 'drift' }
      ] },
    { id: 'burnout', title: '情绪耗竭的边缘',
      scene: '坐在书桌前，明明有一堆事要做，却一个动作都提不起来，心里堵得慌。',
      when: function (s) { return s.emotion < 52 && s.energy < 38; },
      weight: function (s) { return 1.6 + low(s.emotion, 50); },
      choices: [
        { text: '给自己放一整天假，什么都不做', eff: { emotion: 5, energy: 12, behavior: -3, cognition: -2 } },
        { text: '先把作息和睡眠调回来', eff: { emotion: 3, energy: 8, behavior: -1 }, flag: 'strategy' },
        { text: '硬撑着继续', eff: { behavior: 2, emotion: -4, energy: -4 }, flag: 'burnout' }
      ] },
    { id: 'grade_release', title: '成绩公布',
      scene: '教务系统刷新出来的那一刻，你盯着屏幕看了很久。',
      when: function (s) { return s.week >= 9; },
      choices: [
        { text: '逐科分析得失，找出问题所在', eff: { cognition: 3, behavior: 1, emotion: 1, energy: -3 }, flag: 'strategy' },
        { text: '只看总分，不细看', eff: { cognition: -1, emotion: -1 } },
        { text: '和同学反复比排名', eff: { emotion: -3, energy: -2 }, flag: 'frustration' }
      ] },
    { id: 'fail_exam', title: '一次不理想的考试',
      scene: '卷子发下来，分数比你预想的低了一截。你把它翻过来扣在桌上。',
      when: function (s) { return s.cognition < 64 || s.flags.frustration; },
      weight: function (s) { return 1 + low(s.cognition, 65) + (s.flags.frustration ? 0.8 : 0); },
      choices: [
        { text: '复盘错题，定位知识漏洞', eff: { cognition: 4, behavior: 2, emotion: 1, energy: -4 }, flag: 'strategy' },
        { text: '“就这样吧”，不想再管了', eff: { cognition: -3, emotion: -3, behavior: -2 }, flag: 'frustration' },
        { text: '找老师问清楚失分点', eff: { cognition: 3, behavior: 1, emotion: 2, energy: -3 }, flag: 'helpSeek' }
      ] },
    { id: 'teacher_praise', title: '被老师当众表扬',
      scene: '"这次的思路很好。"老师在课上提到了你的名字。',
      choices: [
        { text: '把这门课当成自己的强项继续投入', eff: { cognition: 3, emotion: 4, behavior: 2, energy: -2 }, flag: 'goalShift' },
        { text: '开心一下，然后照旧', eff: { emotion: 2 } },
        { text: '觉得只是运气，不敢当真', eff: { emotion: -1 } }
      ] },

    /* — 人际与求助 — */
    { id: 'help_hesitate', title: '求助前的犹豫',
      scene: '问题已经卡了两个小时。你知道问一下就能解决，却迟迟开不了口。',
      choices: [
        { text: '鼓起勇气去问', eff: { cognition: 3, emotion: 2, energy: -2 }, flag: 'helpSeek', unlock: 'peer' },
        { text: '再自己琢磨琢磨', eff: { cognition: 1, emotion: -1, energy: -3 } },
        { text: '跳过这个问题，先做别的', eff: { cognition: -3, emotion: -2 }, flag: 'drift' }
      ] },
    { id: 'peer_invite', title: '同学约你出去玩',
      scene: '群里在张罗周末的出行，有人 @ 了你。',
      choices: [
        { text: '一起去，好好放松一下', eff: { emotion: 4, energy: 6, behavior: -1, cognition: -1 } },
        { text: '婉拒，先把作业收尾', eff: { behavior: 3, cognition: 1, emotion: -1, energy: -3 } },
        { text: '约到晚上，先学 2 小时再出门', eff: { behavior: 2, emotion: 3, energy: 2 }, flag: 'strategy' }
      ] },
    { id: 'friend_low', title: '朋友情绪低落来找你',
      scene: '室友关掉灯坐在床边，说最近什么都提不起劲。',
      choices: [
        { text: '陪他聊一晚', eff: { emotion: 3, energy: -3, behavior: -1 }, flag: 'peer' },
        { text: '简单安慰后回座位学习', eff: { behavior: 2, emotion: -1 } },
        { text: '建议他去找学校的心理老师', eff: { emotion: 2 }, flag: 'helpSeek' }
      ] },
    { id: 'library_buddy', title: '自习搭子的邀约',
      scene: '"明天一起去图书馆吧，我七点叫你。"消息弹了出来。',
      choices: [
        { text: '答应，固定每天一起自习', eff: { behavior: 3, cognition: 3, emotion: 3, energy: -3 }, flag: 'peer' },
        { text: '婉拒，习惯一个人', eff: { behavior: -1 } },
        { text: '先说好试一周看看', eff: { behavior: 2, cognition: 1, emotion: 1 }, flag: 'strategy' }
      ] },
    { id: 'roommate_conflict', title: '宿舍里的小摩擦',
      scene: '因为作息和卫生的事，你和室友已经几天没怎么说话了。',
      choices: [
        { text: '找个时间把话说开', eff: { emotion: 3, energy: -2 }, flag: 'peer' },
        { text: '忍着不说，尽量少回宿舍', eff: { emotion: -3, energy: -1 } },
        { text: '约法三章，各退一步', eff: { emotion: 2, energy: -1 }, flag: 'strategy' }
      ] },
    { id: 'social_anxiety', title: '上台展示',
      scene: '下周轮到你做课堂展示，一想到要站在讲台上，手心就开始出汗。',
      choices: [
        { text: '提前写好稿子，反复练几遍', eff: { cognition: 2, behavior: 2, emotion: 3, energy: -4 } },
        { text: '硬着头皮上', eff: { behavior: 2, emotion: -2, energy: -3 } },
        { text: '找同学当听众陪练', eff: { emotion: 4, cognition: 2, energy: -3 }, flag: 'peer' }
      ] },

    /* — 考试与规划 — */
    { id: 'exam_week', title: '期中考试临近',
      scene: '考试周的日程表已经排满，图书馆的座位一位难求。',
      when: function (s) { return s.week >= 5 && s.week <= 12; },
      weight: function (s) { return s.week >= 7 && s.week <= 9 ? 2 : 1; },
      choices: [
        { text: '制定复习计划，每天固定时段', eff: { behavior: 3, cognition: 4, emotion: 2, energy: -6 }, flag: 'strategy' },
        { text: '考前突击一晚', eff: { behavior: 2, cognition: 1, emotion: -3, energy: -6 } },
        { text: '佛系应考，不作准备', eff: { behavior: -3, cognition: -2, emotion: -2, energy: 2 }, flag: 'drift' }
      ] },
    { id: 'plan_review', title: '学期过半的复盘',
      scene: '翻到日历的中间那页，你意识到学期已经过去一半了。',
      when: function (s) { return s.week >= 6 && s.week <= 9; },
      choices: [
        { text: '对照目标，调整后半程的安排', eff: { behavior: 2, cognition: 3, emotion: 2, energy: -3 }, flag: 'strategy' },
        { text: '顺其自然，不想额外规划', eff: { emotion: -1 } },
        { text: '重新想清楚自己这一学期要什么', eff: { cognition: 2, emotion: 4, energy: -3 }, flag: 'goalShift' }
      ] },
    { id: 'fail_risk', title: '挂科预警',
      scene: '课程群里发了学业预警名单的提示，你隐约觉得自己的名字可能在里面。',
      when: function (s) { return s.behavior < 54 || s.cognition < 54; },
      weight: function (s) { return 1.4 + low(Math.min(s.behavior, s.cognition), 55); },
      choices: [
        { text: '主动找老师沟通补救方案', eff: { behavior: 3, cognition: 3, emotion: 2, energy: -4 }, flag: 'helpSeek' },
        { text: '自己闷头恶补', eff: { behavior: 4, cognition: 2, emotion: -2, energy: -6 } },
        { text: '逃避，假装没看见', eff: { behavior: -4, cognition: -3, emotion: -3 }, flag: 'frustration' }
      ] },
    { id: 'course_choice', title: '选修课的选择',
      scene: '选课系统开放了，一门轻松的水课和一门有难度但很有意思的课摆在你面前。',
      when: function (s) { return s.week >= 2 && s.week <= 6; },
      choices: [
        { text: '认真比对课程要求后再选', eff: { cognition: 2, emotion: 2, energy: -2 }, flag: 'strategy' },
        { text: '挑一门最水的，省点力气', eff: { emotion: 1, cognition: -2 } },
        { text: '选感兴趣但更难的，认真学', eff: { cognition: 4, emotion: 4, energy: -4 }, flag: 'goalShift' }
      ] },
    { id: 'competition', title: '学科竞赛报名',
      scene: '群里转发了竞赛通知，报名截止就在这周。',
      when: function (s) { return s.week >= 4 && s.week <= 12; },
      choices: [
        { text: '组队报名，认真准备', eff: { cognition: 4, emotion: 4, behavior: 2, energy: -7 }, flag: 'goalShift' },
        { text: '先去当观众，感受一下', eff: { cognition: 2, emotion: 1, energy: -1 } },
        { text: '不感兴趣，跳过', eff: { emotion: -1 } }
      ] },
    { id: 'bigproject', title: '大创项目招募',
      scene: '老师在课上提到课题组正在招本科生参与研究，需要投入不少时间。',
      when: function (s) { return s.week >= 3 && s.week <= 10; },
      choices: [
        { text: '报名参与，从基础工作做起', eff: { cognition: 4, emotion: 3, behavior: 2, energy: -6 }, flag: 'goalShift' },
        { text: '先观望，等下次机会', eff: { emotion: -1 } },
        { text: '问清楚时间投入再决定', eff: { cognition: 1, emotion: 1, energy: -1 }, flag: 'strategy' }
      ] },
    { id: 'senior_talk', title: '学长学姐的经验分享',
      scene: '"我大一时也一度觉得自己不适合这个专业。"分享会上，一位学长这样说。',
      choices: [
        { text: '会后加个好友，多问问经验', eff: { cognition: 2, emotion: 3, energy: -2 }, flag: 'peer' },
        { text: '听听就好', eff: { emotion: 1 } },
        { text: '把这些经验记下来，回去调整自己的节奏', eff: { cognition: 2, emotion: 2, behavior: 1 }, flag: 'strategy' }
      ] },

    /* — 生活与作息 — */
    { id: 'morning_class', title: '早八起不来',
      scene: '闹钟响了三遍，被窝的吸引力大得惊人。',
      choices: [
        { text: '挣扎着爬起来去上课', eff: { behavior: 3, emotion: -1, energy: -4 } },
        { text: '睡过去，课后再补', eff: { behavior: -3, cognition: -1, energy: 3 } },
        { text: '给老师说明情况，之后补看回放', eff: { behavior: 1, cognition: 1, emotion: 1, energy: -1 } }
      ] },
    { id: 'phone_scroll', title: '睡前刷手机',
      scene: '本来只想看五分钟，抬头时已经过去一个多小时。',
      choices: [
        { text: '定个 30 分钟闹钟，到点就放下', eff: { emotion: 2, energy: 3 }, flag: 'strategy' },
        { text: '一刷就到凌晨', eff: { energy: -6, cognition: -3, emotion: -1, behavior: -2 } },
        { text: '把手机放在客厅充电', eff: { energy: 6, cognition: 2, emotion: 1 } }
      ] },
    { id: 'exercise', title: '要不要去操场跑两圈',
      scene: '傍晚的操场很热闹，跑道上有人在慢跑。',
      when: function (s) { return s.energy >= 42; },
      choices: [
        { text: '去跑两圈，出出汗', eff: { energy: 7, emotion: 3, cognition: 1, behavior: 1 } },
        { text: '算了，还是回宿舍躺着', eff: { energy: 4 } },
        { text: '改成晚上散步半小时', eff: { energy: 5, emotion: 2 } }
      ] },
    { id: 'sick', title: '感冒了',
      scene: '嗓子发紧，头有点沉。今天的课还去不去？',
      choices: [
        { text: '好好休息，跟老师请假', eff: { energy: 10, emotion: 2, behavior: -2 } },
        { text: '带病坚持去上课', eff: { behavior: 2, energy: -6, emotion: -1 } },
        { text: '不去课堂，线上补看重点', eff: { cognition: 2, behavior: 1, energy: 2 } }
      ] },
    { id: 'part_time', title: '兼职机会',
      scene: '一份校内的兼职找上门，时间上和上课有点冲突。',
      when: function (s) { return s.week >= 4; },
      choices: [
        { text: '接下，锻炼一下自己', eff: { behavior: 1, emotion: 2, energy: -5, cognition: -1 } },
        { text: '婉拒，先专注学业', eff: { cognition: 2, behavior: 1, energy: 1 } },
        { text: '只接周末的班', eff: { behavior: 1, emotion: 1, energy: -3 }, flag: 'strategy' }
      ] },
    { id: 'money_tight', title: '生活费有点紧',
      scene: '月底的账单提醒你，这个月的开销超了。',
      choices: [
        { text: '记一笔账，重新规划开销', eff: { emotion: 2, cognition: 1, energy: -1 }, flag: 'strategy' },
        { text: '向家里开口', eff: { emotion: -1, energy: 1 } },
        { text: '先不管，下个月再说', eff: { emotion: -2, energy: 1 } }
      ] },
    { id: 'club', title: '社团招新',
      scene: '百团大战的摊位一路排到路口，你被塞了好几张传单。',
      choices: [
        { text: '挑一个真正感兴趣的加入', eff: { emotion: 4, behavior: 1, energy: -3 }, flag: 'goalShift' },
        { text: '都报一遍，先占个位', eff: { behavior: -1, energy: -4 } },
        { text: '不参加，把时间留给学习', eff: { behavior: 2, cognition: 1, emotion: -2 } }
      ] },
    { id: 'family_call', title: '家人打来电话',
      scene: '"最近在学校怎么样？吃得好不好？"电话那头是熟悉的声音。',
      choices: [
        { text: '如实说说近况', eff: { emotion: 4, energy: 1 } },
        { text: '报喜不报忧', eff: { emotion: -1, energy: 1 } },
        { text: '聊完之后更想努力了', eff: { behavior: 2, emotion: 3, energy: -2 }, flag: 'goalShift' }
      ] },
    { id: 'volunteer', title: '志愿活动招募',
      scene: '周末有一场志愿服务活动在招募，正好是你感兴趣的方向。',
      choices: [
        { text: '报名，完整参加一次', eff: { emotion: 3, energy: -3, behavior: 1 } },
        { text: '婉拒，周末想休息', eff: { energy: 2 } },
        { text: '报名但只去半天', eff: { emotion: 2, energy: -1 }, flag: 'strategy' }
      ] },
    { id: 'roommate_noise', title: '宿舍有点吵',
      scene: '室友正在开黑，语音里的喊声和键盘声混成一片。',
      choices: [
        { text: '收拾东西去图书馆', eff: { behavior: 2, cognition: 3, emotion: 1, energy: -2 }, flag: 'strategy' },
        { text: '跟他们一起玩一会儿', eff: { emotion: 3, energy: 4, behavior: -2, cognition: -2 } },
        { text: '戴上耳机继续学', eff: { behavior: 2, cognition: 1, emotion: -2, energy: -3 } }
      ] },
    { id: 'physical_test', title: '体测临近',
      scene: '体测通知发下来了，长跑那项让你有点发怵。',
      choices: [
        { text: '提前几周开始每天跑一跑', eff: { energy: -2, emotion: 3, behavior: 2, cognition: 1 } },
        { text: '临考前突击练一次', eff: { energy: -4, emotion: -1 } },
        { text: '顺其自然，能过就行', eff: { emotion: 1, energy: 1 } }
      ] },
    { id: 'love', title: '感情上的分心',
      scene: '最近的心思总被另一件事牵着，坐下学习也静不下来。',
      choices: [
        { text: '和对方约好固定的联系时段', eff: { emotion: 3, cognition: 2, energy: -2 }, flag: 'strategy' },
        { text: '随它去，学习先放一放', eff: { emotion: 2, behavior: -3, cognition: -3 } },
        { text: '把注意力硬拉回学习', eff: { behavior: 2, cognition: 1, emotion: -2 } }
      ] }
  ];

  /* ----------------------------------------------------------
     7 种典型发展路径
     ---------------------------------------------------------- */
  var PATHS = [
    { id: 'p1', name: '任务积压型连锁下滑', percent: 18,
      feature: '行动最先塌陷，任务不断堆积，越拖越难启动，行为投入持续走低并牵动认知与情感。',
      advice: [
        { t: '把任务拆到「5 分钟能启动」的颗粒度', d: '面对积压任务时，先写下一个立刻能做完的最小动作（如"只做第一题"），用启动代替计划，降低行动门槛。' },
        { t: '设置中期检查点', d: '给每项作业设定一个比截止日期早一周的自我节点，避免所有任务集中到期末爆发。' },
        { t: '保留每天固定的"最低学习量"', d: '状态再差也完成 30 分钟的低强度学习，用连续性阻止投入进一步塌陷。' }
      ] },
    { id: 'p2', name: '价值感缺失型缓慢脱离', percent: 14,
      feature: '情感投入先下降，觉得所学与自己无关，随后逐步减少行为与认知投入。',
      advice: [
        { t: '为课程找一个真实的"用处场景"', d: '把一个知识点连接到你关心的具体问题（社团、项目、生活），让抽象内容落到可用之处。' },
        { t: '记录"有用瞬间"清单', d: '每周记下 1-2 次"这个知识帮到了我"的具体时刻，累积价值感证据。' },
        { t: '选修与兴趣相关的课程补充', d: '在必修之外保留一门真正感兴趣的课，作为投入动力的来源。' }
      ] },
    { id: 'p3', name: '挫败累积型自我放弃', percent: 12,
      feature: '一次次的挫败形成"怎么做都没用"的判断，三维投入同步下滑，行动趋于停滞。',
      advice: [
        { t: '把结果归因转向可控因素', d: '复盘时聚焦"策略、时间安排、资源"这些可调整项，而不是"我能力不行"的结论。' },
        { t: '设置一连串"一定能完成"的小目标', d: '连续完成几个低门槛任务，重建对自身行动的掌控感。' },
        { t: '尽早使用学校学业支持资源', d: '主动联系老师、助教或学业辅导中心，把困难交给有经验的人一起拆解。' }
      ] },
    { id: 'p4', name: '最低维持型平稳运行', percent: 21,
      feature: '三维投入长期稳定在中低区间，靠惯性维持，既没有明显下滑，也没有真正恢复。',
      advice: [
        { t: '给"稳定"加入一个提升变量', d: '每周只挑一个维度做小幅提升（如认知投入），用小幅度改动打破低水平均衡。' },
        { t: '建立可追踪的学习记录', d: '用简单的表格记录每周学习时长与完成情况，让"维持"变得可见，便于发现改进空间。' },
        { t: '寻找一个正向反馈来源', d: '通过同伴学习小组或展示机会获得真实反馈，为投入补充外部动力。' }
      ] },
    { id: 'p5', name: '策略调整型逐步恢复', percent: 15,
      feature: '在学习方法与时间安排上做出调整，投入在经历下滑后稳步回升。',
      advice: [
        { t: '把有效的策略固化为习惯', d: '将"任务拆解""固定时段复习"等做法写入每周日程，避免恢复状态后再次丢回原样。' },
        { t: '定期回看调整前后的对比', d: '用投入轨迹对照策略执行的时间点，强化"方法有效"的自我认知。' },
        { t: '为下一阶段设置新的挑战目标', d: '在恢复的基础上适度提高目标难度，防止重新滑回舒适区。' }
      ] },
    { id: 'p6', name: '人际支持型重新投入', percent: 11,
      feature: '通过同伴互助、主动求助获得支持，情感与认知投入同步回升，重新进入学习状态。',
      advice: [
        { t: '把临时的支持变成固定的互助关系', d: '与自习伙伴约定固定时间，让支持不依赖某次偶发的聊天。' },
        { t: '把求助制度化', d: '遇到卡点超过 30 分钟就主动提问，把"求助"变成常规动作而非心理负担。' },
        { t: '在支持关系中贡献自己的部分', d: '主动分享笔记或讲解问题，双向的互助更稳定持久。' }
      ] },
    { id: 'p7', name: '目标转向型主动重构', percent: 9,
      feature: '主动寻找与自身目标相关的内容，重新定义投入的意义，形成新的学习动力。',
      advice: [
        { t: '把新目标拆解为可执行的学期计划', d: '将兴趣方向转化为具体的课程、项目或竞赛节点，避免目标停留在想法层面。' },
        { t: '为长线目标保留固定的投入时间', d: '每周划出保护区段用于长线目标，防止被临时任务挤占。' },
        { t: '定期校准目标与现实的匹配度', d: '每月检视一次目标进展与精力分配的平衡，及时调整而不是硬扛。' }
      ] }
  ];

  /* ----------------------------------------------------------
     状态
     ---------------------------------------------------------- */
  var state = null;

  function freshState() {
    return {
      week: 1,
      behavior: INIT.behavior,
      cognition: INIT.cognition,
      emotion: INIT.emotion,
      energy: INIT.energy,
      flags: {},
      traj: [],          // { week, behavior, cognition, emotion, energy }
      log: [],           // { week, title, choice }
      recent: [],        // 最近触发的事件 id
      started: true
    };
  }

  /* ----------------------------------------------------------
     工具函数
     ---------------------------------------------------------- */
  var $ = function (sel) { return document.querySelector(sel); };
  var clamp = function (v) { return Math.max(0, Math.min(100, Math.round(v))); };

  function avgOf(t) { return (t.behavior + t.cognition + t.emotion) / 3; }

  function slope(arr) {
    var n = arr.length;
    if (n < 2) return 0;
    var sx = 0, sy = 0, sxy = 0, sxx = 0;
    for (var i = 0; i < n; i++) { sx += i; sy += arr[i]; sxy += i * arr[i]; sxx += i * i; }
    var d = n * sxx - sx * sx;
    if (d === 0) return 0;
    return (n * sxy - sx * sy) / d;
  }

  function effectText(eff) {
    var parts = [];
    ['behavior', 'cognition', 'emotion', 'energy'].forEach(function (k) {
      var v = eff[k];
      if (!v) return;
      var sign = v > 0 ? '+' : '';
      var cls = v > 0 ? '' : ' class="down"';
      parts.push('<b' + cls + '>' + DIM[k].name + ' ' + sign + v + '</b>');
    });
    return parts.join('，');
  }

  function showToast(msg, ms) {
    var el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove('show'); }, ms || 2200);
  }

  function openOverlay(html) {
    $('#dialog').innerHTML = html;
    $('#overlay').classList.add('show');
  }
  function closeOverlay() { $('#overlay').classList.remove('show'); }

  $('#overlay').addEventListener('click', function (e) {
    if (e.target === $('#overlay')) closeOverlay();
  });

  /* ----------------------------------------------------------
     视图切换
     ---------------------------------------------------------- */
  function showView(name) {
    ['home', 'game', 'ending'].forEach(function (v) {
      var el = $('#view-' + v);
      if (el) el.hidden = (v !== name);
    });
    var fab = $('#fab');
    if (fab) fab.hidden = (name === 'home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ----------------------------------------------------------
     新游戏 / 渲染周
     ---------------------------------------------------------- */
  function newGame() {
    state = freshState();
    showView('game');
    renderWeek();
    showToast('新学期开始了。第 1 周，你想把精力放在哪里？', 2600);
  }

  function renderWeek() {
    // 进度条
    var cells = '';
    for (var i = 1; i <= TOTAL_WEEKS; i++) {
      var cls = i < state.week ? 'cell done' : (i === state.week ? 'cell current' : 'cell');
      cells += '<div class="' + cls + '"></div>';
    }
    $('#weekCells').innerHTML = cells;
    $('#weekLabel').textContent = '第 ' + state.week + ' 周 / 共 ' + TOTAL_WEEKS + ' 周';
    $('#weekNum').textContent = state.week + '/' + TOTAL_WEEKS;

    // 数值
    setStat('Behavior', state.behavior);
    setStat('Cognition', state.cognition);
    setStat('Emotion', state.emotion);
    setStat('Energy', state.energy);

    // 行动
    var host = $('#actionGroups');
    host.innerHTML = '';
    GROUPS.forEach(function (g) {
      var items = ACTIONS.filter(function (a) { return a.group === g; });
      var col = document.createElement('div');
      col.innerHTML = '<div class="group-title">' + g + '</div>' +
        '<div class="action-list">' + items.map(function (a) {
          var cost = a.energy < 0 ? '精力 −' + (-a.energy) : '精力 +' + a.energy;
          var disabled = (a.energy < 0 && state.energy < -a.energy) ? ' disabled' : '';
          return '<button class="action" type="button" data-id="' + a.id + '"' + disabled + '>' +
            '<div class="t">' + a.name + '</div>' +
            '<div class="d">' + a.desc + '</div>' +
            '<span class="cost">' + cost + '</span>' +
            '</button>';
        }).join('') + '</div>';
      host.appendChild(col);
    });

    host.querySelectorAll('.action').forEach(function (btn) {
      btn.addEventListener('click', function () { doAction(btn.getAttribute('data-id')); });
    });
  }

  function setStat(key, value) {
    var box = $('#stat' + key);
    if (!box) return;
    box.querySelector('.val').textContent = value;
    box.querySelector('.bar > i').style.width = value + '%';
  }

  function flashDelta(key, delta) {
    if (!delta) return;
    var box = $('#stat' + key);
    if (!box) return;
    var el = document.createElement('span');
    el.className = 'delta ' + (delta > 0 ? 'pos' : 'neg');
    el.textContent = DIM[key.toLowerCase()].name + ' ' + (delta > 0 ? '+' : '') + delta;
    box.appendChild(el);
    setTimeout(function () { el.remove(); }, 1500);
  }

  /* ----------------------------------------------------------
     执行行动
     ---------------------------------------------------------- */
  function doAction(id) {
    var action = ACTIONS.find(function (a) { return a.id === id; });
    if (!action) return;
    if (action.energy < 0 && state.energy < -action.energy) {
      showToast('精力不足，先选择恢复精力的行动吧。');
      return;
    }

    applyEffects(action.eff, action.energy);
    if (action.flag) state.flags[action.flag] = true;
    state.log.push({ week: state.week, title: '行动：' + action.name, choice: action.name });

    renderWeek();
    setTimeout(function () { maybeEvent(); }, 620);
  }

  function applyEffects(eff, energyDelta) {
    var d = { behavior: 0, cognition: 0, emotion: 0, energy: 0 };
    ['behavior', 'cognition', 'emotion', 'energy'].forEach(function (k) {
      if (eff[k]) d[k] += eff[k];
    });
    if (typeof energyDelta === 'number' && energyDelta !== 0) d.energy += energyDelta;

    state.behavior = clamp(state.behavior + d.behavior);
    state.cognition = clamp(state.cognition + d.cognition);
    state.emotion = clamp(state.emotion + d.emotion);
    state.energy = clamp(state.energy + d.energy);

    flashDelta('Behavior', d.behavior);
    flashDelta('Cognition', d.cognition);
    flashDelta('Emotion', d.emotion);
    flashDelta('Energy', d.energy);
  }

  /* ----------------------------------------------------------
     事件触发
     ---------------------------------------------------------- */
  function maybeEvent() {
    var stressCount = [state.behavior, state.cognition, state.emotion, state.energy]
      .filter(function (v) { return v < 55; }).length;
    var chance = 0.6 + stressCount * 0.08;              // 状态越紧张，事件越容易出现
    if (Math.random() > Math.min(chance, 0.92)) return nextWeek();

    var pool = EVENTS.filter(function (e) {
      if (state.recent.indexOf(e.id) !== -1) return false;
      return !e.when || e.when(state);
    });
    if (!pool.length) return nextWeek();

    var weights = pool.map(function (e) {
      var w = typeof e.weight === 'function' ? e.weight(state) : (e.weight || 1);
      return Math.max(0.05, w);
    });
    var total = weights.reduce(function (a, b) { return a + b; }, 0);
    var r = Math.random() * total, idx = 0;
    for (var i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) { idx = i; break; } }

    showEvent(pool[idx]);
  }

  function showEvent(evt) {
    var html = '' +
      '<span class="tag evi">📑 循证</span>' +
      '<h3>' + evt.title + '</h3>' +
      '<div class="scene">' + evt.scene + '</div>' +
      '<div class="choices">' + evt.choices.map(function (c, i) {
        var note = c.note ? '<span style="color:var(--accent-2)"> · ' + c.note + '</span>' : '';
        return '<button class="choice" type="button" data-i="' + i + '">' +
          '<div class="ct">' + c.text + '</div>' +
          '<div class="ce">' + effectText(c.eff) + note + '</div>' +
          '</button>';
      }).join('') + '</div>' +
      '<div class="source">该事件来自受访学生真实经历</div>';
    openOverlay(html);

    $('#dialog').querySelectorAll('.choice').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var c = evt.choices[parseInt(btn.getAttribute('data-i'), 10)];
        chooseEvent(evt, c);
      });
    });
  }

  function chooseEvent(evt, choice) {
    closeOverlay();
    applyEffects(choice.eff, 0);
    if (choice.flag) state.flags[choice.flag] = true;
    if (choice.unlock) state.flags[choice.unlock] = true;
    state.log.push({ week: state.week, title: evt.title, choice: choice.text });
    state.recent.push(evt.id);
    if (state.recent.length > 3) state.recent.shift();

    if (choice.note) showToast(choice.note, 2400);

    setTimeout(function () {
      renderWeek();
      setTimeout(nextWeek, 700);
    }, 700);
  }

  /* ----------------------------------------------------------
     进入下一周
     ---------------------------------------------------------- */
  function nextWeek() {
    state.traj.push({
      week: state.week,
      behavior: state.behavior,
      cognition: state.cognition,
      emotion: state.emotion,
      energy: state.energy
    });

    if (state.week >= TOTAL_WEEKS) return endGame();

    state.week += 1;
    state.energy = clamp(state.energy + WEEKLY_ENERGY_RECOVER);
    renderWeek();
    showToast('第 ' + state.week + ' 周开始，精力已恢复。', 1600);
  }

  /* ----------------------------------------------------------
     结局判定
     ---------------------------------------------------------- */
  function classify() {
    var t = state.traj;
    var avg = avgOf(t[t.length - 1]);
    var sb = slope(t.map(function (x) { return x.behavior; }));
    var sc = slope(t.map(function (x) { return x.cognition; }));
    var se = slope(t.map(function (x) { return x.emotion; }));
    var sAvg = (sb + sc + se) / 3;
    var f = state.flags;
    var lowest = 'behavior';
    if (state.cognition < state[lowest]) lowest = 'cognition';
    if (state.emotion < state[lowest]) lowest = 'emotion';

    var sc1 = (f.backlog ? 26 : 0) + Math.max(0, 70 - avg) * 1.5 + Math.max(0, -sb) * 30;
    var sc2 = Math.max(0, 70 - state.emotion) * 1.7 + Math.max(0, -se) * 30 +
              (lowest === 'emotion' ? 8 : 0);
    var sc3 = (f.frustration ? 26 : 0) + (f.burnout ? 8 : 0) + (f.drift ? 8 : 0) +
              Math.max(0, 62 - avg) * 1.5 + Math.max(0, -sAvg) * 26;
    var sc4 = Math.max(0, 18 - Math.abs(avg - 58)) + Math.max(0, 12 - Math.abs(sAvg) * 90);
    var sc5 = (f.strategy ? 26 : 0) + Math.max(0, sAvg) * 42 + Math.max(0, avg - 60) * 0.5;
    var sc6 = (f.peer ? 28 : 0) + Math.max(0, se) * 30 + Math.max(0, state.emotion - 62) * 0.7;
    var sc7 = (f.goalShift ? 30 : 0) + Math.max(0, sc) * 24 + (f.strategy ? 8 : 0);

    var scores = [
      { p: PATHS[0], s: sc1 }, { p: PATHS[1], s: sc2 }, { p: PATHS[2], s: sc3 },
      { p: PATHS[3], s: sc4 }, { p: PATHS[4], s: sc5 }, { p: PATHS[5], s: sc6 },
      { p: PATHS[6], s: sc7 }
    ];
    scores.sort(function (a, b) { return b.s - a.s; });
    return { path: scores[0].p, scores: scores, lowest: lowest };
  }

  function turningPoint() {
    var t = state.traj;
    var best = { i: 0, drop: 0 };
    for (var i = 1; i < t.length; i++) {
      var d = avgOf(t[i - 1]) - avgOf(t[i]);
      if (d > best.drop) best = { i: i, drop: d };
    }
    return best;
  }

  function endGame() {
    var res = classify();
    renderEnding(res);
    showView('ending');
  }

  function renderEnding(res) {
    var t = state.traj;
    var last = t[t.length - 1];
    var avg = Math.round(avgOf(last));
    var path = res.path;

    $('#endPathName').textContent = path.name;
    $('#endScore').textContent = avg;
    $('#endPercent').textContent = '对应研究中约 ' + path.percent + '% 的受访低投入学生经历';

    drawChart(t);

    // 三段式复盘
    var tp = turningPoint();
    var evtAt = null;
    for (var i = state.log.length - 1; i >= 0; i--) {
      if (state.log[i].week <= t[tp.i].week && state.log[i].week >= t[tp.i].week - 1) { evtAt = state.log[i]; break; }
    }
    var afterChoice = state.log.filter(function (l) { return l.week >= t[tp.i].week; });
    var commonChoice = afterChoice.length ? afterChoice[afterChoice.length - 1] : null;

    var dimLabel = DIM[res.lowest].name;
    var causeTxt;
    if (tp.drop >= 4) {
      causeTxt = '结合你整学期的选择，关键转折点出现在第 ' + t[tp.i].week + ' 周' +
        (evtAt ? '的「' + evtAt.title + '」之后' : '') + '。' +
        '此后你多次选择了' + (commonChoice ? '「' + commonChoice.choice + '」' : '相近的应对方式') +
        '，使' + dimLabel + '率先持续走低，并牵动了其余维度，最终形成了当前的状态。' +
        '这不是“意志力不足”，而是【策略 / 时机 / 资源】层面的问题。';
    } else if (tp.drop > 0) {
      causeTxt = '整学期你的投入变化相对平缓，未出现剧烈转折。' +
        '各维度围绕中低区间小幅波动，' + dimLabel + '始终是相对薄弱的一环。' +
        '这更像是一种依靠惯性维持的状态，而不是短期意志问题——改善的关键在于为现有节奏加入一个明确的提升变量。';
    } else {
      causeTxt = '整学期你的投入总体呈回升趋势，没有出现明显的失控点。' +
        '你在应对事件时的选择，使' + dimLabel + '以外的维度保持了较好的稳定性。' +
        '这说明你已经找到了部分适配自己的节奏，下一步是把有效做法固定下来。';
    }

    var review = '' +
      '<div class="blk"><h4><span class="n">一</span>路径定位</h4>' +
        '<p>你走出的「' + path.name + '」路径，对应研究中约 ' + path.percent +
        '% 的受访低投入学生经历。<br>核心特征：' + path.feature + '</p></div>' +
      '<div class="blk"><h4><span class="n">二</span>成因解释</h4>' +
        '<p>' + causeTxt + '</p></div>' +
      '<div class="blk"><h4><span class="n">三</span>现实行动建议</h4>' +
        '<ol>' + path.advice.map(function (a) {
          return '<li><b>' + a.t + '：</b>' + a.d + '</li>';
        }).join('') + '</ol></div>';
    $('#review3').innerHTML = review;

    state.ending = { path: path, avg: avg, review: review };
  }

  /* ----------------------------------------------------------
     投入轨迹折线图（纯 SVG 手绘）
     ---------------------------------------------------------- */
  function drawChart(t) {
    var W = 900, H = 320, padL = 44, padR = 18, padT = 18, padB = 40;
    var iw = W - padL - padR, ih = H - padT - padB;
    var x = function (w) { return padL + (w - 1) / (TOTAL_WEEKS - 1) * iw; };
    var y = function (v) { return padT + (100 - v) / 100 * ih; };

    var s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="个人投入轨迹折线图">';

    // 网格与 Y 轴
    [0, 25, 50, 75, 100].forEach(function (v) {
      s += '<line x1="' + padL + '" y1="' + y(v) + '" x2="' + (W - padR) + '" y2="' + y(v) +
           '" stroke="#eef1ec" stroke-width="1"/>';
      s += '<text x="' + (padL - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end" font-size="11" fill="#9aa39f">' + v + '</text>';
    });

    // X 轴周标签
    for (var w = 1; w <= TOTAL_WEEKS; w++) {
      if (w === 1 || w % 2 === 0 || w === TOTAL_WEEKS) {
        s += '<text x="' + x(w) + '" y="' + (H - padB + 18) + '" text-anchor="middle" font-size="11" fill="#9aa39f">第' + w + '周</text>';
      }
    }

    // 事件节点（按周聚合，仅标注事件，不标注每周行动）
    var evtWeeks = {};
    state.log.forEach(function (l) {
      if (l.title.indexOf('行动：') === 0) return;
      evtWeeks[l.week] = l.title;
    });

    function line(key, color) {
      var pts = t.map(function (p) { return x(p.week) + ',' + y(p[key]); }).join(' ');
      var out = '<polyline points="' + pts + '" fill="none" stroke="' + color +
        '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
      // 事件圆点
      t.forEach(function (p) {
        if (evtWeeks[p.week]) {
          out += '<circle cx="' + x(p.week) + '" cy="' + y(p[key]) + '" r="8" fill="transparent">' +
            '<title>第' + p.week + '周 · ' + evtWeeks[p.week] + '</title></circle>' +
            '<circle cx="' + x(p.week) + '" cy="' + y(p[key]) + '" r="3.6" fill="#fff" stroke="' + color + '" stroke-width="2"/>';
        }
      });
      return out;
    }

    s += line('behavior', '#6f92b8');
    s += line('cognition', '#7fa87d');
    s += line('emotion', '#d4a56d');
    s += '</svg>';
    $('#chartHost').innerHTML = s;
  }

  /* ----------------------------------------------------------
     结局图鉴
     ---------------------------------------------------------- */
  function openAtlas() {
    var html = '<span class="tag">📖 结局图鉴</span><h3>7 种典型发展路径</h3>' +
      '<p style="color:var(--ink-2);font-size:13.5px">基于扎根理论质性研究归纳，对应不同投入变化轨迹。</p>' +
      '<div style="display:flex;flex-direction:column;gap:10px;margin-top:6px">' +
      PATHS.map(function (p, i) {
        return '<div style="background:var(--surface-2);border:1px solid var(--line-2);border-radius:10px;padding:12px 14px">' +
          '<div style="display:flex;align-items:center;gap:8px"><b style="font-size:14px">' + (i + 1) + '. ' + p.name + '</b>' +
          '<span class="chip chip-accent">约 ' + p.percent + '%</span></div>' +
          '<div style="font-size:13px;color:var(--ink-2);margin-top:6px">' + p.feature + '</div></div>';
      }).join('') + '</div>' +
      '<div class="source">百分比为研究样本中的典型分布示意，用于演示路径差异</div>';
    openOverlay(html);
  }

  /* ----------------------------------------------------------
     内嵌 AI 轻督导（规则式智能回复 + 预设策略库）
     ---------------------------------------------------------- */
  var AI_SYSTEM = '角色：大学生学业支持助手。' +
    '规则：1) 仅基于扎根理论研究中的学习支持策略进行回应；2) 只聚焦具体学习问题，不做心理诊断与人格评价、不说空泛的鼓励话；' +
    '3) 每次只给 1-2 个可操作的小建议；4) 信息不足时只问一个澄清问题；5) 涉及心理危机、严重学业问题时，引导联系学校学业支持或心理咨询中心；' +
    '6) 全程使用温和、非评判的语气。';

  var KB = [
    { k: ['自杀', '不想活', '活不下去', '伤害自己', '没意思了'],
      a: '听到你这么说，我很在意你现在的状态。这类情况超出了我能提供支持的范围，请一定联系学校的心理咨询中心或身边可信赖的人，他们能给你更直接的帮助。\n如果你愿意，也可以先告诉我：此刻你最希望有人陪你解决的是哪一件事？' },
    { k: ['不想开始', '不想学', '提不起劲', '拖延', '懒', '启动', '开不了头'],
      a: '这种“启动困难”很常见，通常不是意志问题，而是任务在脑子里太大、太模糊。\n可以试一个策略：把任务缩小到“5 分钟就能做完的第一步”（比如“只打开课件看第 1 页”），先做起来，再决定要不要继续。\n你现在最想开始的是哪一项任务？' },
    { k: ['学不进去', '走神', '注意力', '静不下来', '效率低', '坐不住'],
      a: '注意力涣散往往和环境与任务切换有关，先不急着责怪自己。\n建议试两点：一是换到干扰更少的环境（如图书馆固定座位），二是用“25 分钟专注 + 5 分钟休息”的短周期，把专注变得可完成。\n你现在的学习环境里，最大的干扰是什么？' },
    { k: ['作业', '赶不完', '截止', 'deadline', '来不及', '积压'],
      a: '任务积压时，先排序比先动手更重要。\n建议：把待办按“截止时间 + 完成难度”排一遍，先集中做“能最快交付”的那一份，用完成一件来带动后面的进度；同时给每项任务设定比截止日早一周的自查节点。\n你现在手头最急的是哪一份作业？' },
    { k: ['听不懂', '跟不上', '难', '卡住', '不会', '理解不了'],
      a: '课程卡顿通常发生在缺少前置知识或缺少反馈的时候，及时求助是有效策略。\n建议：先把卡住的具体问题写下来（越具体越好），带着它去问老师、助教或同学；如果暂时问不到，就先跳过卡点、把能理解的部分推进。\n你卡住的是哪个具体知识点？' },
    { k: ['焦虑', '压力', '崩溃', '紧张', '难受', '睡不着', '失眠'],
      a: '压力状态下，优先恢复的是作息和精力，而不是加码学习。\n建议先做两件小事：固定一个上床时间、每天留出 20 分钟的散步或轻度运动；把“必须做完”的任务改成“今天做 30 分钟”。\n如果这种状态持续影响生活，建议联系学校心理健康中心获得进一步支持。\n最近最让你紧绷的是哪件事？' },
    { k: ['考试', '复习', '期末', '期中', '考不好'],
      a: '复习的关键是“固定时段 + 主动回忆”，而不是延长总时长。\n建议：为每门课设定每天固定的复习时段，用合上书本复述、做旧题的方式检验掌握程度，比反复翻书更有效。\n你打算先安排哪一门课的复习？' },
    { k: ['意义', '有什么用', '迷茫', '没动力', '价值', '为了什么'],
      a: '价值感模糊时，抽象地说服自己通常没用，需要具体的连接。\n建议：找一个能马上用到这门课知识的小场景（课程作业、社团、感兴趣的项目），做一次就能积累一点“有用”的证据；也可以记录每周 1-2 个“这个知识帮到了我”的瞬间。\n你最近对哪门课最提不起兴趣？' },
    { k: ['朋友', '人际', '孤独', '室友', '社交', '一个人'],
      a: '人际支持是投入恢复的重要资源，可以主动创造一点连接。\n建议：从一个低门槛的动作开始，比如约同学固定一起去图书馆、或找一个人聊聊近况，不必一次就变成深交。\n你身边有没有相对愿意交流的同学？' },
    { k: ['求助', '不敢问', '不好意思', '怕被笑', '问老师', '开口'],
      a: '求助顾虑通常来自“怕显得自己不行”，但求助本身是成熟的学习策略。\n建议：把求助变成规则化的动作——卡住超过 30 分钟就发一条消息给老师或同学，只问一个具体问题，降低开口的心理成本。\n你现在最想问、又不敢问的是哪件事？' },
    { k: ['放弃', '没用', '不适合', '学不好', '算了'],
      a: '感到挫败时，把注意力从“我不行”转到“哪一步可以调整”，会更有帮助。\n建议：先选一个“一定能完成”的小任务重建掌控感，再回头复盘时聚焦策略、时间安排和资源这些可控因素。\n最近让你产生这种想法的是哪一件事？' }
  ];

  function aiReply(text) {
    var q = (text || '').trim();
    if (!q) return '可以具体说说你遇到的学习问题吗？比如是哪门课、哪个环节卡住了。';
    for (var i = 0; i < KB.length; i++) {
      for (var j = 0; j < KB[i].k.length; j++) {
        if (q.indexOf(KB[i].k[j]) !== -1) return KB[i].a;
      }
    }
    return '我了解到你的困扰了。为了给出更贴合的建议，可以再具体一点吗——是卡在“开始不了”“学不进去”，还是“任务赶不完”？\n（我只会基于学习投入研究中的循证策略回应，不做心理诊断。）';
  }

  var chatStarted = false;
  function openChat() {
    $('#chat').classList.add('show');
    if (!chatStarted) {
      chatStarted = true;
      addMsg('bot', '你好，我是学习督导。\n我只会基于学习投入研究中的循证策略来回应，一次给 1-2 个可操作的小建议。\n你现在遇到的是哪方面的学习问题？');
    }
    setTimeout(function () { var el = $('#chatInput'); if (el) el.focus(); }, 200);
  }
  function closeChat() { $('#chat').classList.remove('show'); }

  function addMsg(who, text) {
    var el = document.createElement('div');
    el.className = 'msg ' + who;
    el.textContent = text;
    $('#chatLog').appendChild(el);
    $('#chatLog').scrollTop = $('#chatLog').scrollHeight;
  }

  function sendChat(text) {
    if (!text || !text.trim()) return;
    addMsg('user', text.trim());
    $('#chatInput').value = '';
    setTimeout(function () {
      addMsg('bot', aiReply(text));
    }, 380);
  }

  var QUICK = ['我不想开始学习', '我学不进去了', '我作业赶不完了'];

  /* ----------------------------------------------------------
     分享
     ---------------------------------------------------------- */
  function share() {
    var e = state && state.ending;
    if (!e) return;
    var text = '我在《学习实验室：状态重构》里走出的路径是「' + e.path.name +
      '」，综合投入指数 ' + e.avg + ' 分。' + e.path.feature;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        showToast('状态文案已复制，可以分享给同学了', 2400);
      }).catch(function () { showToast(text, 4000); });
    } else {
      showToast(text, 4000);
    }
  }

  /* ----------------------------------------------------------
     事件绑定
     ---------------------------------------------------------- */
  function bind() {
    $('#btnStart').addEventListener('click', newGame);
    $('#btnAtlas').addEventListener('click', openAtlas);
    $('#navHome').addEventListener('click', function () { showView('home'); });
    $('#navAtlas').addEventListener('click', openAtlas);
    $('#btnRestart').addEventListener('click', newGame);
    $('#btnAiEnding').addEventListener('click', openChat);
    $('#btnShare').addEventListener('click', share);

    $('#fab').addEventListener('click', openChat);
    $('#chatClose').addEventListener('click', closeChat);
    $('#chatForm').addEventListener('submit', function (e) {
      e.preventDefault();
      sendChat($('#chatInput').value);
    });

    var q = $('#chatQuick');
    QUICK.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = t;
      b.addEventListener('click', function () { openChat(); sendChat(t); });
      q.appendChild(b);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeOverlay(); closeChat(); }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    bind();
    showView('home');
    // 调试入口：?view=game 可直接进入游戏
    var m = /[?&]view=([a-z]+)/.exec(location.search);
    if (m && m[1] === 'game') newGame();
  });
})();