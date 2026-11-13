/* ------------------------------------------------------------------ 工具 */

    let styleReady = false;
    function ensureStyle() {
      if (styleReady || typeof document === "undefined" || !document.head) return;
      const tag = document.createElement("style");
      tag.setAttribute("data-dsh-plugin", "whale-battle");
      tag.textContent = STYLE_TEXT;
      document.head.appendChild(tag);
      styleReady = true;
    }

    async function getJson(path) {
      const response = await fetch(`${API_BASE}${path}`, { headers: { accept: "application/json" } });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload || payload.ok !== true) {
        throw new Error((payload && payload.error) || `HTTP ${response.status}`);
      }
      return payload;
    }

    async function postJson(path, body) {
      const response = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body || {}),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload || payload.ok !== true) {
        throw new Error((payload && payload.error) || `HTTP ${response.status}`);
      }
      return payload;
    }

    function clamp(value, min, max) {
      return Math.min(max, Math.max(min, Number(value) || 0));
    }

    function pct(value, max) {
      if (!max) return 0;
      return clamp((value / max) * 100, 0, 100);
    }

    function barColor(ratio) {
      if (ratio > 0.6) return "linear-gradient(90deg,#37c78b,#5fe0a8)";
      if (ratio > 0.3) return "linear-gradient(90deg,#f2b544,#ffd166)";
      return "linear-gradient(90deg,#ef6b6b,#ff9a7b)";
    }

    function readJson(key, fallback) {
      try {
        const raw = JSON.parse(localStorage.getItem(key) || "null");
        return raw && typeof raw === "object" ? raw : fallback;
      } catch {
        return fallback;
      }
    }

    function readNumber(key, fallback, allowed) {
      const n = Number(localStorage.getItem(key));
      return allowed.includes(n) ? n : fallback;
    }

    function remember(key, value) {
      try {
        localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
      } catch {}
    }

    function mmss(ms) {
      const total = Math.max(0, Math.ceil(ms / 1000));
      const m = Math.floor(total / 60);
      const s = total % 60;
      return `${m}:${String(s).padStart(2, "0")}`;
    }

    /** 技能元素决定动作颜色；日志里没带就退回萌系。 */
    function skillColor(entry) {
      return ELEMENT_COLOR[entry && entry.skillEl] || ELEMENT_COLOR.neutral;
    }

    /**
     * 把一条战斗日志翻译成一个「动作」。
     * BattleView 只认这个结构：谁打谁、什么类型、多大伤害、什么颜色。
     */
    function actionOf(entry) {
      if (!entry) return null;
      const base = {
        type: entry.kind,
        seq: entry.r,
        actor: entry.actor || null,
        target: entry.target || null,
        color: skillColor(entry),
        skill: entry.skillName || "",
        skillEl: entry.skillEl || "neutral",
      };
      if (entry.kind === "hit") {
        return { ...base, damage: entry.dmg, crit: entry.crit, absorbed: entry.absorbed, mult: entry.mult };
      }
      if (entry.kind === "dot") return { ...base, damage: entry.dmg, dot: entry.effect };
      if (entry.kind === "heal") return { ...base, heal: entry.amount };
      if (entry.kind === "shield") return { ...base, shield: entry.amount };
      if (entry.kind === "status") return { ...base, status: entry.effect };
      if (entry.kind === "down") return { ...base, down: true };
      if (entry.kind === "skip") return { ...base, skip: true };
      return base;
    }

    function replyOf(entry) {
      if (!entry) return "";
      return entry.text || "";
    }
