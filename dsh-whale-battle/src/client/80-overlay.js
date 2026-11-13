/* ------------------------------------------------------------------ 悬浮层 */

    function Overlay() {
      ensureStyle();
      const { data, error, busy, act, load } = useGame();
      const [open, setOpen] = useState(false);
      const [tick, setTick] = useState(0);
      const [pos, setPos] = useState(() => {
        const saved = readJson(LS.pos, { right: 28, bottom: 88 });
        return {
          right: clamp(saved.right, 4, Math.max(4, window.innerWidth - 130)),
          bottom: clamp(saved.bottom, 4, Math.max(4, window.innerHeight - 165)),
        };
      });
      const posRef = useRef(pos);
      const dragRef = useRef(null);

      useEffect(() => {
        posRef.current = pos;
      }, [pos]);

      useEffect(() => {
        const timer = setInterval(() => setTick((value) => value + 1), 12_000);
        return () => clearInterval(timer);
      }, []);

      useEffect(() => {
        const onResize = () => {
          const next = {
            right: clamp(posRef.current.right, 4, Math.max(4, window.innerWidth - 130)),
            bottom: clamp(posRef.current.bottom, 4, Math.max(4, window.innerHeight - 165)),
          };
          posRef.current = next;
          setPos(next);
        };
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
      }, []);

      const onPointerDown = (event) => {
        if (event.button !== 0) return;
        dragRef.current = { x: event.clientX, y: event.clientY, start: { ...posRef.current }, moved: false };
        if (event.currentTarget.setPointerCapture) event.currentTarget.setPointerCapture(event.pointerId);
      };
      const onPointerMove = (event) => {
        const drag = dragRef.current;
        if (!drag) return;
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true;
        const next = {
          right: clamp(drag.start.right - dx, 4, Math.max(4, window.innerWidth - 130)),
          bottom: clamp(drag.start.bottom - dy, 4, Math.max(4, window.innerHeight - 165)),
        };
        posRef.current = next;
        setPos(next);
      };
      const onPointerUp = () => {
        const drag = dragRef.current;
        dragRef.current = null;
        if (!drag) return;
        remember(LS.pos, posRef.current);
        if (!drag.moved) setOpen(true);
      };

      const lead = (data && data.lead) || {};
      const bubble = pickBubble(data, tick);
      const lowStamina = data && data.care && data.care.stamina < 20;

      return h(
        "div",
        { className: "wb-root" },
        h(
          "div",
          {
            className: "wb-pet",
            style: { right: pos.right, bottom: pos.bottom },
            onPointerDown,
            onPointerMove,
            onPointerUp,
            onPointerCancel: onPointerUp,
            title: "点一下打开面板；拖动可以换位置",
          },
          h("div", { className: "wb-bubble", onClick: () => setOpen(true) }, bubble),
          h(
            "div",
            { className: "wb-pet-avatar" },
            h(WhaleSprite, {
              element: lead.element || "neutral",
              size: 126,
              form: lead.form || 0,
            }),
            lowStamina ? h("span", { className: "wb-pill", style: { position: "absolute", right: 0, top: 0, background: "rgba(242,181,68,.18)", color: "#ffd479" } }, "💤") : null,
          ),
          h(
            "div",
            { className: "wb-nameplate" },
            h("i", null, ELEMENT_ICON[lead.element] || "🐋"),
            h("span", null, lead.name || "小鲸鱼"),
            h("span", { style: { opacity: 0.7 } }, `Lv.${lead.level || 1}`),
          ),
        ),
        open && data
          ? h(Panel, { data, busy, error, act, load, onClose: () => setOpen(false) })
          : null,
        open && !data && !error ? h("div", { className: "wb-toast" }, "小鲸鱼正在游过来…") : null,
        error && !open ? h("div", { className: "wb-toast" }, `鲸鱼出了点问题：${error}`) : null,
      );
    }
