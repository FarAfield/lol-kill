function importModule() {
  return {
    type: "hero",
    id: "Briar",
    title: "狂厄蔷薇",
    name: "贝蕾亚",
    avatar: "Briar.png",
    skins: [
      { name: "default", skin: "Briar_0.jpg" },
      { name: "妖怪艺术家 贝蕾亚", skin: "Briar_1.jpg" },
      { name: "幻灵海魔人 贝蕾亚", skin: "Briar_10.jpg" },
    ],
    spells: [
      { id: "BriarP", name: "猩红诅咒", icon: "BriarP.png", description: "" },
      { id: "BriarQ", name: "冲头", icon: "BriarQ.png", description: "" },
      {
        id: "BriarW",
        name: "血莽 / 噬击",
        icon: "BriarW.png",
        description: "",
      },
      { id: "BriarE", name: "惊吼", icon: "BriarE.png", description: "" },
      { id: "BriarR", name: "毙除", icon: "BriarR.png", description: "" },
    ],
    effects: {
      BriarP: null,
      BriarQ: null,
      BriarW: null,
      BriarE: null,
      BriarR: null,
    },
  };
}
export { importModule };
