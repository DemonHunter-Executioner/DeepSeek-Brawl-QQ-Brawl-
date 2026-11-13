/* ------------------------------------------------------------------ 战斗 */

    /** 按帧推进战斗日志；速度 1/2/3 对应 420/230/110ms 一帧。 */
    function usePlayback(log) {
      const [frame, setFrame] = useState(0);
      const [speed, setSpeed] = useState(() => readNumber(LS.speed, 2, [1, 2, 3]));
      const last = Math.max(0, log.length - 1);
      const done = frame >= last;

      useEffect(() => {
        if (done) return undefined;
        const delay = speed === 3 ? 110 : speed === 2 ? 230 : 420;
        const timer = setTimeout(() => setFrame((f) => Math.min(last, f + 1)), delay);
        return () => clearTimeout(timer);
      }, [frame, done, speed, last]);

      useEffect(() => {
        remember(LS.speed, String(speed));
      }, [speed]);

      return { frame, last, speed, setSpeed, done, setFrame };
    }

    /** 某一帧的整队血量：从当前帧往回找最近一次带快照的日志。 */
    function hpAt(log, frame, battle) {
      for (let i = Math.min(frame, log.length - 1); i >= 0; i -= 1) {
        const snapshot = log[i] && log[i].hp;
        if (snapshot && snapshot.a && snapshot.b) return snapshot;
      }
      return {
        a: (battle.player || []).map((u) => ({ hp: u.hp, maxHp: u.maxHp, alive: u.alive, shield: u.shield, energy: u.energy })),
        b: (battle.enemies || []).map((u) => ({ hp: u.hp, maxHp: u.maxHp, alive: u.alive, shield: u.shield, energy: u.energy })),
      };
    }

    function UnitCard({ unit, hp, action, side, index, frame }) {
      if (!unit) return null;
      const state = hp || { hp: unit.hp, maxHp: unit.maxHp, alive: unit.alive, shield: 0, energy: 0 };
      const alive = state.alive !== false && state.hp > 0;
      const ratio = pct(state.hp, state.maxHp);
      const color = ELEMENT_COLOR[unit.element] || ELEMENT_COLOR.neutral;
      const active = action && action.actor && action.actor.side === side && action.actor.index === index;

      const isActor = active && (action.type === "hit");
      const isHit = action && action.target && action.target.side === side && action.target.index === index
        && (action.type === "hit" || action.type === "dot");
      const isBuff = action && action.target && action.target.side === side && action.target.index === index
        && (action.type === "heal" || action.type === "shield");

      const animClass = isActor
        ? (side === "a" ? "wb-anim-lunge-up" : "wb-anim-lunge-down")
        : isHit ? "wb-anim-hit" : "";

      // 动画要能连续触发：key 带上帧号，让这个精灵层重挂一次
      const animKey = animClass ? `${side}${index}-${frame}` : `${side}${index}-idle`;

      const cls = ["wb-unit"];
      if (!alive) cls.push("wb-dead");
      if (isBuff) cls.push("wb-glow");

      const burst = (isHit || isBuff) && action
        ? h("span", { key: `burst-${frame}`, className: "wb-burst", style: { "--c": action.color } })
        : null;

      let floater = null;
      if (action) {
        if (isHit && action.damage) {
          floater = h(
            "span",
            { key: `dmg-${frame}`, className: `wb-dmg${action.crit ? " wb-crit" : ""}` },
            `-${action.damage}`,
          );
        } else if (isBuff && action.heal) {
          floater = h("span", { key: `heal-${frame}`, className: "wb-dmg wb-plus" }, `+${action.heal}`);
        } else if (isBuff && action.shield) {
          floater = h("span", { key: `shield-${frame}`, className: "wb-dmg", style: { color: "#9fd0ff" } }, `🛡+${action.shield}`);
        }
      }

      return h(
        "div",
        { className: cls.join(" "), style: { "--el": `${color}33` } },
        h(
          "div",
          { className: `wb-unit-anim ${animClass}`, key: animKey },
          burst,
          floater,
          h(WhaleSprite, { element: unit.element, size: 62, form: Math.min(4, Math.floor((unit.level || 1) / 6)), ko: !alive }),
        ),
        h("div", { className: "wb-unit-name", title: unit.name }, `${ELEMENT_ICON[unit.element] || "🐋"} ${unit.name}`),
        h("div", { className: "wb-unit-lv" }, `Lv.${unit.level}${action && action.crit && isHit ? " · 暴击" : ""}`),
        h("div", { className: "wb-hp" }, h("i", { style: { width: `${ratio}%`, background: barColor(ratio / 100) } })),
        h("div", { className: "wb-en", title: "怒气" }, h("i", { style: { width: `${clamp(state.energy || 0, 0, 100)}%` } })),
        state.shield > 0 ? h("div", { className: "wb-shield" }, `🛡 ${state.shield}`) : null,
      );
    }

    function BattleView({ battle, onExit, onAgain, busy }) {
      const log = battle.log || [];
      const { frame, speed, setSpeed, done, setFrame, last } = usePlayback(log);
      const entry = log[Math.min(frame, last)] || {};
      const action = actionOf(entry);
      const hp = useMemo(() => hpAt(log, frame, battle), [log, frame, battle]);
      const recent = log.slice(Math.max(0, frame - 1), frame + 1).map(replyOf).filter(Boolean);
      const arenaTint = ELEMENT_COLOR[(battle.stage && battle.stage.element) || "neutral"] || ELEMENT_COLOR.neutral;

      const stageEl = battle.stage && battle.stage.element;
      const arenaStyle = { "--arena": stageEl ? `${ELEMENT_COLOR[stageEl]}33` : "rgba(29,58,102,.55)" };

      return h(
        "div",
        { className: "wb-battle" },
        h(
          "div",
          { className: "wb-battle-top" },
          h("span", { className: "wb-pill" }, `第 ${battle.stage ? battle.stage.id : "?"} 关`),
          h("b", { style: { fontSize: 13 } }, (battle.stage && battle.stage.name) || "对战"),
          battle.stage && battle.stage.boss ? h(Pill, { color: "#ffd166", icon: "👑" }, battle.stage.boss) : null,
          h("span", { className: "wb-round" }, `第 ${entry.r || 1} / ${battle.rounds} 回合`),
          h(
            "div",
            { className: "wb-timer" },
            h(Btn, { ghost: true, onClick: () => setSpeed(speed === 3 ? 1 : speed + 1), title: "播放速度" }, `${speed}×`),
            h(Btn, { ghost: true, onClick: () => setFrame(last), disabled: done }, "跳过"),
          ),
        ),
        h(
          "div",
          { className: "wb-arena", style: arenaStyle },
          h(
            "div",
            { className: "wb-team wb-enemy" },
            (battle.enemies || []).map((unit, index) =>
              h(UnitCard, { key: `e${index}`, unit, hp: hp.b && hp.b[index], action, side: "b", index, frame }),
            ),
          ),
          h(
            "div",
            { className: "wb-mid" },
            action && action.skill ? h("div", { key: `banner-${frame}`, className: "wb-banner", style: { "--c": action.color } }, action.skill) : null,
            ...recent.map((text, index) => h("div", { key: `log-${frame}-${index}`, className: "wb-logline", title: text }, text)),
          ),
          h(
            "div",
            { className: "wb-team wb-ally" },
            (battle.player || []).map((unit, index) =>
              h(UnitCard, { key: `p${index}`, unit, hp: hp.a && hp.a[index], action, side: "a", index, frame }),
            ),
          ),
          done
            ? h(
                "div",
                { className: "wb-result" },
                h("h3", null, battle.winner === "a" ? "胜利！" : battle.winner === "b" ? "败了…" : "平局"),
                battle.mvp ? h("div", { className: "wb-muted" }, `全场最佳 · ${battle.mvp}`) : null,
                battle.rewards
                  ? h(
                      "div",
                      { className: "wb-rewards" },
                      h("span", null, "🪙 ", h("b", null, `+${battle.rewards.gold}`)),
                      h("span", null, "✨ ", h("b", null, `+${battle.rewards.exp}`)),
                      battle.rewards.levels ? h("span", { style: { color: "#7fd3ff" } }, `⬆ 升 ${battle.rewards.levels} 级`) : null,
                    )
                  : h("div", { className: "wb-muted" }, "调整一下状态再来。"),
                battle.rewards && battle.rewards.firstClear ? h(Pill, { color: "#ffd166" }, "★ 首次通关 +40 金币") : null,
                h(
                  "div",
                  { style: { display: "flex", gap: 8, marginTop: 4 } },
                  h(Btn, { primary: true, disabled: busy, onClick: () => onAgain && onAgain() }, "再来一局"),
                  h(Btn, { onClick: () => onExit() }, "回去"),
                ),
              )
            : null,
        ),
        h(
          "div",
          { className: "wb-row", style: { justifyContent: "center", gap: 6 } },
          ["a", "b"].map((side) =>
            h(
              "span",
              { key: side, className: "wb-pill", style: { opacity: 0.7 } },
              side === "a" ? `我方 ${hp.a.filter((u) => u.alive !== false).length}` : `敌方 ${hp.b.filter((u) => u.alive !== false).length}`,
            ),
          ),
          h("span", { className: "wb-pill", style: { opacity: 0.55 } }, `元素克制 ×1.5`),
        ),
      );
    }

    /** 关卡卡：元素色晕染 + 锁定/通关状态 */
    function StageCard({ stage, selected, onSelect }) {
      const color = ELEMENT_COLOR[stage.element] || ELEMENT_COLOR.neutral;
      const cls = ["wb-stage"];
      if (stage.locked || !stage.unlocked) cls.push("wb-locked");
      if (selected) cls.push("wb-sel");
      return h(
        "button",
        {
          type: "button",
          className: cls.join(" "),
          style: { "--el": `${color}44` },
          onClick: () => stage.unlocked && onSelect(stage.id),
          title: stage.unlocked ? stage.desc : "还没解锁，先过上一关",
        },
        h(
          "div",
          { className: "wb-stage-top" },
          h("b", null, `${stage.boss ? "👑 " : ""}${stage.id}. ${stage.name}`),
          stage.cleared ? h("span", { className: "wb-pill", style: { marginLeft: "auto", color: "#5fe0a8" } }, "✓") : null,
          !stage.unlocked ? h("span", { className: "wb-pill", style: { marginLeft: "auto" } }, "🔒") : null,
        ),
        h("div", { className: "wb-stage-sub" }, h("span", null, `Lv.${stage.level}`), h("span", null, "·"), h("span", null, `${(stage.preview || []).length} 只`), h("span", null, "·"), h("span", { style: { color } }, `${ELEMENT_NAME[stage.element] || "萌"}系`)),
        h(
          "div",
          { className: "wb-stage-enemies" },
          (stage.preview || []).slice(0, 3).map((enemy, index) =>
            h("span", { key: index, className: "wb-pill" }, `${ELEMENT_ICON[enemy.element] || "🐋"} Lv.${enemy.level}`),
          ),
        ),
      );
    }
