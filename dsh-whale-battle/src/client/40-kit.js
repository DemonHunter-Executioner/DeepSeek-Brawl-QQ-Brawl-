/* ------------------------------------------------------------------ 小组件 */

    function Bar({ value, max = 100, color, height = 8, style }) {
      const ratio = pct(value, max);
      return h(
        "div",
        { className: "wb-bar", style: { height, ...style } },
        h("i", { style: { width: `${ratio}%`, background: color || barColor(ratio / 100) } }),
      );
    }

    function Meter({ icon, label, value, color }) {
      const ratio = clamp(value, 0, 100) / 100;
      return h(
        "div",
        { className: "wb-meter" },
        h("div", { className: "wb-meter-top" }, h("span", null, icon), h("span", null, label), h("b", null, Math.round(value))),
        h(Bar, { value, color: color || barColor(ratio) }),
      );
    }

    function Section({ children }) {
      return h("div", { className: "wb-sec" }, children);
    }

    function Pill({ color, icon, children }) {
      return h(
        "span",
        { className: "wb-pill", style: color ? { color, background: `${color}1a`, borderColor: `${color}44` } : undefined },
        icon ? h("span", null, icon) : null,
        children,
      );
    }

    function Stat({ label, value }) {
      return h("div", { className: "wb-stat" }, h("strong", null, value), h("span", null, label));
    }

    function Btn({ children, primary, danger, ghost, ...rest }) {
      const cls = ["wb-btn", primary ? "wb-primary" : "", danger ? "wb-danger" : "", ghost ? "wb-ghost" : ""].filter(Boolean).join(" ");
      return h("button", { type: "button", className: cls, ...rest }, children);
    }
