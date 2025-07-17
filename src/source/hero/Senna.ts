function importModule() {
  return {
    type: "hero",
    id: "Senna",
    title: "涤魂圣枪",
    name: "赛娜",
    avatar: "Senna.png",
    skins: [
      { name: "default", skin: "Senna_0.jpg" },
      { name: "真实伤害 赛娜", skin: "Senna_1.jpg" },
      { name: "至臻 真实伤害 赛娜", skin: "Senna_9.jpg" },
      { name: "西部天使 赛娜", skin: "Senna_10.jpg" },
      { name: "源计划：魅灵 赛娜", skin: "Senna_16.jpg" },
      { name: "月蚀骑士 赛娜", skin: "Senna_26.jpg" },
      { name: "至臻 月蚀骑士 赛娜", skin: "Senna_27.jpg" },
      { name: "魅惑女巫 赛娜", skin: "Senna_36.jpg" },
      { name: "星之守护者 赛娜", skin: "Senna_46.jpg" },
      { name: "北极星神 赛娜", skin: "Senna_56.jpg" },
    ],
    spells: [
      { id: "SennaP", name: "赦除", icon: "SennaP.png", description: "" },
      { id: "SennaQ", name: "黑暗洞灭", icon: "SennaQ.png", description: "" },
      { id: "SennaW", name: "无尽厮守", icon: "SennaW.png", description: "" },
      { id: "SennaE", name: "黑雾咒附", icon: "SennaE.png", description: "" },
      { id: "SennaR", name: "暗影燎原", icon: "SennaR.png", description: "" },
    ],
    effects: {
      SennaP: null,
      SennaQ: null,
      SennaW: null,
      SennaE: null,
      SennaR: null,
    },
  };
}
export { importModule };
