function importModule() {
  return {
    type: "hero",
    id: "Singed",
    title: "炼金术士",
    name: "辛吉德",
    avatar: "Singed.png",
    skins: [
      { name: "default", skin: "Singed_0.jpg" },
      { name: "防暴士兵 辛吉德", skin: "Singed_1.jpg" },
      { name: "机械污染 辛吉德", skin: "Singed_2.jpg" },
      { name: "冲浪高手 辛吉德", skin: "Singed_3.jpg" },
      { name: "科学狂人 辛吉德", skin: "Singed_4.jpg" },
      { name: "炼金狂士 辛吉德", skin: "Singed_5.jpg" },
      { name: "冰雪节 辛吉德", skin: "Singed_6.jpg" },
      { name: "SSW 辛吉德", skin: "Singed_7.jpg" },
      { name: "黑色天灾 辛吉德", skin: "Singed_8.jpg" },
      { name: "养蜂人 辛吉德", skin: "Singed_9.jpg" },
      { name: "抵抗军绿魔 辛吉德", skin: "Singed_10.jpg" },
      { name: "宇航员 辛吉德", skin: "Singed_19.jpg" },
    ],
    spells: [
      { id: "SingedP", name: "剧毒冲流", icon: "SingedP.png", description: "" },
      { id: "SingedQ", name: "剧毒踪迹", icon: "SingedQ.png", description: "" },
      { id: "SingedW", name: "强力粘胶", icon: "SingedW.png", description: "" },
      { id: "SingedE", name: "过肩摔", icon: "SingedE.png", description: "" },
      { id: "SingedR", name: "疯狂药剂", icon: "SingedR.png", description: "" },
    ],
    effects: {
      SingedP: null,
      SingedQ: null,
      SingedW: null,
      SingedE: null,
      SingedR: null,
    },
  };
}
export { importModule };
