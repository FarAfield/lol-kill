function importModule() {
  return {
    type: "hero",
    id: "Kayn",
    title: "影流之镰",
    name: "凯隐",
    avatar: "Kayn.png",
    skins: [
      { name: "default", skin: "Kayn_0.jpg" },
      { name: "摄魂猎手 凯隐", skin: "Kayn_1.jpg" },
      { name: "奥德赛 凯隐", skin: "Kayn_2.jpg" },
      { name: "黑夜使者 凯隐", skin: "Kayn_8.jpg" },
      { name: "至臻 黑夜使者 凯隐", skin: "Kayn_9.jpg" },
      { name: "净雪之月 凯隐", skin: "Kayn_15.jpg" },
      { name: "心之钢 凯隐", skin: "Kayn_20.jpg" },
    ],
    spells: [
      { id: "KaynP", name: "暗裔魔镰", icon: "KaynP.png", description: "" },
      { id: "KaynQ", name: "巨镰横扫", icon: "KaynQ.png", description: "" },
      { id: "KaynW", name: "利刃纵贯", icon: "KaynW.png", description: "" },
      { id: "KaynE", name: "掠影步", icon: "KaynE.png", description: "" },
      { id: "KaynR", name: "裂舍影", icon: "KaynR.png", description: "" },
    ],
    effects: {
      KaynP: null,
      KaynQ: null,
      KaynW: null,
      KaynE: null,
      KaynR: null,
    },
  };
}
export { importModule };
