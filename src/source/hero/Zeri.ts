function importModule() {
  return {
    type: "hero",
    id: "Zeri",
    title: "祖安花火",
    name: "泽丽",
    avatar: "Zeri.png",
    skins: [
      { name: "default", skin: "Zeri_0.jpg" },
      { name: "幽梦玫瑰 泽丽", skin: "Zeri_1.jpg" },
      { name: "海之歌 泽丽", skin: "Zeri_10.jpg" },
      { name: "玉剑传说 神机花火", skin: "Zeri_19.jpg" },
      { name: "魔域梦魇 泽丽", skin: "Zeri_28.jpg" },
      { name: "至臻 魔域梦魇 泽丽", skin: "Zeri_29.jpg" },
    ],
    spells: [
      { id: "ZeriP", name: "内能迁转", icon: "ZeriP.png", description: "" },
      { id: "ZeriQ", name: "电火迸射", icon: "ZeriQ.png", description: "" },
      { id: "ZeriW", name: "强穿激光", icon: "ZeriW.png", description: "" },
      { id: "ZeriE", name: "灿丽花火", icon: "ZeriE.png", description: "" },
      { id: "ZeriR", name: "超限爆闪", icon: "ZeriR.png", description: "" },
    ],
    effects: {
      ZeriP: null,
      ZeriQ: null,
      ZeriW: null,
      ZeriE: null,
      ZeriR: null,
    },
  };
}
export { importModule };
