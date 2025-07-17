function importModule() {
  return {
    type: "hero",
    id: "Rakan",
    title: "幻翎",
    name: "洛",
    avatar: "Rakan.png",
    skins: [
      { name: "default", skin: "Rakan_0.jpg" },
      { name: "晨星之翎 洛", skin: "Rakan_1.jpg" },
      { name: "甜心之翎 洛", skin: "Rakan_2.jpg" },
      { name: "SSG 洛", skin: "Rakan_3.jpg" },
      { name: "iG 洛", skin: "Rakan_4.jpg" },
      { name: "星之守护者 洛", skin: "Rakan_5.jpg" },
      { name: "永恒之森 洛", skin: "Rakan_9.jpg" },
      { name: "比翼之心 洛", skin: "Rakan_18.jpg" },
      { name: "绝息圣堂 洛", skin: "Rakan_27.jpg" },
      { name: "星之守护者 净化之翎 洛", skin: "Rakan_36.jpg" },
      { name: "神龙尊者 比翼之龙 洛", skin: "Rakan_37.jpg" },
      { name: "至臻 神龙尊者 比翼之龙 洛", skin: "Rakan_38.jpg" },
    ],
    spells: [
      { id: "RakanP", name: "异色羽裳", icon: "RakanP.png", description: "" },
      { id: "RakanQ", name: "微光飞翎", icon: "RakanQ.png", description: "" },
      { id: "RakanW", name: "盛大登场", icon: "RakanW.png", description: "" },
      { id: "RakanE", name: "轻舞成双", icon: "RakanE.png", description: "" },
      { id: "RakanR", name: "惊鸿过隙", icon: "RakanR.png", description: "" },
    ],
    effects: {
      RakanP: null,
      RakanQ: null,
      RakanW: null,
      RakanE: null,
      RakanR: null,
    },
  };
}
export { importModule };
