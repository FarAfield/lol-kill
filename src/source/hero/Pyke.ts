function importModule() {
  return {
    type: "hero",
    id: "Pyke",
    title: "血港鬼影",
    name: "派克",
    avatar: "Pyke.png",
    skins: [
      { name: "default", skin: "Pyke_0.jpg" },
      { name: "怨之砂 派克", skin: "Pyke_1.jpg" },
      { name: "腥红之月 派克", skin: "Pyke_9.jpg" },
      { name: "源计划：毁灭 派克", skin: "Pyke_16.jpg" },
      { name: "灵能特工 派克", skin: "Pyke_25.jpg" },
      { name: "光明哨兵 派克", skin: "Pyke_34.jpg" },
      { name: "灰烬骑士 派克", skin: "Pyke_44.jpg" },
      { name: "至高天 派克", skin: "Pyke_45.jpg" },
      { name: "斗魂觉醒 派克", skin: "Pyke_53.jpg" },
      { name: "至臻 斗魂觉醒 派克", skin: "Pyke_54.jpg" },
      { name: "魔域梦魇 派克", skin: "Pyke_64.jpg" },
    ],
    spells: [
      { id: "PykeP", name: "溺水之幸", icon: "PykeP.png", description: "" },
      { id: "PykeQ", name: "透骨尖钉", icon: "PykeQ.png", description: "" },
      { id: "PykeW", name: "幽潭潜行", icon: "PykeW.png", description: "" },
      { id: "PykeE", name: "魅影浪洄", icon: "PykeE.png", description: "" },
      { id: "PykeR", name: "涌泉之恨", icon: "PykeR.png", description: "" },
    ],
    effects: {
      PykeP: null,
      PykeQ: null,
      PykeW: null,
      PykeE: null,
      PykeR: null,
    },
  };
}
export { importModule };
