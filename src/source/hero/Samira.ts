function importModule() {
  return {
    type: "hero",
    id: "Samira",
    title: "沙漠玫瑰",
    name: "莎弥拉",
    avatar: "Samira.png",
    skins: [
      { name: "default", skin: "Samira_0.jpg" },
      { name: "灵能特工 莎弥拉", skin: "Samira_1.jpg" },
      { name: "太空律动 “音浪狂舞” 莎弥拉", skin: "Samira_10.jpg" },
      { name: "西部魔影 持枪女巫 莎弥拉", skin: "Samira_20.jpg" },
      { name: "斗魂觉醒 莎弥拉", skin: "Samira_30.jpg" },
    ],
    spells: [
      { id: "SamiraP", name: "悍勇本色", icon: "SamiraP.png", description: "" },
      { id: "SamiraQ", name: "交火", icon: "SamiraQ.png", description: "" },
      { id: "SamiraW", name: "锋旋", icon: "SamiraW.png", description: "" },
      { id: "SamiraE", name: "狂飙", icon: "SamiraE.png", description: "" },
      { id: "SamiraR", name: "炼狱扳机", icon: "SamiraR.png", description: "" },
    ],
    effects: {
      SamiraP: null,
      SamiraQ: null,
      SamiraW: null,
      SamiraE: null,
      SamiraR: null,
    },
  };
}
export { importModule };
