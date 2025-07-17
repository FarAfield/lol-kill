function importModule() {
  return {
    type: "hero",
    id: "Hwei",
    title: "异画师",
    name: "彗",
    avatar: "Hwei.png",
    skins: [
      { name: "default", skin: "Hwei_0.jpg" },
      { name: "北极星使者 彗", skin: "Hwei_1.jpg" },
    ],
    spells: [
      { id: "HweiP", name: "落款", icon: "HweiP.png", description: "" },
      { id: "HweiQ", name: "主题：灾", icon: "HweiQ.png", description: "" },
      { id: "HweiW", name: "主题：靖", icon: "HweiW.png", description: "" },
      { id: "HweiE", name: "主题：悚", icon: "HweiE.png", description: "" },
      { id: "HweiR", name: "焚心绚华绘", icon: "HweiR.png", description: "" },
    ],
    effects: {
      HweiP: null,
      HweiQ: null,
      HweiW: null,
      HweiE: null,
      HweiR: null,
    },
  };
}
export { importModule };
