function importModule() {
  return {
    type: "hero",
    id: "Ivern",
    title: "翠神",
    name: "艾翁",
    avatar: "Ivern.png",
    skins: [
      { name: "default", skin: "Ivern_0.jpg" },
      { name: "糖果之王 艾翁", skin: "Ivern_1.jpg" },
      { name: "灌篮高手 艾翁", skin: "Ivern_2.jpg" },
      { name: "古神 艾翁", skin: "Ivern_11.jpg" },
      { name: "宇航员 艾翁", skin: "Ivern_20.jpg" },
    ],
    spells: [
      { id: "IvernP", name: "森林之友", icon: "IvernP.png", description: "" },
      { id: "IvernQ", name: "根深敌固", icon: "IvernQ.png", description: "" },
      { id: "IvernW", name: "揠苗助攻", icon: "IvernW.png", description: "" },
      { id: "IvernE", name: "种豆得瓜", icon: "IvernE.png", description: "" },
      { id: "IvernR", name: "小菊！", icon: "IvernR.png", description: "" },
    ],
    effects: {
      IvernP: null,
      IvernQ: null,
      IvernW: null,
      IvernE: null,
      IvernR: null,
    },
  };
}
export { importModule };
