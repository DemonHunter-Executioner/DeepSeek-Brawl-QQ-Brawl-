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
