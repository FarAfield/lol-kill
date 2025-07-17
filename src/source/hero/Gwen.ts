function importModule() {
  return {
    type: "hero",
    id: "Gwen",
    title: "灵罗娃娃",
    name: "格温",
    avatar: "Gwen.png",
    skins: [
      { name: "default", skin: "Gwen_0.jpg" },
      { name: "太空律动 “百万调音” 格温", skin: "Gwen_1.jpg" },
      { name: "咖啡甜心 格温", skin: "Gwen_11.jpg" },
      { name: "斗魂觉醒 格温", skin: "Gwen_20.jpg" },
      { name: "女帝 格温", skin: "Gwen_30.jpg" },
    ],
    spells: [
      { id: "GwenP", name: "千穿百孔", icon: "GwenP.png", description: "" },
      { id: "GwenQ", name: "快刀剪乱", icon: "GwenQ.png", description: "" },
      { id: "GwenW", name: "丝缕缠流", icon: "GwenW.png", description: "" },
      { id: "GwenE", name: "断续疾走", icon: "GwenE.png", description: "" },
      { id: "GwenR", name: "引针簇射", icon: "GwenR.png", description: "" },
    ],
    effects: {
      GwenP: null,
      GwenQ: null,
      GwenW: null,
      GwenE: null,
      GwenR: null,
    },
  };
}
export { importModule };
