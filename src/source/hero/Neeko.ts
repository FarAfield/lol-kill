function importModule() {
  return {
    type: "hero",
    id: "Neeko",
    title: "万花通灵",
    name: "妮蔻",
    avatar: "Neeko.png",
    skins: [
      { name: "default", skin: "Neeko_0.jpg" },
      { name: "冬境仙灵 妮蔻", skin: "Neeko_1.jpg" },
      { name: "星之守护者 妮蔻", skin: "Neeko_10.jpg" },
      { name: "至臻 星之守护者 妮蔻", skin: "Neeko_11.jpg" },
      { name: "山海绘卷 妮蔻", skin: "Neeko_12.jpg" },
      { name: "至臻 星之守护者 妮蔻 (2022)", skin: "Neeko_21.jpg" },
      { name: "魅惑女巫 妮蔻", skin: "Neeko_22.jpg" },
      { name: "妖怪艺术家 妮蔻", skin: "Neeko_31.jpg" },
      { name: "超级COSPLAY粉丝 妮蔻", skin: "Neeko_40.jpg" },
    ],
    spells: [
      { id: "NeekoP", name: "天生幻魅", icon: "NeekoP.png", description: "" },
      { id: "NeekoQ", name: "盛开花种", icon: "NeekoQ.png", description: "" },
      { id: "NeekoW", name: "两生花影", icon: "NeekoW.png", description: "" },
      { id: "NeekoE", name: "缠结倒刺", icon: "NeekoE.png", description: "" },
      { id: "NeekoR", name: "怒放", icon: "NeekoR.png", description: "" },
    ],
    effects: {
      NeekoP: null,
      NeekoQ: null,
      NeekoW: null,
      NeekoE: null,
      NeekoR: null,
    },
  };
}
export { importModule };
