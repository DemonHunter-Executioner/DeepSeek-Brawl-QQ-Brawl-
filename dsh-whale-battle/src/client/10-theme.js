/* ------------------------------------------------------------------ 主题 */

    const TONE = {
      text: "var(--dsw-alias-label-primary, #e9edf7)",
      dim: "var(--dsw-alias-label-secondary, #a7b0c4)",
      faint: "var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary, #7f8798))",
      border: "var(--dsw-alias-border-l1, rgba(255,255,255,.12))",
      borderStrong: "var(--dsw-alias-border-l2, rgba(255,255,255,.2))",
      surface: "var(--dsw-alias-bg-layer-1, #151b28)",
      surface2: "var(--dsw-alias-bg-layer-2, #1d2537)",
      surface3: "rgba(255,255,255,.045)",
      brand: "var(--dsw-alias-brand-primary, #4d8dff)",
      ok: "var(--dsw-alias-state-success-primary, #4cc38a)",
      warn: "var(--dsw-alias-state-warn-primary, #f2b544)",
      error: "var(--dsw-alias-state-error-primary, #ef6b6b)",
    };

    const ELEMENT_COLOR = { neutral: "#ffd166", ice: "#7fd3ff", water: "#5aa9ff", fire: "#ff8a5c" };
    const ELEMENT_ICON = { neutral: "🐋", ice: "❄️", water: "💧", fire: "🔥" };
    const ELEMENT_NAME = { neutral: "萌", ice: "冰", water: "水", fire: "火" };

    const MONO = "ui-monospace, SFMono-Regular, Consolas, monospace";
    const FONT = 'var(--dsh-font-family-body, ui-sans-serif, system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif)';

    /* ------------------------------------------------------------------ 样式 */

    const STYLE_TEXT = `
.wb-root{position:fixed;inset:0;pointer-events:none;z-index:70;font-family:${FONT};-webkit-font-smoothing:antialiased;color:${TONE.text}}
.wb-root *{box-sizing:border-box}

/* ---------- 悬浮鲸鱼 ---------- */
.wb-pet{position:absolute;pointer-events:auto;display:flex;flex-direction:column;align-items:center;gap:7px;cursor:grab;user-select:none;touch-action:none;filter:drop-shadow(0 14px 26px rgba(8,16,32,.45));transition:filter .25s,transform .25s}
.wb-pet:hover{filter:drop-shadow(0 16px 30px rgba(90,160,255,.35))}
.wb-pet:active{cursor:grabbing}
.wb-pet-avatar{transform-origin:50% 85%;animation:wb-bob 3.6s ease-in-out infinite;transition:transform .2s}
.wb-pet:active .wb-pet-avatar{transform:scale(.97)}
.wb-bubble{position:relative;pointer-events:auto;cursor:pointer;max-width:230px;padding:9px 13px;border-radius:15px;font-size:12px;line-height:1.55;color:#0e1a2e;background:linear-gradient(180deg,#ffffff,#e8f2ff);border:1px solid rgba(255,255,255,.75);box-shadow:0 12px 30px rgba(6,14,28,.4);animation:wb-pop .3s cubic-bezier(.2,.9,.3,1.2) both}
.wb-bubble:hover{background:linear-gradient(180deg,#ffffff,#dceaff)}
.wb-bubble:after{content:"";position:absolute;left:50%;bottom:-6px;width:12px;height:12px;margin-left:-6px;transform:rotate(45deg);background:#e9f2ff;border-right:1px solid rgba(255,255,255,.6);border-bottom:1px solid rgba(255,255,255,.6)}
.wb-nameplate{display:flex;align-items:center;gap:5px;font-size:11px;line-height:1;padding:4px 10px;border-radius:999px;background:rgba(12,20,34,.72);color:#dbe7ff;border:1px solid rgba(140,190,255,.28);backdrop-filter:blur(8px);white-space:nowrap;font-variant-numeric:tabular-nums;box-shadow:0 4px 14px rgba(0,0,0,.25)}
.wb-nameplate i{font-style:normal;color:#8fc0ff}
.wh-tail{animation:wb-tail 2.8s ease-in-out infinite}
.wh-fin{animation:wb-fin 3.2s ease-in-out infinite}
.wh-spout{animation:wb-spout 2.4s ease-in-out infinite}
.wh-eye{animation:wb-blink 5s ease-in-out infinite}

/* ---------- 面板 ---------- */
.wb-panel{position:fixed;pointer-events:auto;display:flex;flex-direction:column;border-radius:22px;overflow:hidden;background:
  radial-gradient(120% 90% at 100% 0%,rgba(77,141,255,.16),transparent 55%),
  radial-gradient(90% 70% at 0% 100%,rgba(64,220,255,.10),transparent 60%),
  ${TONE.surface};
  color:${TONE.text};border:1px solid ${TONE.borderStrong};box-shadow:0 36px 100px rgba(0,0,0,.6),0 0 0 1px rgba(0,0,0,.25),inset 0 1px 0 rgba(255,255,255,.06);animation:wb-in .26s cubic-bezier(.2,.9,.3,1.05) both}
.wb-head{position:relative;display:flex;align-items:center;gap:12px;padding:13px 14px 13px 16px;cursor:move;border-bottom:1px solid ${TONE.border};background:linear-gradient(120deg,rgba(77,141,255,.18),rgba(127,211,255,.05) 45%,transparent 75%)}
.wb-head-face{width:44px;height:44px;border-radius:15px;display:flex;align-items:center;justify-content:center;background:radial-gradient(120% 120% at 30% 20%,rgba(255,255,255,.22),rgba(77,141,255,.16));border:1px solid rgba(160,205,255,.3);box-shadow:inset 0 1px 0 rgba(255,255,255,.25),0 6px 16px rgba(30,80,180,.25);overflow:hidden}
.wb-head-title{display:flex;flex-direction:column;gap:2px;min-width:0}
.wb-head-title b{font-size:15px;letter-spacing:.4px}
.wb-head-title span{font-size:11px;color:${TONE.dim};display:flex;align-items:center;gap:6px}
.wb-gold{margin-left:auto;display:flex;align-items:center;gap:6px;font-size:12.5px;font-variant-numeric:tabular-nums;color:#ffd479;background:rgba(255,212,121,.09);border:1px solid rgba(255,212,121,.25);padding:6px 11px;border-radius:999px}
.wb-gold b{font-weight:700}
.wb-x{border:none;background:rgba(255,255,255,.06);color:${TONE.dim};width:28px;height:28px;border-radius:10px;cursor:pointer;font-size:14px;line-height:1;transition:.15s}
.wb-x:hover{background:rgba(239,107,107,.18);color:#ffc7c7}
.wb-tabs{display:flex;gap:4px;padding:8px 12px 0;border-bottom:1px solid ${TONE.border};position:relative}
.wb-tab{position:relative;border:none;background:transparent;color:${TONE.dim};font-size:12.5px;padding:9px 14px 11px;border-radius:11px 11px 0 0;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:6px;transition:color .15s,background .15s}
.wb-tab:hover{color:${TONE.text};background:rgba(255,255,255,.05)}
.wb-tab.wb-on{color:#d7e8ff}
.wb-tab.wb-on:after{content:"";position:absolute;left:10px;right:10px;bottom:-1px;height:2px;border-radius:2px;background:linear-gradient(90deg,#4d8dff,#7fd3ff);box-shadow:0 0 12px rgba(90,160,255,.7)}
.wb-body{flex:1;min-height:0;overflow:auto;padding:16px 18px 20px;scrollbar-width:thin}
.wb-body::-webkit-scrollbar{width:9px;height:9px}
.wb-body::-webkit-scrollbar-thumb{background:rgba(255,255,255,.14);border-radius:9px;border:2px solid transparent;background-clip:content-box}
.wb-body::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,.22);background-clip:content-box}

/* ---------- 通用件 ---------- */
.wb-sec{display:flex;align-items:center;gap:8px;font-size:11px;letter-spacing:1px;color:${TONE.faint};margin:2px 0 10px;text-transform:uppercase}
.wb-sec:after{content:"";flex:1;height:1px;background:linear-gradient(90deg,${TONE.border},transparent)}
.wb-card{background:${TONE.surface2};border:1px solid ${TONE.border};border-radius:16px;padding:14px;box-shadow:inset 0 1px 0 rgba(255,255,255,.03)}
.wb-card+.wb-card{margin-top:12px}
.wb-btn{border:1px solid ${TONE.borderStrong};background:rgba(255,255,255,.05);color:${TONE.text};padding:9px 15px;border-radius:12px;font-size:12.5px;cursor:pointer;font-family:inherit;transition:.16s;display:inline-flex;align-items:center;justify-content:center;gap:6px}
.wb-btn:hover:not(:disabled){background:rgba(255,255,255,.11);transform:translateY(-1px);border-color:rgba(160,200,255,.4)}
.wb-btn:active:not(:disabled){transform:translateY(0)}
.wb-btn:disabled{opacity:.38;cursor:not-allowed}
.wb-btn.wb-primary{background:linear-gradient(135deg,#4d8dff,#7b6bff);border-color:transparent;color:#fff;font-weight:600;box-shadow:0 10px 24px rgba(77,141,255,.3)}
.wb-btn.wb-primary:hover:not(:disabled){filter:brightness(1.08);box-shadow:0 12px 28px rgba(77,141,255,.4)}
.wb-btn.wb-danger{color:#ffb4b4;border-color:rgba(239,107,107,.4)}
.wb-btn.wb-ghost{background:transparent}
.wb-pill{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;padding:3px 8px;border-radius:999px;background:rgba(255,255,255,.07);color:${TONE.dim};border:1px solid transparent}
.wb-muted{color:${TONE.dim};font-size:12px;line-height:1.65}
.wb-bar{height:8px;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden;box-shadow:inset 0 1px 2px rgba(0,0,0,.35)}
.wb-bar>i{display:block;height:100%;border-radius:99px;transition:width .45s cubic-bezier(.3,.9,.3,1)}
.wb-row{display:flex;align-items:center;gap:10px}
.wb-grow{flex:1;min-width:0}

/* ---------- 对战：关卡列表 ---------- */
.wb-progress{display:flex;align-items:center;gap:10px;margin-bottom:12px}
.wb-progress .wb-bar{flex:1;height:6px}
.wb-progress span{font-size:11px;color:${TONE.dim};font-variant-numeric:tabular-nums}
.wb-stages{display:grid;grid-template-columns:repeat(auto-fill,minmax(164px,1fr));gap:9px}
.wb-stage{position:relative;text-align:left;border:1px solid ${TONE.border};background:linear-gradient(160deg,rgba(255,255,255,.05),rgba(255,255,255,.015));border-radius:14px;padding:11px 12px;cursor:pointer;color:${TONE.text};font-family:inherit;transition:.18s;overflow:hidden}
.wb-stage:before{content:"";position:absolute;inset:0;background:radial-gradient(70% 90% at 100% 0%,var(--el,rgba(90,160,255,.25)),transparent 70%);opacity:.55;pointer-events:none}
.wb-stage:hover:not(.wb-locked){border-color:rgba(120,175,255,.55);transform:translateY(-2px);box-shadow:0 12px 26px rgba(0,0,0,.3)}
.wb-stage.wb-sel{border-color:rgba(120,175,255,.85);background:rgba(77,141,255,.14);box-shadow:0 0 0 1px rgba(120,175,255,.35),0 14px 30px rgba(30,80,180,.25)}
.wb-stage.wb-locked{opacity:.45;cursor:not-allowed;filter:saturate(.5)}
.wb-stage-top{display:flex;align-items:center;gap:6px;margin-bottom:5px}
.wb-stage-top b{font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-stage-sub{font-size:10.5px;color:${TONE.dim};display:flex;gap:6px;align-items:center}
.wb-stage-enemies{display:flex;gap:3px;margin-top:7px;flex-wrap:wrap}
.wb-detail{display:grid;grid-template-columns:1fr auto;gap:14px;align-items:center;margin-top:14px;padding:15px;border-radius:16px;border:1px solid rgba(120,175,255,.28);background:linear-gradient(120deg,rgba(77,141,255,.12),rgba(255,255,255,.02))}
.wb-detail h4{margin:0 0 5px;font-size:14px;display:flex;align-items:center;gap:8px}
.wb-enemy-list{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.wb-detail-actions{display:flex;flex-direction:column;gap:8px;align-items:flex-end}

/* ---------- 对战：战场 ---------- */
.wb-battle{display:flex;flex-direction:column;gap:10px;height:100%;min-height:380px}
.wb-battle-top{display:flex;align-items:center;gap:10px}
.wb-battle-top .wb-grow{display:flex;align-items:center;gap:8px}
.wb-round{font-size:11px;letter-spacing:.6px;color:${TONE.faint};font-variant-numeric:tabular-nums}
.wb-arena{position:relative;flex:1;min-height:220px;border-radius:18px;border:1px solid ${TONE.border};overflow:hidden;padding:12px;
  background:
    radial-gradient(80% 90% at 50% -10%,var(--arena,#1d3a66),transparent 70%),
    radial-gradient(60% 50% at 50% 115%,rgba(10,20,38,.9),transparent 70%),
    linear-gradient(180deg,rgba(10,18,34,.6),rgba(24,36,60,.35));
  display:flex;flex-direction:column;justify-content:space-between}
.wb-arena:before{content:"";position:absolute;left:0;right:0;top:50%;height:1px;background:linear-gradient(90deg,transparent,rgba(160,205,255,.25),transparent)}
.wb-arena:after{content:"";position:absolute;left:50%;top:50%;width:280px;height:280px;margin:-140px 0 0 -140px;border-radius:50%;border:1px dashed rgba(160,205,255,.14);pointer-events:none}
.wb-team{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;position:relative;z-index:2}
.wb-team.wb-enemy{padding-bottom:6px}
.wb-team.wb-ally{padding-top:6px}
.wb-unit{width:104px;border-radius:15px;padding:9px 7px 8px;background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(255,255,255,.03));border:1px solid ${TONE.border};text-align:center;position:relative;transition:transform .28s cubic-bezier(.2,.9,.3,1),box-shadow .25s,border-color .25s;will-change:transform}
.wb-unit.wb-active{border-color:rgba(120,175,255,.65);box-shadow:0 0 0 1px rgba(120,175,255,.35),0 10px 26px rgba(20,60,140,.35)}
.wb-unit.wb-dead{opacity:.32;filter:grayscale(.9);transform:rotate(-6deg) translateY(4px)}
.wb-unit-anim{position:relative;display:flex;justify-content:center;align-items:flex-end;transform-origin:50% 70%}
.wb-anim-hit{animation:wb-shake .3s ease}
.wb-anim-lunge-up{animation:wb-lunge-up .32s ease}
.wb-anim-lunge-down{animation:wb-lunge-down .32s ease}
.wb-unit.wb-glow{box-shadow:0 0 0 2px rgba(111,231,168,.55),0 0 30px rgba(111,231,168,.35)}
.wb-unit-name{font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:3px}
.wb-unit-lv{font-size:9.5px;color:${TONE.faint};font-variant-numeric:tabular-nums}
.wb-hp{height:5px;border-radius:99px;background:rgba(0,0,0,.4);overflow:hidden;margin-top:6px;box-shadow:inset 0 1px 2px rgba(0,0,0,.4)}
.wb-hp>i{display:block;height:100%;transition:width .32s ease,background .3s}
.wb-en{height:3px;border-radius:99px;background:rgba(255,255,255,.1);overflow:hidden;margin-top:3px}
.wb-en>i{display:block;height:100%;background:linear-gradient(90deg,#ffd166,#ff8a5c);transition:width .3s}
.wb-shield{margin-top:3px;font-size:9px;color:#9fd0ff;letter-spacing:.2px}
.wb-dmg{position:absolute;left:50%;top:-8px;transform:translateX(-50%);font-weight:800;font-size:17px;color:#ffb070;text-shadow:0 2px 10px rgba(0,0,0,.75);animation:wb-dmg .8s ease-out both;pointer-events:none;z-index:5}
.wb-dmg.wb-crit{color:#ff6060;font-size:22px}
.wb-dmg.wb-plus{color:#6fe7a8}
.wb-burst{position:absolute;left:50%;top:42%;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;pointer-events:none;z-index:4;box-shadow:0 0 0 0 var(--c,#7fd3ff);animation:wb-burst .38s ease-out both}
.wb-mid{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;gap:5px;padding:4px 10px;min-height:64px;justify-content:center}
.wb-banner{font-size:12.5px;font-weight:600;letter-spacing:.5px;padding:4px 12px;border-radius:999px;background:rgba(10,18,34,.72);border:1px solid var(--c,rgba(120,175,255,.5));color:var(--c,#cfe4ff);animation:wb-banner .5s ease both;box-shadow:0 0 18px color-mix(in srgb,var(--c,#7fd3ff) 35%,transparent)}
.wb-logline{font-size:11.5px;line-height:1.45;color:${TONE.dim};text-align:center;max-width:92%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:.9}
.wb-logline:last-child{color:${TONE.text}}
.wb-quake{animation:wb-quake .32s ease}
.wb-result{position:absolute;inset:0;z-index:6;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:rgba(8,14,26,.84);backdrop-filter:blur(8px);animation:wb-pop .28s ease both;text-align:center;padding:20px}
.wb-result h3{margin:0;font-size:24px;letter-spacing:2px;background:linear-gradient(90deg,#9fd0ff,#c9b8ff);-webkit-background-clip:text;background-clip:text;color:transparent}
.wb-result .wb-rewards{display:flex;gap:14px;font-size:13px;font-variant-numeric:tabular-nums}
.wb-result .wb-rewards b{font-size:17px}
.wb-timer{display:flex;gap:6px;align-items:center;margin-left:auto}

/* ---------- 养成 ---------- */
.wb-hero{display:grid;grid-template-columns:auto 1fr;gap:18px;align-items:center;padding:16px;border-radius:18px;border:1px solid ${TONE.border};background:
  radial-gradient(90% 120% at 0% 0%,rgba(77,141,255,.16),transparent 60%),
  linear-gradient(160deg,rgba(255,255,255,.05),rgba(255,255,255,.015))}
.wb-hero-face{position:relative;display:flex;align-items:flex-end;justify-content:center;width:172px;height:150px}
.wb-hero-face:after{content:"";position:absolute;left:50%;bottom:6px;width:120px;height:14px;margin-left:-60px;border-radius:50%;background:radial-gradient(50% 50%,rgba(120,175,255,.25),transparent 70%)}
.wb-hero-name{display:flex;align-items:baseline;gap:9px;flex-wrap:wrap}
.wb-hero-name b{font-size:20px;letter-spacing:.5px}
.wb-hero-form{font-size:11.5px;color:${TONE.dim}}
.wb-hero-tag{display:flex;gap:6px;margin-top:6px;flex-wrap:wrap}
.wb-exp{display:flex;align-items:center;gap:9px;font-size:11px;color:${TONE.faint};margin-top:10px}
.wb-exp .wb-bar{flex:1}
.wb-stats4{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:12px}
.wb-stat{background:rgba(255,255,255,.045);border:1px solid ${TONE.border};border-radius:11px;padding:7px 4px;text-align:center}
.wb-stat strong{display:block;font-size:14px;font-variant-numeric:tabular-nums}
.wb-stat span{font-size:9.5px;color:${TONE.faint}}
.wb-meters{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.wb-meter{padding:10px 12px;border-radius:13px;background:${TONE.surface3};border:1px solid ${TONE.border}}
.wb-meter-top{display:flex;align-items:center;gap:6px;font-size:11.5px;color:${TONE.dim};margin-bottom:7px}
.wb-meter-top b{margin-left:auto;color:${TONE.text};font-variant-numeric:tabular-nums;font-size:12px}
.wb-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}
.wb-act{position:relative;display:flex;flex-direction:column;align-items:center;gap:4px;padding:12px 6px 10px;border-radius:14px;border:1px solid ${TONE.border};background:linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.02));color:${TONE.text};cursor:pointer;font-family:inherit;font-size:12px;transition:.16s;overflow:hidden}
.wb-act:hover:not(:disabled){border-color:rgba(120,175,255,.5);transform:translateY(-2px);box-shadow:0 10px 22px rgba(0,0,0,.28)}
.wb-act:disabled{opacity:.4;cursor:not-allowed}
.wb-act .wb-act-icon{font-size:19px;line-height:1.1}
.wb-act em{font-style:normal;font-size:10px;color:${TONE.faint}}
.wb-skills{display:grid;gap:6px}
.wb-skill{display:flex;align-items:center;gap:9px;padding:8px 11px;border-radius:11px;background:${TONE.surface3};border:1px solid transparent;font-size:12px}
.wb-skill:hover{border-color:${TONE.border};background:rgba(255,255,255,.07)}
.wb-dot{width:7px;height:7px;border-radius:99px;flex:none;box-shadow:0 0 8px var(--c,transparent)}
.wb-skill-cost{margin-left:auto;font-size:10px;color:${TONE.faint};white-space:nowrap}
.wb-skill-desc{color:${TONE.dim};font-size:10.5px;flex-basis:100%;line-height:1.45;margin-top:-2px;padding-left:16px}
.wb-work{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;text-align:center}
.wb-work>div{background:${TONE.surface3};border:1px solid ${TONE.border};border-radius:12px;padding:10px 4px}
.wb-work strong{display:block;font-size:17px;font-variant-numeric:tabular-nums;letter-spacing:.3px}
.wb-work span{font-size:9.5px;color:${TONE.faint}}
.wb-note{font-size:11px;color:${TONE.faint};margin-top:9px;line-height:1.6}

/* ---------- 队伍 ---------- */
.wb-roster{display:grid;gap:9px}
.wb-member{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;padding:11px 13px;border-radius:14px;border:1px solid ${TONE.border};background:linear-gradient(120deg,rgba(255,255,255,.05),rgba(255,255,255,.015))}
.wb-member-name{display:flex;align-items:center;gap:8px;font-size:13.5px}
.wb-member-stats{display:flex;gap:10px;font-size:10.5px;color:${TONE.faint};margin-top:3px;font-variant-numeric:tabular-nums}
.wb-member-actions{display:flex;gap:6px;align-items:center}
.wb-input{background:rgba(0,0,0,.28);border:1px solid ${TONE.borderStrong};color:${TONE.text};border-radius:9px;padding:6px 9px;font-size:12px;font-family:inherit;width:104px;outline:none;transition:.15s}
.wb-input:focus{border-color:rgba(120,175,255,.7);box-shadow:0 0 0 2px rgba(77,141,255,.15)}
.wb-recruit{display:flex;gap:8px;flex-wrap:wrap}

/* ---------- 说明 ---------- */
.wb-about-row{display:flex;gap:8px;align-items:flex-start;font-size:12px;color:${TONE.dim};line-height:1.65}
.wb-about-row b{color:${TONE.text}}
.wb-about-row em{font-style:normal;flex:none;width:18px;text-align:center}
.wb-path{font-family:${MONO};font-size:10.5px;color:${TONE.faint};word-break:break-all;background:rgba(0,0,0,.22);border-radius:8px;padding:7px 9px;margin-top:6px}

/* ---------- 其它 ---------- */
.wb-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);pointer-events:none;background:rgba(18,26,42,.96);border:1px solid ${TONE.borderStrong};color:${TONE.text};font-size:12px;padding:9px 15px;border-radius:12px;box-shadow:0 16px 40px rgba(0,0,0,.5);z-index:80;animation:wb-pop .22s ease both;max-width:70vw}
.wb-empty{padding:26px;text-align:center;color:${TONE.faint};font-size:12px}

/* ---------- 关键帧 ---------- */
@keyframes wb-bob{0%,100%{transform:translateY(0) rotate(-1.2deg)}50%{transform:translateY(-7px) rotate(1.4deg)}}
@keyframes wb-pop{from{opacity:0;transform:translateY(6px) scale(.97)}to{opacity:1;transform:none}}
@keyframes wb-in{from{opacity:0;transform:translateY(14px) scale(.975)}to{opacity:1;transform:none}}
@keyframes wb-dmg{0%{opacity:0;transform:translate(-50%,4px) scale(.7)}18%{opacity:1;transform:translate(-50%,-12px) scale(1.15)}100%{opacity:0;transform:translate(-50%,-40px) scale(.9)}}
@keyframes wb-burst{0%{opacity:.95;box-shadow:0 0 0 0 var(--c,#7fd3ff);transform:scale(.4)}70%{opacity:.7;box-shadow:0 0 0 18px transparent}100%{opacity:0;box-shadow:0 0 0 24px transparent;transform:scale(1.8)}}
@keyframes wb-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-4px) rotate(-1deg)}60%{transform:translateX(4px) rotate(1deg)}}
@keyframes wb-lunge-up{0%{transform:translateY(0)}38%{transform:translateY(-12px) scale(1.04)}100%{transform:translateY(0)}}
@keyframes wb-lunge-down{0%{transform:translateY(0)}38%{transform:translateY(12px) scale(1.04)}100%{transform:translateY(0)}}
@keyframes wb-quake{0%,100%{transform:translate(0,0)}25%{transform:translate(-3px,2px)}50%{transform:translate(3px,-2px)}75%{transform:translate(-2px,-1px)}}
@keyframes wb-banner{0%{opacity:0;transform:translateY(4px) scale(.94)}18%{opacity:1;transform:none}80%{opacity:1}100%{opacity:0}}
@keyframes wb-tail{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(6deg)}}
@keyframes wb-fin{0%,100%{transform:rotate(0)}50%{transform:rotate(-7deg)}}
@keyframes wb-spout{0%,100%{opacity:.55;transform:translateY(1px) scale(.94)}45%{opacity:1;transform:translateY(-3px) scale(1.05)}}
@keyframes wb-blink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.12)}}
`;
