function importModule() {
  return {
    type: "hero",
    id: "Aurora",
    title: "双界灵兔",
    name: "阿萝拉",
    avatar: "Aurora.png",
    skins: [
      { name: "default", skin: "Aurora_0.jpg" },
      { name: "幻灵战斗兔 阿萝拉", skin: "Aurora_1.jpg" },
    ],
    spells: [
      { id: "AuroraP", name: "驱灵奇术", icon: "AuroraP.png", description: "" },
      { id: "AuroraQ", name: "飞去来咒", icon: "AuroraQ.png", description: "" },
      { id: "AuroraW", name: "灵纱洞开", icon: "AuroraW.png", description: "" },
      { id: "AuroraE", name: "怪奇喷涌", icon: "AuroraE.png", description: "" },
      { id: "AuroraR", name: "双界合一", icon: "AuroraR.png", description: "" },
    ],
    effects: {
      AuroraP: null,
      AuroraQ: null,
      AuroraW: null,
      AuroraE: null,
      AuroraR: null,
    },
  };
}
export { importModule };
