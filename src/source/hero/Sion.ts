function importModule() {
  return {
    type: "hero",
    id: "Sion",
    title: "亡灵战神",
    name: "赛恩",
    avatar: "Sion.png",
    skins: [
      { name: "default", skin: "Sion_0.jpg" },
      { name: "钢铁终结者 赛恩", skin: "Sion_1.jpg" },
      { name: "武仙座海格力斯 赛恩", skin: "Sion_2.jpg" },
      { name: "原野伐木工 赛恩", skin: "Sion_3.jpg" },
      { name: "战争机器 赛恩", skin: "Sion_4.jpg" },
      { name: "霸天零式 赛恩", skin: "Sion_5.jpg" },
      { name: "创世之神 赛恩", skin: "Sion_14.jpg" },
      { name: "黯晶战神 赛恩", skin: "Sion_22.jpg" },
      { name: "西部魔影 合成天使 赛恩", skin: "Sion_30.jpg" },
      { name: "星界圣骑 赛恩", skin: "Sion_40.jpg" },
    ],
    spells: [
      { id: "SionP", name: "死亡荣耀", icon: "SionP.png", description: "" },
      { id: "SionQ", name: "残虐猛击", icon: "SionQ.png", description: "" },
      { id: "SionW", name: "灵魂熔炉", icon: "SionW.png", description: "" },
      { id: "SionE", name: "杀手怒吼", icon: "SionE.png", description: "" },
      { id: "SionR", name: "蛮横冲撞", icon: "SionR.png", description: "" },
    ],
    effects: {
      SionP: null,
      SionQ: null,
      SionW: null,
      SionE: null,
      SionR: null,
    },
  };
}
export { importModule };
