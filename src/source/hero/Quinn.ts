function importModule() {
  return {
    type: "hero",
    id: "Quinn",
    title: "德玛西亚之翼",
    name: "奎因",
    avatar: "Quinn.png",
    skins: [
      { name: "default", skin: "Quinn_0.jpg" },
      { name: "血羽凤凰 奎因", skin: "Quinn_1.jpg" },
      { name: "勇敢的心 奎因", skin: "Quinn_2.jpg" },
      { name: "死亡之鹰 奎因", skin: "Quinn_3.jpg" },
      { name: "觅心之翼 奎因", skin: "Quinn_4.jpg" },
      { name: "光明骑士 奎因", skin: "Quinn_5.jpg" },
      { name: "星之守护者 奎因", skin: "Quinn_14.jpg" },
    ],
    spells: [
      { id: "QuinnP", name: "侵扰", icon: "QuinnP.png", description: "" },
      { id: "QuinnQ", name: "炫目攻势", icon: "QuinnQ.png", description: "" },
      { id: "QuinnW", name: "敏锐感知", icon: "QuinnW.png", description: "" },
      { id: "QuinnE", name: "旋翔掠杀", icon: "QuinnE.png", description: "" },
      { id: "QuinnR", name: "深入敌后", icon: "QuinnR.png", description: "" },
    ],
    effects: {
      QuinnP: null,
      QuinnQ: null,
      QuinnW: null,
      QuinnE: null,
      QuinnR: null,
    },
  };
}
export { importModule };
