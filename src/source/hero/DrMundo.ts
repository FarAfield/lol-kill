function importModule() {
  return {
    type: "hero",
    id: "DrMundo",
    title: "祖安狂人",
    name: "蒙多医生",
    avatar: "DrMundo.png",
    skins: [
      { name: "default", skin: "DrMundo_0.jpg" },
      { name: "战栗之毒 蒙多", skin: "DrMundo_1.jpg" },
      { name: "健美教练 蒙多", skin: "DrMundo_2.jpg" },
      { name: "律政大亨 蒙多", skin: "DrMundo_3.jpg" },
      { name: "蒙多蒙多", skin: "DrMundo_4.jpg" },
      { name: "嗜血行刑 蒙多", skin: "DrMundo_5.jpg" },
      { name: "战争血统 蒙多", skin: "DrMundo_6.jpg" },
      { name: "暗杀星 蒙多", skin: "DrMundo_7.jpg" },
      { name: "泳池派对 蒙多", skin: "DrMundo_8.jpg" },
      { name: "硬汉 蒙多", skin: "DrMundo_9.jpg" },
      { name: "冰封王子 蒙多", skin: "DrMundo_10.jpg" },
      { name: "妖怪艺术家 蒙多医生", skin: "DrMundo_21.jpg" },
    ],
    spells: [
      {
        id: "DrMundoP",
        name: "想去哪就去哪",
        icon: "DrMundoP.png",
        description: "",
      },
      {
        id: "DrMundoQ",
        name: "病毒屠刀",
        icon: "DrMundoQ.png",
        description: "",
      },
      {
        id: "DrMundoW",
        name: "电击疗法",
        icon: "DrMundoW.png",
        description: "",
      },
      {
        id: "DrMundoE",
        name: "大力行医",
        icon: "DrMundoE.png",
        description: "",
      },
      {
        id: "DrMundoR",
        name: "极限剂量",
        icon: "DrMundoR.png",
        description: "",
      },
    ],
    effects: {
      DrMundoP: null,
      DrMundoQ: null,
      DrMundoW: null,
      DrMundoE: null,
      DrMundoR: null,
    },
  };
}
export { importModule };
