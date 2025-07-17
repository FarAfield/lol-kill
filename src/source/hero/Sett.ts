function importModule() {
  return {
    type: "hero",
    id: "Sett",
    title: "腕豪",
    name: "瑟提",
    avatar: "Sett.png",
    skins: [
      { name: "default", skin: "Sett_0.jpg" },
      { name: "王国机神苍狼 瑟提", skin: "Sett_1.jpg" },
      { name: "神龙尊者 炎龙瑟提", skin: "Sett_8.jpg" },
      { name: "至臻 神龙尊者 炎龙瑟提", skin: "Sett_9.jpg" },
      { name: "泳池派对 瑟提", skin: "Sett_10.jpg" },
      { name: "龙腾虎跃 瑟提", skin: "Sett_19.jpg" },
      { name: "灵魂莲华 瑟提", skin: "Sett_38.jpg" },
      { name: "斗魂觉醒 瑟提", skin: "Sett_45.jpg" },
      { name: "心之钢 瑟提", skin: "Sett_56.jpg" },
    ],
    spells: [
      { id: "SettP", name: "沙场豪情", icon: "SettP.png", description: "" },
      { id: "SettQ", name: "屈人之威", icon: "SettQ.png", description: "" },
      { id: "SettW", name: "蓄意轰拳", icon: "SettW.png", description: "" },
      { id: "SettE", name: "强手裂颅", icon: "SettE.png", description: "" },
      { id: "SettR", name: "叹为观止", icon: "SettR.png", description: "" },
    ],
    effects: {
      SettP: null,
      SettQ: null,
      SettW: null,
      SettE: null,
      SettR: null,
    },
  };
}
export { importModule };
