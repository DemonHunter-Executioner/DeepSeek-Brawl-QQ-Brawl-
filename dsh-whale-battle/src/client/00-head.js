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
