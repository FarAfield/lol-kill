function importModule() {
  return {
    type: "hero",
    id: "Lucian",
    title: "圣枪游侠",
    name: "卢锡安",
    avatar: "Lucian.png",
    skins: [
      { name: "default", skin: "Lucian_0.jpg" },
      { name: "职业杀手 卢锡安", skin: "Lucian_1.jpg" },
      { name: "夺命前锋 卢锡安", skin: "Lucian_2.jpg" },
      { name: "源计划：雷 卢锡安", skin: "Lucian_6.jpg" },
      { name: "觅心游侠 卢锡安", skin: "Lucian_7.jpg" },
      { name: "西部魔影 卢锡安", skin: "Lucian_8.jpg" },
      { name: "德玛西亚警官 卢锡安", skin: "Lucian_9.jpg" },
      { name: "未来战士 卢锡安", skin: "Lucian_18.jpg" },
      { name: "至臻 未来战士 卢锡安", skin: "Lucian_19.jpg" },
      { name: "胜利枪神 卢锡安", skin: "Lucian_25.jpg" },
      { name: "正义之枪 卢锡安", skin: "Lucian_31.jpg" },
      { name: "海珀利安小队 Z01-猎户座 卢锡安", skin: "Lucian_40.jpg" },
      { name: "北极星守护者 卢锡安", skin: "Lucian_52.jpg" },
    ],
    spells: [
      { id: "LucianP", name: "圣光银弹", icon: "LucianP.png", description: "" },
      { id: "LucianQ", name: "透体圣光", icon: "LucianQ.png", description: "" },
      { id: "LucianW", name: "热诚烈弹", icon: "LucianW.png", description: "" },
      { id: "LucianE", name: "冷酷追击", icon: "LucianE.png", description: "" },
      { id: "LucianR", name: "圣枪洗礼", icon: "LucianR.png", description: "" },
    ],
    effects: {
      LucianP: null,
      LucianQ: null,
      LucianW: null,
      LucianE: null,
      LucianR: null,
    },
  };
}
export { importModule };
