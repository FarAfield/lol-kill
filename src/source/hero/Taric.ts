function importModule() {
  return {
    type: "hero",
    id: "Taric",
    title: "瓦洛兰之盾",
    name: "塔里克",
    avatar: "Taric.png",
    skins: [
      { name: "default", skin: "Taric_0.jpg" },
      { name: "绿水晶光辉 塔里克", skin: "Taric_1.jpg" },
      { name: "紫水晶意志 塔里克", skin: "Taric_2.jpg" },
      { name: "血石诅咒 塔里克", skin: "Taric_3.jpg" },
      { name: "泳池派对 塔里克", skin: "Taric_4.jpg" },
      { name: "塔里克 · 辉盾", skin: "Taric_9.jpg" },
      { name: "太空律动 “爱乐之子” 塔里克", skin: "Taric_18.jpg" },
    ],
    spells: [
      { id: "TaricP", name: "正气凌人", icon: "TaricP.png", description: "" },
      { id: "TaricQ", name: "星光之触", icon: "TaricQ.png", description: "" },
      { id: "TaricW", name: "坚毅壁垒", icon: "TaricW.png", description: "" },
      { id: "TaricE", name: "炫光", icon: "TaricE.png", description: "" },
      { id: "TaricR", name: "宇宙之辉", icon: "TaricR.png", description: "" },
    ],
    effects: {
      TaricP: null,
      TaricQ: null,
      TaricW: null,
      TaricE: null,
      TaricR: null,
    },
  };
}
export { importModule };
