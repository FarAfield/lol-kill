function importModule() {
  return {
    type: "hero",
    id: "Thresh",
    title: "魂锁典狱长",
    name: "锤石",
    avatar: "Thresh.png",
    skins: [
      { name: "default", skin: "Thresh_0.jpg" },
      { name: "深渊恐惧 锤石", skin: "Thresh_1.jpg" },
      { name: "冠军典狱长 锤石", skin: "Thresh_2.jpg" },
      { name: "腥红之月 锤石", skin: "Thresh_3.jpg" },
      { name: "SSW 锤石", skin: "Thresh_4.jpg" },
      { name: "暗星 锤石", skin: "Thresh_5.jpg" },
      { name: "西部魔影 锤石", skin: "Thresh_6.jpg" },
      { name: "未来战士 锤石", skin: "Thresh_13.jpg" },
      { name: "至臻 未来战士 锤石", skin: "Thresh_14.jpg" },
      { name: "FPX 锤石", skin: "Thresh_15.jpg" },
      { name: "灵魂莲华 锤石", skin: "Thresh_17.jpg" },
      { name: "破败解封 锤石", skin: "Thresh_27.jpg" },
      { name: "神龙尊者 钢铁之龙 锤石", skin: "Thresh_28.jpg" },
      { name: "至臻 未来战士 锤石 (2022)", skin: "Thresh_38.jpg" },
      { name: "春晖大帝 锤石", skin: "Thresh_39.jpg" },
      { name: "北极星典狱长 锤石", skin: "Thresh_49.jpg" },
      { name: "洗地专家 锤石", skin: "Thresh_59.jpg" },
    ],
    spells: [
      { id: "ThreshP", name: "地狱诅咒", icon: "ThreshP.png", description: "" },
      { id: "ThreshQ", name: "死亡判决", icon: "ThreshQ.png", description: "" },
      { id: "ThreshW", name: "魂引之灯", icon: "ThreshW.png", description: "" },
      { id: "ThreshE", name: "厄运钟摆", icon: "ThreshE.png", description: "" },
      { id: "ThreshR", name: "幽冥监牢", icon: "ThreshR.png", description: "" },
    ],
    effects: {
      ThreshP: null,
      ThreshQ: null,
      ThreshW: null,
      ThreshE: null,
      ThreshR: null,
    },
  };
}
export { importModule };
