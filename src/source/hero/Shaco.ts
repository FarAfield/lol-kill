function importModule() {
  return {
    type: "hero",
    id: "Shaco",
    title: "恶魔小丑",
    name: "萨科",
    avatar: "Shaco.png",
    skins: [
      { name: "default", skin: "Shaco_0.jpg" },
      { name: "恐怖之源 萨科", skin: "Shaco_1.jpg" },
      { name: "贵族血统 萨科", skin: "Shaco_2.jpg" },
      { name: "胡桃夹子 萨科", skin: "Shaco_3.jpg" },
      { name: "小丑工作坊 萨科", skin: "Shaco_4.jpg" },
      { name: "飞越疯人院 萨科", skin: "Shaco_5.jpg" },
      { name: "武动巅峰 萨科", skin: "Shaco_6.jpg" },
      { name: "万能小丑 萨科", skin: "Shaco_7.jpg" },
      { name: "暗星 萨科", skin: "Shaco_8.jpg" },
      { name: "奥术师 萨科", skin: "Shaco_15.jpg" },
      { name: "地下都市 梦魇 萨科", skin: "Shaco_23.jpg" },
      { name: "北极星使者 萨科", skin: "Shaco_33.jpg" },
      { name: "斗魂觉醒 萨科", skin: "Shaco_43.jpg" },
      { name: "至臻 斗魂觉醒 萨科", skin: "Shaco_44.jpg" },
      { name: "魔域梦魇 萨科", skin: "Shaco_54.jpg" },
    ],
    spells: [
      { id: "ShacoP", name: "背刺", icon: "ShacoP.png", description: "" },
      { id: "ShacoQ", name: "欺诈魔术", icon: "ShacoQ.png", description: "" },
      { id: "ShacoW", name: "惊吓魔盒", icon: "ShacoW.png", description: "" },
      { id: "ShacoE", name: "双面毒刃", icon: "ShacoE.png", description: "" },
      { id: "ShacoR", name: "幻像", icon: "ShacoR.png", description: "" },
    ],
    effects: {
      ShacoP: null,
      ShacoQ: null,
      ShacoW: null,
      ShacoE: null,
      ShacoR: null,
    },
  };
}
export { importModule };
