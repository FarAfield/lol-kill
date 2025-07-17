function importModule() {
  return {
    type: "hero",
    id: "Jayce",
    title: "未来守护者",
    name: "杰斯",
    avatar: "Jayce.png",
    skins: [
      { name: "default", skin: "Jayce_0.jpg" },
      { name: "全金属狂潮 杰斯", skin: "Jayce_1.jpg" },
      { name: "蔷薇绅士 杰斯", skin: "Jayce_2.jpg" },
      { name: "天启骑士 杰斯", skin: "Jayce_3.jpg" },
      { name: "杰斯·光明之锤", skin: "Jayce_4.jpg" },
      { name: "战斗学院 杰斯", skin: "Jayce_5.jpg" },
      { name: "抵抗军雷神 杰斯", skin: "Jayce_15.jpg" },
      { name: "双城之战 杰斯", skin: "Jayce_24.jpg" },
      { name: "巅峰之星 杰斯", skin: "Jayce_25.jpg" },
      { name: "T1 杰斯", skin: "Jayce_34.jpg" },
      { name: "至臻 T1 杰斯", skin: "Jayce_36.jpg" },
    ],
    spells: [
      {
        id: "JayceP",
        name: "海克斯科技电容",
        icon: "JayceP.png",
        description: "",
      },
      {
        id: "JayceQ",
        name: "苍穹之跃 / 电能震荡",
        icon: "JayceQ.png",
        description: "",
      },
      {
        id: "JayceW",
        name: "闪电领域 / 超能电荷",
        icon: "JayceW.png",
        description: "",
      },
      {
        id: "JayceE",
        name: "雷霆一击 / 加速之门",
        icon: "JayceE.png",
        description: "",
      },
      {
        id: "JayceR",
        name: "墨丘利之炮 / 墨丘利之锤",
        icon: "JayceR.png",
        description: "",
      },
    ],
    effects: {
      JayceP: null,
      JayceQ: null,
      JayceW: null,
      JayceE: null,
      JayceR: null,
    },
  };
}
export { importModule };
