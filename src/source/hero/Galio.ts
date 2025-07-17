function importModule() {
  return {
    type: "hero",
    id: "Galio",
    title: "正义巨像",
    name: "加里奥",
    avatar: "Galio.png",
    skins: [
      { name: "default", skin: "Galio_0.jpg" },
      { name: "幽蓝梦魇 加里奥", skin: "Galio_1.jpg" },
      { name: "机械迷城 加里奥", skin: "Galio_2.jpg" },
      { name: "战地之王 加里奥", skin: "Galio_3.jpg" },
      { name: "地狱之门卫士 加里奥", skin: "Galio_4.jpg" },
      { name: "风执事 加里奥", skin: "Galio_5.jpg" },
      { name: "鸡里奥", skin: "Galio_6.jpg" },
      { name: "地狱火 加里奥", skin: "Galio_13.jpg" },
      { name: "龙族卫士 加里奥", skin: "Galio_19.jpg" },
      { name: "剪纸仙灵 加里奥", skin: "Galio_28.jpg" },
    ],
    spells: [
      { id: "GalioP", name: "巨像重击", icon: "GalioP.png", description: "" },
      { id: "GalioQ", name: "战争罡风", icon: "GalioQ.png", description: "" },
      { id: "GalioW", name: "杜朗护盾", icon: "GalioW.png", description: "" },
      { id: "GalioE", name: "正义冲拳", icon: "GalioE.png", description: "" },
      { id: "GalioR", name: "英雄登场", icon: "GalioR.png", description: "" },
    ],
    effects: {
      GalioP: null,
      GalioQ: null,
      GalioW: null,
      GalioE: null,
      GalioR: null,
    },
  };
}
export { importModule };
