/* ------------------------------------------------------------------ 数据 */

    function useGame() {
      const [data, setData] = useState(null);
      const [error, setError] = useState("");
      const [busy, setBusy] = useState(false);
      const mounted = useRef(true);

      const load = useCallback(async () => {
        try {
          const payload = await getJson("/state");
          if (mounted.current) {
            setData(payload);
            setError("");
          }
          return payload;
        } catch (err) {
          if (mounted.current) setError(String(err && err.message ? err.message : err));
          return null;
        }
      }, []);

      useEffect(() => {
        mounted.current = true;
        load();
        const timer = setInterval(load, 90_000);
        return () => {
          mounted.current = false;
          clearInterval(timer);
        };
      }, [load]);

      const act = useCallback(async (path, body) => {
        setBusy(true);
        try {
          const payload = await postJson(path, body);
          const next = payload && payload.state ? payload.state : payload;
          // 只有真正的游戏快照才替换全局数据；/desktop 这类操作返回的不是快照
          if (mounted.current && next && next.team) {
            setData(next);
            setError("");
          } else if (mounted.current) {
            setError("");
          }
          return payload;
        } catch (err) {
          if (mounted.current) setError(String(err && err.message ? err.message : err));
          throw err;
        } finally {
          if (mounted.current) setBusy(false);
        }
      }, []);

      return { data, error, busy, load, act };
    }

    /* ------------------------------------------------------------------ 台词 */

    const IDLE_LINES = [
      "在看什么呢？",
      "今天的仗还没打呢。",
      "尾巴摇一摇，水花四溅。",
      "我也想帮你干活。",
      "刚才那步走得不错。",
      "肚子有点空。",
      "深海里很安静，和你这里一样。",
      "别一直盯着我，看看屏幕。",
      "要不要一起打一关？",
      "我记着你今天很忙。",
      "喷出来的水是凉的。",
      "鲸鱼也会累的。",
    ];

    function pickBubble(data, tick) {
      if (!data) return "小鲸鱼正在游过来…";
      const care = data.care || {};
      if (care.hunger < 22) return "饿得游不动了…";
      if (care.clean < 22) return "身上有点味道，想洗澡。";
      if (care.stamina < 18) return "眼皮在打架，让我睡会儿。";
      if (care.mood < 25) return "陪陪我嘛，就一会儿。";
      if (data.stats && data.stats.battles === 0) return "第一关就在旁边，去试试？";
      if (data.work && data.work.bonusPct > 0 && tick % 5 === 0) {
        return `今天你已经很拼了，经验 +${data.work.bonusPct}%。`;
      }
      return IDLE_LINES[tick % IDLE_LINES.length];
    }

    /** 每秒重算冷却，供面板里的倒计时用。 */
    function useNow(active) {
      const [now, setNow] = useState(() => Date.now());
      useEffect(() => {
        if (!active) return undefined;
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
      }, [active]);
      return now;
    }
