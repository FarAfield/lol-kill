function importModule() {
  return {
    type: "hero",
    id: "Viktor",
    title: "机械先驱",
    name: "维克托",
    avatar: "Viktor.png",
    skins: [
      { name: "default", skin: "Viktor_0.jpg" },
      { name: "全金属狂潮 维克托", skin: "Viktor_1.jpg" },
      { name: "初号机 维克托", skin: "Viktor_2.jpg" },
      { name: "造物主 维克托", skin: "Viktor_3.jpg" },
      { name: "死亡誓约 维克托", skin: "Viktor_4.jpg" },
      { name: "灵能特工 维克托", skin: "Viktor_5.jpg" },
      { name: "西部魔影 天才机械师 维克托", skin: "Viktor_14.jpg" },
    ],
    spells: [
      { id: "ViktorP", name: "光荣进化", icon: "ViktorP.png", description: "" },
      { id: "ViktorQ", name: "虹吸能量", icon: "ViktorQ.png", description: "" },
      { id: "ViktorW", name: "重力场", icon: "ViktorW.png", description: "" },
      { id: "ViktorE", name: "死亡射线", icon: "ViktorE.png", description: "" },
      { id: "ViktorR", name: "混乱风暴", icon: "ViktorR.png", description: "" },
    ],
    effects: {
      ViktorP: null,
      ViktorQ: null,
      ViktorW: null,
      ViktorE: null,
      ViktorR: null,
    },
  };
}
export { importModule };
