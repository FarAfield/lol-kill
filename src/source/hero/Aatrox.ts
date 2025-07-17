function importModule() {
  return {
    type: "hero",
    id: "Aatrox",
    title: "暗裔剑魔",
    name: "亚托克斯",
    avatar: "Aatrox.png",
    skins: [
      { name: "default", skin: "Aatrox_0.jpg" },
      { name: "仲裁圣骑 亚托克斯", skin: "Aatrox_1.jpg" },
      { name: "霸天剑魔 亚托克斯", skin: "Aatrox_2.jpg" },
      { name: "狂鲨 亚托克斯", skin: "Aatrox_3.jpg" },
      { name: "腥红之月 亚托克斯", skin: "Aatrox_7.jpg" },
      { name: "至臻 腥红之月 亚托克斯", skin: "Aatrox_8.jpg" },
      { name: "胜利之剑 亚托克斯", skin: "Aatrox_9.jpg" },
      { name: "奥德赛 亚托克斯", skin: "Aatrox_11.jpg" },
      { name: "至臻 腥红之月 亚托克斯 (2022)", skin: "Aatrox_20.jpg" },
      { name: "月蚀骑士 亚托克斯", skin: "Aatrox_21.jpg" },
      { name: "DRX 亚托克斯", skin: "Aatrox_30.jpg" },
      { name: "至臻 DRX 亚托克斯", skin: "Aatrox_31.jpg" },
      { name: "海魔至尊 亚托克斯", skin: "Aatrox_33.jpg" },
    ],
    spells: [
      { id: "AatroxP", name: "赐死剑气", icon: "AatroxP.png", description: "" },
      { id: "AatroxQ", name: "暗裔利刃", icon: "AatroxQ.png", description: "" },
      { id: "AatroxW", name: "恶火束链", icon: "AatroxW.png", description: "" },
      { id: "AatroxE", name: "暗影冲决", icon: "AatroxE.png", description: "" },
      { id: "AatroxR", name: "大灭", icon: "AatroxR.png", description: "" },
    ],
    effects: {
      AatroxP: null,
      AatroxQ: null,
      AatroxW: null,
      AatroxE: null,
      AatroxR: null,
    },
  };
}
export { importModule };
