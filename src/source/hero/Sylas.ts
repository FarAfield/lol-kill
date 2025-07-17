function importModule() {
  return {
    type: "hero",
    id: "Sylas",
    title: "解脱者",
    name: "塞拉斯",
    avatar: "Sylas.png",
    skins: [
      { name: "default", skin: "Sylas_0.jpg" },
      { name: "窃魂修罗 塞拉斯", skin: "Sylas_1.jpg" },
      { name: "弗雷尔卓德 塞拉斯", skin: "Sylas_8.jpg" },
      { name: "源计划：逆流 塞拉斯", skin: "Sylas_13.jpg" },
      { name: "至臻 源计划：逆流 塞拉斯", skin: "Sylas_14.jpg" },
      { name: "幻灵战斗狼 塞拉斯", skin: "Sylas_24.jpg" },
      { name: "灰烬杀手 塞拉斯", skin: "Sylas_34.jpg" },
      { name: "北极星发明家 塞拉斯", skin: "Sylas_36.jpg" },
      { name: "暗星 塞拉斯", skin: "Sylas_46.jpg" },
    ],
    spells: [
      { id: "SylasP", name: "破敌禁法", icon: "SylasP.png", description: "" },
      { id: "SylasQ", name: "锁链鞭击", icon: "SylasQ.png", description: "" },
      { id: "SylasW", name: "弑君突刺", icon: "SylasW.png", description: "" },
      { id: "SylasE", name: "潜掠/强掳", icon: "SylasE.png", description: "" },
      { id: "SylasR", name: "其人之道", icon: "SylasR.png", description: "" },
    ],
    effects: {
      SylasP: null,
      SylasQ: null,
      SylasW: null,
      SylasE: null,
      SylasR: null,
    },
  };
}
export { importModule };
