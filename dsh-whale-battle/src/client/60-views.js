/* ------------------------------------------------------------------ 页签：对战 */

    function BattleTab({ data, act, busy }) {
      const stages = data.stages || [];
      const firstOpen = stages.find((stage) => stage.unlocked && !stage.cleared) || stages[0];
      const [selected, setSelected] = useState(firstOpen ? firstOpen.id : 1);
      const [battle, setBattle] = useState(null);
      const [error, setError] = useState("");
      const chosen = stages.find((stage) => stage.id === selected) || null;
      const cleared = (data.cleared || []).length;

      const fight = useCallback(async (stageId) => {
        setError("");
        try {
          const payload = await act("/battle", { stageId });
          setBattle(payload);
        } catch (err) {
          setError(String(err && err.message ? err.message : err));
        }
      }, [act]);

      if (battle) {
        return h(BattleView, {
          battle,
          busy,
          onExit: () => setBattle(null),
          onAgain: () => {
            const stageId = battle.stage && battle.stage.id;
            setBattle(null);
            if (stageId) fight(stageId);
          },
        });
      }

      return h(
        "div",
        null,
        h(
          "div",
          { className: "wb-progress" },
          h("span", null, "主线"),
          h(Bar, { value: cleared, max: 12, color: "linear-gradient(90deg,#4d8dff,#7fd3ff)", height: 6 }),
          h("span", null, `${cleared}/12`),
        ),
        error ? h("div", { className: "wb-muted", style: { color: TONE.error, marginBottom: 10 } }, error) : null,
        h(
          "div",
          { className: "wb-stages" },
          stages.map((stage) => h(StageCard, { key: stage.id, stage, selected, onSelect: setSelected })),
        ),
        chosen
          ? h(
              "div",
              { className: "wb-detail", style: { "--c": ELEMENT_COLOR[chosen.element] } },
              h(
                "div",
                { className: "wb-grow" },
                h(
                  "h4",
                  null,
                  `第 ${chosen.id} 关 · ${chosen.name}`,
                  h(Pill, { color: ELEMENT_COLOR[chosen.element], icon: ELEMENT_ICON[chosen.element] }, `${ELEMENT_NAME[chosen.element]}系`),
                  chosen.boss ? h(Pill, { color: "#ffd166", icon: "👑" }, `BOSS ${chosen.boss}`) : null,
                  chosen.cleared ? h(Pill, { color: "#5fe0a8" }, "已通关") : null,
                ),
                h("div", { className: "wb-muted" }, chosen.desc || ""),
                h(
                  "div",
                  { className: "wb-enemy-list" },
                  (chosen.preview || []).map((enemy, index) =>
                    h(Pill, { key: index, color: enemy.elementColor }, `${ELEMENT_ICON[enemy.element] || "🐋"} ${enemy.name} Lv.${enemy.level}`),
                  ),
                ),
                h(
                  "div",
                  { className: "wb-note" },
                  data.work && data.work.bonusPct > 0
                    ? `今日劳作加成：战斗经验 +${data.work.bonusPct}%（来自你真实的工作量）`
                    : "今天还没怎么干活，经验暂时没有加成。",
                ),
              ),
              h(
                "div",
                { className: "wb-detail-actions" },
                h(Btn, { primary: true, disabled: busy || !chosen.unlocked, onClick: () => fight(chosen.id) }, busy ? "结算中…" : "⚔ 开战"),
                h("span", { className: "wb-muted", style: { fontSize: 11 } }, `阵容 ${data.team.length} 只 · 体力 ${Math.round(data.care.stamina)}`),
              ),
            )
          : h("div", { className: "wb-empty" }, "选一关看看对手。"),
      );
    }

    /* ------------------------------------------------------------------ 页签：养成 */

    const ACTIONS = [
      { id: "feed", icon: "🐟", label: "喂食", note: "8 金币", need: (d) => d.gold >= 8 },
      { id: "bath", icon: "🫧", label: "洗澡", note: "6 金币", need: (d) => d.gold >= 6 },
      { id: "play", icon: "🎾", label: "陪玩", note: "耗 10 体力", need: (d) => d.care.stamina >= 10 },
      { id: "sleep", icon: "💤", label: "睡觉", note: "回 42 体力" },
      { id: "work", icon: "💼", label: "打工", note: "赚金币" },
      { id: "train", icon: "🎯", label: "训练", note: "耗 15 体力", need: (d) => d.care.stamina >= 15 },
    ];

    function CareTab({ data, act, busy, error }) {
      const now = useNow(true);
      const lead = data.lead || (data.team && data.team[0]);
      const care = data.care || {};
      const work = data.work || {};
      if (!lead) return h("div", { className: "wb-empty" }, "还没孵出来…");

      const cool = (at) => Math.max(0, (Number(at) || 0) - now);
      const workCool = cool(care.workReadyAt);
      const sleepCool = cool(care.sleepReadyAt);
      const expRatio = pct(lead.exp, lead.expToNext);

      const run = async (action) => {
        try {
          await act("/care", { action });
        } catch {}
      };

      const actionState = (action) => {
        if (busy) return { disabled: true, note: action.note };
        if (action.id === "work" && workCool > 0) return { disabled: true, note: `${mmss(workCool)} 后` };
        if (action.id === "sleep" && sleepCool > 0) return { disabled: true, note: `${mmss(sleepCool)} 后` };
        if (action.need && !action.need(data)) return { disabled: true, note: action.note };
        if (action.id === "work" && care.stamina < 20) return { disabled: true, note: "体力不足" };
        return { disabled: false, note: action.note };
      };

      return h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 12 } },
        error ? h("div", { className: "wb-muted", style: { color: TONE.error } }, error) : null,
        h(
          "div",
          { className: "wb-hero" },
          h("div", { className: "wb-hero-face" }, h(WhaleSprite, { element: lead.element, size: 168, form: lead.form })),
          h(
            "div",
            { className: "wb-grow" },
            h(
              "div",
              { className: "wb-hero-name" },
              h("b", null, lead.name),
              h("span", { className: "wb-hero-form" }, `Lv.${lead.level} · ${lead.formName}`),
            ),
            h(
              "div",
              { className: "wb-hero-tag" },
              h(Pill, { color: lead.elementColor, icon: ELEMENT_ICON[lead.element] }, `${lead.elementName}系`),
              h(Pill, null, lead.formTitle),
              h(Pill, { color: "#5fe0a8" }, `心情 ${Math.round(care.mood)}`),
            ),
            h(
              "div",
              { className: "wb-exp" },
              h("span", null, "EXP"),
              h(Bar, { value: lead.exp, max: lead.expToNext, color: "linear-gradient(90deg,#7b6bff,#4d8dff)", height: 7 }),
              h("span", null, `${lead.exp}/${lead.expToNext}`),
            ),
            h(
              "div",
              { className: "wb-stats4" },
              h(Stat, { label: "生命", value: lead.stats.hp }),
              h(Stat, { label: "攻击", value: lead.stats.atk }),
              h(Stat, { label: "防御", value: lead.stats.def }),
              h(Stat, { label: "速度", value: lead.stats.spd }),
            ),
          ),
        ),
        h(
          "div",
          { className: "wb-meters" },
          h(Meter, { icon: "🍚", label: "饱食", value: care.hunger }),
          h(Meter, { icon: "🫧", label: "清洁", value: care.clean }),
          h(Meter, { icon: "💗", label: "心情", value: care.mood }),
          h(Meter, { icon: "⚡", label: "体力", value: care.stamina }),
        ),
        h(
          "div",
          null,
          h(Section, null, "照顾它"),
          h(
            "div",
            { className: "wb-actions" },
            ACTIONS.map((action) => {
              const state = actionState(action);
              return h(
                "button",
                { key: action.id, type: "button", className: "wb-act", disabled: state.disabled, onClick: () => run(action.id) },
                h("span", { className: "wb-act-icon" }, action.icon),
                h("span", null, action.label),
                h("em", null, state.note),
              );
            }),
          ),
        ),
        h(
          "div",
          { className: "wb-card" },
          h(Section, null, `已学技能 · ${(lead.skillDetails || []).length}`),
          h(
            "div",
            { className: "wb-skills" },
            (lead.skillDetails || []).map((skill) =>
              h(
                "div",
                { key: skill.id, className: "wb-skill", style: { "--c": ELEMENT_COLOR[skill.el] } },
                h("span", { className: "wb-dot", style: { background: ELEMENT_COLOR[skill.el] || ELEMENT_COLOR.neutral } }),
                h("b", null, skill.name),
                h("span", { className: "wb-skill-cost" }, skill.cost > 0 ? `${skill.cost} 怒气` : "无消耗"),
                h("span", { className: "wb-skill-desc" }, skill.desc),
              ),
            ),
          ),
        ),
        h(
          "div",
          { className: "wb-card" },
          h(Section, null, "今日劳作 · 来自 DSH 会话日志"),
          h(
            "div",
            { className: "wb-work" },
            h("div", null, h("strong", null, work.steps || 0), h("span", null, "完成步数")),
            h("div", null, h("strong", null, work.toolCalls || 0), h("span", null, "工具调用")),
            h("div", null, h("strong", null, work.toolErrors || 0), h("span", null, "失败次数")),
            h("div", null, h("strong", { style: { color: work.bonusPct ? "#5fe0a8" : TONE.faint } }, `${work.bonusPct || 0}%`), h("span", null, "经验加成")),
          ),
          h("div", { className: "wb-note" }, `现在打一份工能赚 ${work.workGold || 0} 金币 —— 今天的调用越多，打工越值钱。`),
        ),
      );
    }

    /* ------------------------------------------------------------------ 页签：队伍 */

    function TeamTab({ data, act, busy }) {
      const [names, setNames] = useState({});
      const [error, setError] = useState("");
      const team = data.team || [];
      const cost = 120 + team.length * 80;

      const rename = async (index) => {
        const name = String(names[index] || "").trim();
        if (!name) return;
        setError("");
        try {
          await act("/rename", { index, name });
          setNames((prev) => ({ ...prev, [index]: "" }));
        } catch (err) {
          setError(String(err && err.message ? err.message : err));
        }
      };

      const recruit = async (element) => {
        setError("");
        try {
          await act("/recruit", { element });
        } catch (err) {
          setError(String(err && err.message ? err.message : err));
        }
      };

      return h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 12 } },
        error ? h("div", { className: "wb-muted", style: { color: TONE.error } }, error) : null,
        h(Section, null, `我的队伍 · ${team.length}/3`),
        h(
          "div",
          { className: "wb-roster" },
          team.map((pet, index) =>
            h(
              "div",
              { key: pet.id || index, className: "wb-member" },
              h("div", { className: "wb-bob", style: { animationDuration: `${3.2 + index * 0.35}s` } }, h(WhaleSprite, { element: pet.element, size: 66, form: pet.form })),
              h(
                "div",
                { className: "wb-grow" },
                h(
                  "div",
                  { className: "wb-member-name" },
                  h("b", null, pet.name),
                  index === 0 ? h(Pill, { color: "#ffd166", icon: "⭐" }, "队长") : null,
                  h(Pill, { color: pet.elementColor }, `${pet.elementName}系`),
                ),
                h("div", { className: "wb-member-stats" }, `Lv.${pet.level}`, pet.formName, `攻 ${pet.stats.atk}`, `防 ${pet.stats.def}`, `速 ${pet.stats.spd}`),
              ),
              h(
                "div",
                { className: "wb-member-actions" },
                h("input", {
                  className: "wb-input",
                  placeholder: "改个名字",
                  maxLength: 12,
                  value: names[index] || "",
                  onChange: (event) => setNames((prev) => ({ ...prev, [index]: event.target.value })),
                  onKeyDown: (event) => {
                    if (event.key === "Enter") rename(index);
                  },
                }),
                h(Btn, { disabled: busy || !(names[index] || "").trim(), onClick: () => rename(index) }, "改名"),
              ),
            ),
          ),
        ),
        team.length < 3
          ? h(
              "div",
              { className: "wb-card" },
              h(Section, null, `招募新伙伴 · ${cost} 金币`),
              h(
                "div",
                { className: "wb-recruit" },
                ["ice", "water", "fire"].map((element) =>
                  h(
                    Btn,
                    { key: element, disabled: busy || data.gold < cost, onClick: () => recruit(element) },
                    `${ELEMENT_ICON[element]} 招${element === "ice" ? "冰系" : element === "water" ? "水系" : "火系"}`,
                  ),
                ),
              ),
              h("div", { className: "wb-note" }, "多一条鲸就多一份输出，战斗里轮流出场；新伙伴比队长低一级。"),
            )
          : h("div", { className: "wb-muted" }, "队伍满了。"),
      );
    }

    /* ------------------------------------------------------------------ 页签：说明 */

    function AboutTab({ data, act, busy, load }) {
      const [confirming, setConfirming] = useState(false);
      const stats = data.stats || {};
      const desktopRunning = Boolean(data.desktop && data.desktop.running);

      const reset = async () => {
        if (!confirming) {
          setConfirming(true);
          setTimeout(() => setConfirming(false), 4000);
          return;
        }
        try {
          await act("/reset", {});
        } catch {}
        setConfirming(false);
      };

      const toggleDesktop = async () => {
        try {
          await act("/desktop", { action: desktopRunning ? "close" : "open" });
          if (load) await load();
        } catch {}
      };

      const rows = [
        ["⚔", "关卡是回合制自动战斗：按速度出手，怒气满了放绝招，属性克制（冰克水、水克火、火克冰）伤害 ×1.5。"],
        ["📈", "打赢拿金币和经验，升级学新技能、进化形态；输了不扣东西，但解锁不了下一关。"],
        ["🍚", "喂食洗澡陪玩会改善战斗系数：心情好攻击 +5%，饿了 -10%，脏了防御 -8%，体力见底速度 -10%。"],
        ["💼", "打工的金币、战斗的经验加成，来自你今天真实的 DSH 劳作量——不是挂机时长。"],
        ["⏳", "四项状态按真实时间衰减，离线也在饿；最多累计 12 小时。"],
      ];

      return h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 12 } },
        h(
          "div",
          { className: "wb-card" },
          h(Section, null, "桌面宠物（Windows）"),
          h("div", { className: "wb-muted" }, "让鲸鱼离开这个页面：一个置顶透明的独立小窗，浮在所有应用上面，可以拖到任意位置，右键直接喂食/打工/睡觉。"),
          h(
            "div",
            { style: { marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" } },
            h(Btn, { primary: !desktopRunning, onClick: toggleDesktop, disabled: busy }, desktopRunning ? "关闭桌面宠物" : "🖥 打开桌面宠物"),
            desktopRunning ? h(Pill, { color: "#5fe0a8" }, "运行中") : h(Pill, null, "未启动"),
          ),
          h("div", { className: "wb-note" }, "首次打开会用系统自带的 csc.exe 编译一次（约 1 秒），产物在 %LOCALAPPDATA%\\dsh-whale-battle\\。它只读本机接口，不联网。"),
        ),
        h(
          "div",
          { className: "wb-card" },
          h(Section, null, "怎么玩"),
          h("div", { style: { display: "grid", gap: 9 } }, rows.map(([icon, text], index) => h("div", { key: index, className: "wb-about-row" }, h("em", null, icon), h("span", null, text)))),
        ),
        h(
          "div",
          { className: "wb-card" },
          h(Section, null, "数据"),
          h("div", { className: "wb-muted" }, `累计战斗 ${stats.battles || 0} 场 · 胜 ${stats.wins || 0} · 负 ${stats.losses || 0}`),
          h("div", { className: "wb-path" }, data.savePath || "（未知路径）"),
          h("div", { className: "wb-note" }, "存档是本地 JSON；卸掉插件不会删档，删掉这个目录才会从头开始。"),
        ),
        h(
          "div",
          { className: "wb-card", style: { borderColor: "rgba(239,107,107,.28)" } },
          h(Section, null, "重置"),
          h("div", { className: "wb-muted", style: { marginBottom: 9 } }, "会删掉存档、重新从一条幼鲸开始。"),
          h(Btn, { danger: true, disabled: busy, onClick: reset }, confirming ? "再点一次确认重置" : "重置存档"),
        ),
      );
    }
