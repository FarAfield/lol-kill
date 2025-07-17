function importModule() {
  return {
    type: "hero",
    id: "Xerath",
    title: "远古巫灵",
    name: "泽拉斯",
    avatar: "Xerath.png",
    skins: [
      { name: "default", skin: "Xerath_0.jpg" },
      { name: "符文生物 泽拉斯", skin: "Xerath_1.jpg" },
      { name: "战地法师 泽拉斯", skin: "Xerath_2.jpg" },
      { name: "枯萎之壤 泽拉斯", skin: "Xerath_3.jpg" },
      { name: "沙之守护 泽拉斯", skin: "Xerath_4.jpg" },
      { name: "暗星 泽拉斯", skin: "Xerath_5.jpg" },
      { name: "欲望之主 泽拉斯", skin: "Xerath_12.jpg" },
      { name: "宇航员 泽拉斯", skin: "Xerath_21.jpg" },
      { name: "水晶巫灵 泽拉斯", skin: "Xerath_30.jpg" },
    ],
    spells: [
      { id: "XerathP", name: "法力澎湃", icon: "XerathP.png", description: "" },
      { id: "XerathQ", name: "奥能脉冲", icon: "XerathQ.png", description: "" },
      { id: "XerathW", name: "毁灭之眼", icon: "XerathW.png", description: "" },
      { id: "XerathE", name: "冲击法球", icon: "XerathE.png", description: "" },
      { id: "XerathR", name: "奥术仪式", icon: "XerathR.png", description: "" },
    ],
    effects: {
      XerathP: null,
      XerathQ: null,
      XerathW: null,
      XerathE: null,
      XerathR: null,
    },
  };
}
export { importModule };
