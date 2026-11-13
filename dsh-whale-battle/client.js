/*
 * dsh-whale-battle · 浏览器半区（自动生成，不要直接改这个文件）
 *
 * 源文件：src/client/*.js  →  node bin/build-client.mjs  →  client.js
 * 生成时间不写进文件，保证构建可重复（CI 会用 git diff 检查产物是否最新）。
 * 版本：0.3.0
 */
/**
 * 鲸鱼大作战 · 浏览器半区（由 src/client/*.js 拼接生成，不要直接改这个文件）
 *
 * 挂在 shell.overlay（root 作用域、list 槽位）里：一条可拖动的小鲸鱼待在右下角，
 * 点开是一整块面板——对战、养成、队伍、说明。
 *
 * 所有数值都来自宿主 /dsh-whale-battle/*，这里只负责画和演。
 * 战斗是「整场日志一次拿回来，按帧回放 + 每帧生成一个动作」，所以跳过动画、
 * 刷新页面都不会改变结果。
 */
window.__ModuleLoader__.load({
  id: "dsh-whale-battle",
  factory: (require) => {
    const React = require("react");
    const h = React.createElement;
    const { useCallback, useEffect, useMemo, useRef, useState } = React;

    const API_BASE = "/dsh-whale-battle";
    const LS = {
      pos: "dsh-whale-battle:pos",
      speed: "dsh-whale-battle:speed",
      tab: "dsh-whale-battle:tab",
    };

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

/* ------------------------------------------------------------------ 插件出口 */

    return {
      inject: ["slots"],
      apply(ctx) {
        ctx.slots.inject("shell.overlay", () =>
          ctx.slots.register(
            { name: "shell.overlay", id: "whale-battle", order: 120 },
            Overlay,
          ),
        );
      },
    };
  },
});
