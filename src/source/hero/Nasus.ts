function importModule() {
  return {
    type: "hero",
    id: "Nasus",
    title: "沙漠死神",
    name: "内瑟斯",
    avatar: "Nasus.png",
    skins: [
      { name: "default", skin: "Nasus_0.jpg" },
      { name: "星空之门 内瑟斯", skin: "Nasus_1.jpg" },
      { name: "法老王朝 内瑟斯", skin: "Nasus_2.jpg" },
      { name: "死亡骑士 内瑟斯", skin: "Nasus_3.jpg" },
      { name: "警用试作体K-9 内瑟斯", skin: "Nasus_4.jpg" },
      { name: "炼狱魔犬 内瑟斯", skin: "Nasus_5.jpg" },
      { name: "单身贵族 内瑟斯", skin: "Nasus_6.jpg" },
      { name: "创世之神 内瑟斯", skin: "Nasus_10.jpg" },
      { name: "北辰之威 内瑟斯", skin: "Nasus_11.jpg" },
      { name: "战地机甲 内瑟斯", skin: "Nasus_16.jpg" },
      { name: "太空律动 “狗头” 内瑟斯", skin: "Nasus_25.jpg" },
      { name: "海珀利安小队 S02-阿努比斯 内瑟斯", skin: "Nasus_35.jpg" },
      { name: "黑夜使者 内瑟斯", skin: "Nasus_45.jpg" },
    ],
    spells: [
      { id: "NasusP", name: "吞噬灵魂", icon: "NasusP.png", description: "" },
      { id: "NasusQ", name: "汲魂痛击", icon: "NasusQ.png", description: "" },
      { id: "NasusW", name: "枯萎", icon: "NasusW.png", description: "" },
      { id: "NasusE", name: "灵魂烈焰", icon: "NasusE.png", description: "" },
      { id: "NasusR", name: "死神降临", icon: "NasusR.png", description: "" },
    ],
    effects: {
      NasusP: null,
      NasusQ: null,
      NasusW: null,
      NasusE: null,
      NasusR: null,
    },
  };
}
export { importModule };
