/* ------------------------------------------------------------------ 立绘 */

    /**
     * 鲸鱼立绘：纯 SVG，不依赖任何图片资源。
     * - 尾巴/胸鳍/喷水/眨眼各有独立动画，只在 .wb-bob 容器里跑，避免布局抖动
     * - element 决定头顶的装饰，form 决定有没有背鳍和王冠
     * - ko 时眼睛变 X、身体压暗
     */
    function WhaleSprite({ element = "neutral", size = 120, form = 0, ko = false, flip = false }) {
      const accent = ELEMENT_COLOR[element] || ELEMENT_COLOR.neutral;
      const body = "#3f5fa8";
      const bodyDark = "#2e4780";
      const belly = "#e8f1ff";
      const line = "#22355e";
      const eye = "#101a2e";

      const parts = [];
      // 背鳍（长大才有）
      if (form >= 2) {
        parts.push(h("path", { key: "dorsal", d: "M88,26 C90,17 97,14 99,20 C100,26 94,28 90,31 Z", fill: bodyDark, opacity: 0.95 }));
      }

      // 尾巴
      parts.push(
        h(
          "g",
          { key: "tail", className: "wh-tail", style: { transformOrigin: "112px 54px" } },
          h("path", { d: "M108,50 C117,39 130,34 137,39 C132,46 121,50 110,54 Z", fill: body }),
          h("path", { d: "M110,54 C121,58 132,62 137,60 C130,67 117,66 108,58 Z", fill: bodyDark }),
        ),
      );

      // 身体
      parts.push(h("path", { key: "body", d: "M28,54 C28,34 45,21 66,21 C88,21 103,31 111,46 C113,50 114,51 115,53 C115,56 112,61 107,67 C97,79 77,87 57,84 C41,82 29,72 28,60 Z", fill: body }));
      // 肚子高光
      parts.push(h("path", { key: "belly", d: "M35,63 C43,77 65,84 86,77 C74,87 47,86 35,63 Z", fill: belly, opacity: 0.92 }));
      // 背部高光
      parts.push(h("path", { key: "shine", d: "M40,32 C52,24 70,22 84,27 C70,25 54,29 44,37 Z", fill: "#ffffff", opacity: 0.16 }));

      // 胸鳍
      parts.push(
        h("path", { key: "fin", className: "wh-fin", style: { transformOrigin: "62px 74px" }, d: "M60,66 C53,75 55,84 64,85 C71,86 74,79 70,73 Z", fill: bodyDark }),
      );

      // 眼睛（眨眼用 scaleY）
      const eyeGroup = [
        h("circle", { key: "ew", cx: 44, cy: 46, r: 6.6, fill: "#ffffff" }),
        h("circle", { key: "ep", cx: 45.8, cy: 46.6, r: 3.2, fill: eye }),
        h("circle", { key: "eh", cx: 43.6, cy: 44.6, r: 1.2, fill: "#ffffff" }),
      ];
      if (ko) {
        eyeGroup.length = 0;
        eyeGroup.push(h("path", { key: "x1", d: "M40,43 L48,50 M48,43 L40,50", stroke: eye, strokeWidth: 2, strokeLinecap: "round" }));
      }
      parts.push(h("g", { key: "eye", className: ko ? undefined : "wh-eye", style: { transformOrigin: "44px 46px" } }, eyeGroup));

      // 嘴
      parts.push(h("path", { key: "mouth", d: ko ? "M33,63 C37,60 43,60 47,63" : "M31,60 C35,65 41,66 47,64", stroke: line, strokeWidth: 1.6, strokeLinecap: "round", fill: "none", opacity: 0.8 }));
      // 腮红
      parts.push(h("ellipse", { key: "blush", cx: 35, cy: 55, rx: 4.2, ry: 2.6, fill: "#ff9fbf", opacity: 0.35 }));

      // 喷水孔 + 水柱
      parts.push(h("ellipse", { key: "blow", cx: 55, cy: 23, rx: 3.2, ry: 1.5, fill: bodyDark }));
      parts.push(
        h(
          "g",
          { key: "spout", className: "wh-spout", style: { transformOrigin: "55px 23px" } },
          h("path", { d: "M55,22 C53,14 49,9 44,6", stroke: "#bfe4ff", strokeWidth: 2, strokeLinecap: "round", fill: "none", opacity: 0.75 }),
          h("path", { d: "M55,22 C57,15 60,11 64,8", stroke: "#bfe4ff", strokeWidth: 2, strokeLinecap: "round", fill: "none", opacity: 0.6 }),
          h("circle", { cx: 43, cy: 4, r: 2, fill: "#d6efff", opacity: 0.9 }),
          h("circle", { cx: 65, cy: 5, r: 1.6, fill: "#d6efff", opacity: 0.75 }),
        ),
      );

      // 元素装饰（跟着属性换）
      if (element === "ice") {
        parts.push(h("path", { key: "el", d: "M96,10 L99,17 L106,19 L99,21 L96,28 L93,21 L86,19 L93,17 Z", fill: accent, opacity: 0.95 }));
      } else if (element === "water") {
        parts.push(h("path", { key: "el", d: "M105,6 C110,14 114,18 114,23 A9 9 0 0 1 96 23 C96,18 100,14 105,6 Z", fill: accent, opacity: 0.92 }));
      } else if (element === "fire") {
        parts.push(h("path", { key: "el", d: "M105,4 C109,12 117,15 117,23 A12 12 0 0 1 93 23 C93,17 98,13 101,9 C102,15 105,16 105,4 Z", fill: accent, opacity: 0.92 }));
      } else {
        parts.push(h("path", { key: "el", d: "M104,5 l2.2 4.8 5.2.7-3.8 3.7 1 5.2-4.6-2.5-4.6 2.5 1-5.2-3.8-3.7 5.2-.7 Z", fill: accent, opacity: 0.92 }));
      }

      // 王冠
      if (form >= 4) {
        parts.push(h("path", { key: "crown", d: "M62,12 L68,20 L76,8 L84,20 L90,12 L88,25 L64,25 Z", fill: "#ffd166", stroke: "#e0a92e", strokeWidth: 1 }));
        parts.push(h("circle", { key: "crownDot", cx: 76, cy: 17, r: 2, fill: "#ff6b6b" }));
      }

      return h(
        "svg",
        {
          className: "wb-whale",
          width: size,
          height: Math.round(size * 0.8),
          viewBox: "0 0 150 120",
          "aria-hidden": "true",
          style: flip ? { transform: "scaleX(-1)" } : undefined,
        },
        parts,
      );
    }

    /** 小号头像（列表/头部用） */
    function WhaleFace({ element = "neutral", form = 0, size = 34 }) {
      return WhaleSprite({ element, form, size: Math.round(size * 1.35) });
    }
