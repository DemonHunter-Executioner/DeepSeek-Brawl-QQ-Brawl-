/* ------------------------------------------------------------------ 面板外壳 */

    const TABS = [
      { id: "battle", icon: "⚔", label: "对战" },
      { id: "care", icon: "🌊", label: "养成" },
      { id: "team", icon: "🐋", label: "队伍" },
      { id: "about", icon: "❔", label: "说明" },
    ];

    function Panel({ data, busy, error, act, load, onClose }) {
      const [tab, setTab] = useState(() => {
        const saved = localStorage.getItem(LS.tab);
        return TABS.some((item) => item.id === saved) ? saved : "battle";
      });
      const [pos, setPos] = useState(null);
      const dragRef = useRef(null);
      const posRef = useRef(null);

      useEffect(() => {
        remember(LS.tab, tab);
      }, [tab]);

      useEffect(() => {
        const onKey = (event) => {
          if (event.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
      }, [onClose]);

      const onHeadDown = (event) => {
        if (event.target.closest("button") || event.target.closest("input")) return;
        const box = event.currentTarget.parentElement.getBoundingClientRect();
        dragRef.current = { dx: event.clientX - box.left, dy: event.clientY - box.top };
        if (event.currentTarget.setPointerCapture) event.currentTarget.setPointerCapture(event.pointerId);
      };
      const onHeadMove = (event) => {
        if (!dragRef.current) return;
        const next = {
          left: clamp(event.clientX - dragRef.current.dx, 8, window.innerWidth - 280),
          top: clamp(event.clientY - dragRef.current.dy, 8, window.innerHeight - 140),
        };
        posRef.current = next;
        setPos(next);
      };
      const onHeadUp = () => {
        dragRef.current = null;
      };

      const lead = data.lead || (data.team && data.team[0]) || {};
      const style = {
        width: "min(880px, 95vw)",
        height: "min(660px, 86vh)",
        ...(pos ? { left: pos.left, top: pos.top } : { left: "50%", top: "50%", transform: "translate(-50%,-50%)" }),
      };

      return h(
        "div",
        { className: "wb-panel", style },
        h(
          "div",
          { className: "wb-head", onPointerDown: onHeadDown, onPointerMove: onHeadMove, onPointerUp: onHeadUp, onPointerCancel: onHeadUp },
          h("div", { className: "wb-head-face" }, h(WhaleSprite, { element: lead.element || "neutral", size: 46, form: lead.form || 0 })),
          h(
            "div",
            { className: "wb-head-title" },
            h("b", null, "鲸鱼大作战"),
            h(
              "span",
              null,
              `${lead.name || "小鲸鱼"} · Lv.${lead.level || 1}`,
              lead.formName ? h("span", { style: { opacity: 0.7 } }, `· ${lead.formName}`) : null,
            ),
          ),
          h("div", { className: "wb-gold" }, h("span", null, "🪙"), h("b", null, data.gold ?? 0)),
          h(
            "button",
            {
              className: "wb-x",
              type: "button",
              title: data.desktop && data.desktop.running ? "桌面宠物运行中（点击关闭）" : "打开桌面宠物（置顶透明小窗）",
              style: data.desktop && data.desktop.running ? { background: "rgba(95,224,168,.18)", color: "#7be7b0" } : undefined,
              onClick: async () => {
                try {
                  await act("/desktop", { action: data.desktop && data.desktop.running ? "close" : "open" });
                  if (load) await load();
                } catch {}
              },
            },
            "🖥",
          ),
          h("button", { className: "wb-x", type: "button", onClick: onClose, title: "关闭（Esc）" }, "✕"),
        ),
        h(
          "div",
          { className: "wb-tabs" },
          TABS.map((item) =>
            h(
              "button",
              { key: item.id, type: "button", className: `wb-tab${tab === item.id ? " wb-on" : ""}`, onClick: () => setTab(item.id) },
              h("span", { style: { fontSize: 13 } }, item.icon),
              item.label,
            ),
          ),
        ),
        h(
          "div",
          { className: "wb-body" },
          tab === "battle" ? h(BattleTab, { data, act, busy }) : null,
          tab === "care" ? h(CareTab, { data, act, busy, error }) : null,
          tab === "team" ? h(TeamTab, { data, act, busy }) : null,
          tab === "about" ? h(AboutTab, { data, act, busy, load }) : null,
        ),
      );
    }
