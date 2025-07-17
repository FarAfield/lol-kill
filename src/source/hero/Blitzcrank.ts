function importModule() {
  return {
    type: "hero",
    id: "Blitzcrank",
    title: "蒸汽机器人",
    name: "布里茨",
    avatar: "Blitzcrank.png",
    skins: [
      { name: "default", skin: "Blitzcrank_0.jpg" },
      { name: "铁锈斑斑 布里茨", skin: "Blitzcrank_1.jpg" },
      { name: "钢铁之门 布里茨", skin: "Blitzcrank_2.jpg" },
      { name: "擂台皇帝 布里茨", skin: "Blitzcrank_3.jpg" },
      { name: "陆地王者4WD 布里茨", skin: "Blitzcrank_4.jpg" },
      { name: "戴一个表 布里茨", skin: "Blitzcrank_5.jpg" },
      { name: "苹果机器人 布里茨", skin: "Blitzcrank_6.jpg" },
      { name: "防暴机器人 布里茨", skin: "Blitzcrank_7.jpg" },
      { name: "战场BOSS 布里茨", skin: "Blitzcrank_11.jpg" },
      { name: "暮色枪骑 布里茨", skin: "Blitzcrank_20.jpg" },
      { name: "银白枪骑 布里茨", skin: "Blitzcrank_21.jpg" },
      { name: "大魔法锅 布里茨", skin: "Blitzcrank_22.jpg" },
      { name: "太空律动 “猫猫” 布里和里茨", skin: "Blitzcrank_29.jpg" },
      { name: "胜利机器人 布里茨", skin: "Blitzcrank_36.jpg" },
      { name: "巅峰之星 布里茨", skin: "Blitzcrank_47.jpg" },
      { name: "巨神蜂 布里茨", skin: "Blitzcrank_56.jpg" },
    ],
    spells: [
      {
        id: "BlitzcrankP",
        name: "法力屏障",
        icon: "BlitzcrankP.png",
        description: "",
      },
      {
        id: "BlitzcrankQ",
        name: "机械飞爪",
        icon: "BlitzcrankQ.png",
        description: "",
      },
      {
        id: "BlitzcrankW",
        name: "过载运转",
        icon: "BlitzcrankW.png",
        description: "",
      },
      {
        id: "BlitzcrankE",
        name: "能量铁拳",
        icon: "BlitzcrankE.png",
        description: "",
      },
      {
        id: "BlitzcrankR",
        name: "静电力场",
        icon: "BlitzcrankR.png",
        description: "",
      },
    ],
    effects: {
      BlitzcrankP: null,
      BlitzcrankQ: null,
      BlitzcrankW: null,
      BlitzcrankE: null,
      BlitzcrankR: null,
    },
  };
}
export { importModule };
