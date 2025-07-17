function importModule() {
  return {
    type: "hero",
    id: "Jinx",
    title: "暴走萝莉",
    name: "金克丝",
    avatar: "Jinx.png",
    skins: [
      { name: "default", skin: "Jinx_0.jpg" },
      { name: "黑帮狂花 金克丝", skin: "Jinx_1.jpg" },
      { name: "神龙烈焰 金克丝", skin: "Jinx_2.jpg" },
      { name: "丧尸杀手 金克丝", skin: "Jinx_3.jpg" },
      { name: "星之守护者 金克丝", skin: "Jinx_4.jpg" },
      { name: "圣诞捣蛋鬼 金克丝", skin: "Jinx_12.jpg" },
      { name: "奥德赛 金克丝", skin: "Jinx_13.jpg" },
      { name: "源计划：疯狂 金克丝", skin: "Jinx_20.jpg" },
      { name: "觅心萝莉 金克丝", skin: "Jinx_29.jpg" },
      { name: "双城之战 金克丝", skin: "Jinx_37.jpg" },
      { name: "幻灵战斗猫 金克丝", skin: "Jinx_38.jpg" },
      { name: "至臻 幻灵战斗猫 金克丝", skin: "Jinx_40.jpg" },
      { name: "咖啡甜心 金克丝", skin: "Jinx_51.jpg" },
      { name: "T1 金克丝", skin: "Jinx_62.jpg" },
    ],
    spells: [
      { id: "JinxP", name: "罪恶快感", icon: "JinxP.png", description: "" },
      { id: "JinxQ", name: "枪炮交响曲！", icon: "JinxQ.png", description: "" },
      { id: "JinxW", name: "震荡电磁波！", icon: "JinxW.png", description: "" },
      { id: "JinxE", name: "嚼火者手雷！", icon: "JinxE.png", description: "" },
      {
        id: "JinxR",
        name: "超究极死神飞弹！",
        icon: "JinxR.png",
        description: "",
      },
    ],
    effects: {
      JinxP: null,
      JinxQ: null,
      JinxW: null,
      JinxE: null,
      JinxR: null,
    },
  };
}
export { importModule };
