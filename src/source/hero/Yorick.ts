function importModule() {
  return {
    type: "hero",
    id: "Yorick",
    title: "牧魂人",
    name: "约里克",
    avatar: "Yorick.png",
    skins: [
      { name: "default", skin: "Yorick_0.jpg" },
      { name: "地狱送葬 约里克", skin: "Yorick_1.jpg" },
      { name: "五杀摇滚贝斯手 约里克", skin: "Yorick_2.jpg" },
      { name: "苍穹之光 约里克", skin: "Yorick_3.jpg" },
      { name: "喵里克", skin: "Yorick_4.jpg" },
      { name: "抵抗军灵魔 约里克", skin: "Yorick_12.jpg" },
      { name: "五杀摇滚 III：遗失的章节 约里克", skin: "Yorick_21.jpg" },
      { name: "灵魂莲华 约里克", skin: "Yorick_30.jpg" },
      { name: "暗星 约里克", skin: "Yorick_40.jpg" },
    ],
    spells: [
      { id: "YorickP", name: "牧魂人", icon: "YorickP.png", description: "" },
      { id: "YorickQ", name: "临终仪式", icon: "YorickQ.png", description: "" },
      { id: "YorickW", name: "暗灵缠身", icon: "YorickW.png", description: "" },
      { id: "YorickE", name: "哀伤之雾", icon: "YorickE.png", description: "" },
      { id: "YorickR", name: "海屿悼词", icon: "YorickR.png", description: "" },
    ],
    effects: {
      YorickP: null,
      YorickQ: null,
      YorickW: null,
      YorickE: null,
      YorickR: null,
    },
  };
}
export { importModule };
